import type {
  DaymarkRepository,
  HabitEntity,
  HabitRecordEntity,
  HabitVersionEntity,
} from "@rizakura-hontai/daymark/server";

type HabitRow = {
  readonly id: string;
  readonly name: string;
  readonly kind: "check" | "number";
  readonly created_on: string;
  readonly created_at: string;
  readonly updated_at: string;
};

type VersionRow = {
  readonly id: string;
  readonly habit_id: string;
  readonly effective_from: string;
  readonly kind: "check" | "number";
  readonly status: "active" | "paused" | "archived";
  readonly target_milli: number | null;
  readonly unit: string | null;
  readonly comparison: "at_least" | "at_most" | null;
  readonly created_at: string;
  readonly updated_at: string;
};

type RecordRow = {
  readonly id: string;
  readonly habit_id: string;
  readonly record_date: string;
  readonly kind: "check" | "number";
  readonly checked: number | null;
  readonly value_milli: number | null;
  readonly created_at: string;
  readonly updated_at: string;
};

const mapHabit = (row: HabitRow): HabitEntity => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  createdOn: row.created_on,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapVersion = (row: VersionRow): HabitVersionEntity => ({
  id: row.id,
  habitId: row.habit_id,
  effectiveFrom: row.effective_from,
  kind: row.kind,
  status: row.status,
  targetMilli: row.target_milli,
  unit: row.unit,
  comparison: row.comparison,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRecord = (row: RecordRow): HabitRecordEntity => ({
  id: row.id,
  habitId: row.habit_id,
  recordDate: row.record_date,
  kind: row.kind,
  checked: row.checked === null ? null : row.checked === 1,
  valueMilli: row.value_milli,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

class D1DaymarkRepository implements DaymarkRepository {
  readonly #database: D1Database;

  constructor(database: D1Database) {
    this.#database = database;
  }

  async #habitExists(id: string): Promise<boolean> {
    const row = await this.#database
      .prepare("SELECT id FROM daymark_habits WHERE id = ? LIMIT 1")
      .bind(id)
      .first<{ readonly id: string }>();
    return row !== null;
  }

  async listHabits(): Promise<readonly HabitEntity[]> {
    const result = await this.#database
      .prepare(
        "SELECT id, name, kind, created_on, created_at, updated_at FROM daymark_habits ORDER BY created_on, id",
      )
      .all<HabitRow>();
    return result.results.map(mapHabit);
  }

  async listVersions(): Promise<readonly HabitVersionEntity[]> {
    const result = await this.#database
      .prepare(
        "SELECT id, habit_id, effective_from, kind, status, target_milli, unit, comparison, created_at, updated_at FROM daymark_habit_versions ORDER BY effective_from, id",
      )
      .all<VersionRow>();
    return result.results.map(mapVersion);
  }

  async listRecords(start: string, end: string): Promise<readonly HabitRecordEntity[]> {
    const result = await this.#database
      .prepare(
        "SELECT id, habit_id, record_date, kind, checked, value_milli, created_at, updated_at FROM daymark_records WHERE record_date BETWEEN ? AND ? ORDER BY record_date, habit_id",
      )
      .bind(start, end)
      .all<RecordRow>();
    return result.results.map(mapRecord);
  }

  async createHabit(habit: HabitEntity, version: HabitVersionEntity): Promise<void> {
    await this.#database.batch([
      this.#database
        .prepare(
          "INSERT INTO daymark_habits (id, name, kind, created_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(habit.id, habit.name, habit.kind, habit.createdOn, habit.createdAt, habit.updatedAt),
      this.#versionInsert(version),
    ]);
  }

  async updateHabitName(id: string, name: string, updatedAt: string): Promise<boolean> {
    const result = await this.#database
      .prepare("UPDATE daymark_habits SET name = ?, updated_at = ? WHERE id = ?")
      .bind(name, updatedAt, id)
      .run();
    return result.meta.changes > 0;
  }

  #versionInsert(version: HabitVersionEntity): D1PreparedStatement {
    return this.#database
      .prepare(
        "INSERT INTO daymark_habit_versions (id, habit_id, effective_from, kind, status, target_milli, unit, comparison, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (habit_id, effective_from) DO UPDATE SET kind = excluded.kind, status = excluded.status, target_milli = excluded.target_milli, unit = excluded.unit, comparison = excluded.comparison, updated_at = excluded.updated_at",
      )
      .bind(
        version.id,
        version.habitId,
        version.effectiveFrom,
        version.kind,
        version.status,
        version.targetMilli,
        version.unit,
        version.comparison,
        version.createdAt,
        version.updatedAt,
      );
  }

  async upsertVersion(version: HabitVersionEntity): Promise<boolean> {
    if (!(await this.#habitExists(version.habitId))) return false;
    try {
      await this.#database.batch([
        this.#versionInsert(version),
        this.#database
          .prepare("UPDATE daymark_habits SET updated_at = ? WHERE id = ?")
          .bind(version.updatedAt, version.habitId),
      ]);
      return true;
    } catch (error: unknown) {
      if (!(await this.#habitExists(version.habitId))) return false;
      throw error;
    }
  }

  async upsertRecord(record: HabitRecordEntity): Promise<boolean> {
    if (!(await this.#habitExists(record.habitId))) return false;
    try {
      await this.#database
        .prepare(
          "INSERT INTO daymark_records (id, habit_id, record_date, kind, checked, value_milli, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (habit_id, record_date) DO UPDATE SET kind = excluded.kind, checked = excluded.checked, value_milli = excluded.value_milli, updated_at = excluded.updated_at",
        )
        .bind(
          record.id,
          record.habitId,
          record.recordDate,
          record.kind,
          record.checked === null ? null : Number(record.checked),
          record.valueMilli,
          record.createdAt,
          record.updatedAt,
        )
        .run();
      return true;
    } catch (error: unknown) {
      if (!(await this.#habitExists(record.habitId))) return false;
      throw error;
    }
  }

  async deleteRecord(habitId: string, recordDate: string): Promise<boolean> {
    const result = await this.#database
      .prepare("DELETE FROM daymark_records WHERE habit_id = ? AND record_date = ?")
      .bind(habitId, recordDate)
      .run();
    return result.meta.changes > 0;
  }
}

export function createD1DaymarkRepository(database: D1Database): DaymarkRepository {
  return new D1DaymarkRepository(database);
}
