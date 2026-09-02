import type {
  DaymarkBackupImportPlan,
  DaymarkBackupRepository,
  HabitRecordEntity,
} from "@rizakura-hontai/daymark/server";
import type { DaymarkBackupSnapshot } from "@rizakura-hontai/daymark/contracts";
import { createD1DaymarkRepository } from "./d1-daymark-repository";

export const DAYMARK_BACKUP_D1_BOUND_VALUE_BYTES = 1_000_000;
export const DAYMARK_BACKUP_D1_MAX_WRITE_STATEMENTS = 47;

const textEncoder = new TextEncoder();

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

async function loadScopedRecords(
  database: D1Database,
  scope: DaymarkBackupSnapshot,
): Promise<readonly HabitRecordEntity[]> {
  if (scope.records.length === 0) return [];
  const naturalKeys = JSON.stringify(
    scope.records.map(({ habitId, recordDate }) => [habitId, recordDate]),
  );
  const ids = JSON.stringify(scope.records.map(({ id }) => id));
  const result = await database
    .prepare(
      `WITH requested(habit_id, record_date) AS (
         SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(?)
       ), requested_ids(id) AS (SELECT value FROM json_each(?))
       SELECT records.id, records.habit_id, records.record_date, records.kind, records.checked,
              records.value_milli, records.created_at, records.updated_at
       FROM requested
       INNER JOIN daymark_records AS records
         ON records.habit_id = requested.habit_id AND records.record_date = requested.record_date
       UNION
       SELECT records.id, records.habit_id, records.record_date, records.kind, records.checked,
              records.value_milli, records.created_at, records.updated_at
       FROM requested_ids
       INNER JOIN daymark_records AS records ON records.id = requested_ids.id
       ORDER BY record_date, habit_id`,
    )
    .bind(naturalKeys, ids)
    .all<RecordRow>();
  return result.results.map(mapRecord);
}

function serializeRowChunks(rows: readonly (readonly unknown[])[]): readonly string[] {
  const chunks: string[] = [];
  let serializedRows: string[] = [];
  let chunkBytes = 2;

  for (const row of rows) {
    const serialized = JSON.stringify(row);
    const rowBytes = textEncoder.encode(serialized).byteLength;
    if (rowBytes + 2 > DAYMARK_BACKUP_D1_BOUND_VALUE_BYTES) {
      throw new Error("A Daymark backup row exceeds the D1 bound value budget.");
    }
    const nextBytes = chunkBytes + (serializedRows.length === 0 ? 0 : 1) + rowBytes;
    if (nextBytes > DAYMARK_BACKUP_D1_BOUND_VALUE_BYTES) {
      chunks.push(`[${serializedRows.join(",")}]`);
      serializedRows = [serialized];
      chunkBytes = rowBytes + 2;
    } else {
      serializedRows.push(serialized);
      chunkBytes = nextBytes;
    }
  }

  if (serializedRows.length > 0) chunks.push(`[${serializedRows.join(",")}]`);
  return chunks;
}

function chunkedInserts(
  database: D1Database,
  query: string,
  rows: readonly (readonly unknown[])[],
): readonly D1PreparedStatement[] {
  return serializeRowChunks(rows).map((chunk) => database.prepare(query).bind(chunk));
}

function habitInsert(
  database: D1Database,
  plan: DaymarkBackupImportPlan,
): readonly D1PreparedStatement[] {
  const rows = plan.habits.map((habit) => [
    habit.id,
    habit.name,
    habit.kind,
    habit.createdOn,
    habit.createdAt,
    habit.updatedAt,
  ]);
  return chunkedInserts(
    database,
    `INSERT INTO daymark_habits (id, name, kind, created_on, created_at, updated_at)
       SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'),
              json_extract(value, '$[2]'), json_extract(value, '$[3]'),
              json_extract(value, '$[4]'), json_extract(value, '$[5]')
       FROM json_each(?)`,
    rows,
  );
}

function versionInsert(
  database: D1Database,
  plan: DaymarkBackupImportPlan,
): readonly D1PreparedStatement[] {
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
  return chunkedInserts(
    database,
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
    rows,
  );
}

function recordInsert(
  database: D1Database,
  plan: DaymarkBackupImportPlan,
): readonly D1PreparedStatement[] {
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
  return chunkedInserts(
    database,
    `INSERT INTO daymark_records (
         id, habit_id, record_date, kind, checked, value_milli, created_at, updated_at
       )
       SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'),
              json_extract(value, '$[2]'), json_extract(value, '$[3]'),
              json_extract(value, '$[4]'), json_extract(value, '$[5]'),
              json_extract(value, '$[6]'), json_extract(value, '$[7]')
       FROM json_each(?)`,
    rows,
  );
}

class D1DaymarkBackupRepository implements DaymarkBackupRepository {
  readonly #database: D1Database;

  constructor(database: D1Database) {
    this.#database = database;
  }

  async loadSnapshot(scope?: DaymarkBackupSnapshot) {
    const repository = createD1DaymarkRepository(this.#database);
    const [habits, habitVersions, records] = await Promise.all([
      repository.listHabits(),
      repository.listVersions(),
      scope === undefined
        ? repository.listRecords("0000-01-01", "9999-12-31")
        : loadScopedRecords(this.#database, scope),
    ]);
    return { habits, habitVersions, records };
  }

  async apply(plan: DaymarkBackupImportPlan): Promise<void> {
    const statements = [
      ...habitInsert(this.#database, plan),
      ...versionInsert(this.#database, plan),
      ...recordInsert(this.#database, plan),
    ];
    if (statements.length > DAYMARK_BACKUP_D1_MAX_WRITE_STATEMENTS) {
      throw new Error("Daymark backup restore exceeds the D1 query budget.");
    }
    if (statements.length > 0) await this.#database.batch(statements);
  }
}

export function createD1DaymarkBackupRepository(database: D1Database): DaymarkBackupRepository {
  return new D1DaymarkBackupRepository(database);
}
