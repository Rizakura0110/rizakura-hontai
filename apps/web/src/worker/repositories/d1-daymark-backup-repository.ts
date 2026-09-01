import type {
  DaymarkBackupImportPlan,
  DaymarkBackupRepository,
} from "@rizakura-hontai/daymark/server";
import { createD1DaymarkRepository } from "./d1-daymark-repository";

function habitInsert(
  database: D1Database,
  plan: DaymarkBackupImportPlan,
): D1PreparedStatement | undefined {
  if (plan.habits.length === 0) return undefined;
  const rows = plan.habits.map((habit) => [
    habit.id,
    habit.name,
    habit.kind,
    habit.createdOn,
    habit.createdAt,
    habit.updatedAt,
  ]);
  return database
    .prepare(
      `INSERT INTO daymark_habits (id, name, kind, created_on, created_at, updated_at)
       SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'),
              json_extract(value, '$[2]'), json_extract(value, '$[3]'),
              json_extract(value, '$[4]'), json_extract(value, '$[5]')
       FROM json_each(?)`,
    )
    .bind(JSON.stringify(rows));
}

function versionInsert(
  database: D1Database,
  plan: DaymarkBackupImportPlan,
): D1PreparedStatement | undefined {
  if (plan.habitVersions.length === 0) return undefined;
  const rows = plan.habitVersions.map((version) => [
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
  ]);
  return database
    .prepare(
      `INSERT INTO daymark_habit_versions (
         id, habit_id, effective_from, kind, status, target_milli, unit, comparison, created_at,
         updated_at
       )
       SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'),
              json_extract(value, '$[2]'), json_extract(value, '$[3]'),
              json_extract(value, '$[4]'), json_extract(value, '$[5]'),
              json_extract(value, '$[6]'), json_extract(value, '$[7]'),
              json_extract(value, '$[8]'), json_extract(value, '$[9]')
       FROM json_each(?)`,
    )
    .bind(JSON.stringify(rows));
}

function recordInsert(
  database: D1Database,
  plan: DaymarkBackupImportPlan,
): D1PreparedStatement | undefined {
  if (plan.records.length === 0) return undefined;
  const rows = plan.records.map((record) => [
    record.id,
    record.habitId,
    record.recordDate,
    record.kind,
    record.checked === null ? null : Number(record.checked),
    record.valueMilli,
    record.createdAt,
    record.updatedAt,
  ]);
  return database
    .prepare(
      `INSERT INTO daymark_records (
         id, habit_id, record_date, kind, checked, value_milli, created_at, updated_at
       )
       SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'),
              json_extract(value, '$[2]'), json_extract(value, '$[3]'),
              json_extract(value, '$[4]'), json_extract(value, '$[5]'),
              json_extract(value, '$[6]'), json_extract(value, '$[7]')
       FROM json_each(?)`,
    )
    .bind(JSON.stringify(rows));
}

class D1DaymarkBackupRepository implements DaymarkBackupRepository {
  readonly #database: D1Database;

  constructor(database: D1Database) {
    this.#database = database;
  }

  async loadSnapshot() {
    const repository = createD1DaymarkRepository(this.#database);
    const [habits, habitVersions, records] = await Promise.all([
      repository.listHabits(),
      repository.listVersions(),
      repository.listRecords("0000-01-01", "9999-12-31"),
    ]);
    return { habits, habitVersions, records };
  }

  async apply(plan: DaymarkBackupImportPlan): Promise<void> {
    const statements = [
      habitInsert(this.#database, plan),
      versionInsert(this.#database, plan),
      recordInsert(this.#database, plan),
    ].filter((statement): statement is D1PreparedStatement => statement !== undefined);
    if (statements.length > 0) await this.#database.batch(statements);
  }
}

export function createD1DaymarkBackupRepository(database: D1Database): DaymarkBackupRepository {
  return new D1DaymarkBackupRepository(database);
}
