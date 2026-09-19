import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const backupTables = [
  "article_tags",
  "article_urls",
  "articles",
  "d1_migrations",
  "daymark_habit_versions",
  "daymark_habits",
  "daymark_records",
  "tags",
];

export const schemaQuery =
  "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' ORDER BY type, name";

// Canonical row ordering permits comparison without logging private row contents.
export function fingerprintRows(rows) {
  assert.ok(Array.isArray(rows), "The snapshot query must return rows.");
  const canonical = rows
    .map((row) =>
      JSON.stringify(
        Object.keys(row)
          .sort()
          .map((key) => [key, row[key]]),
      ),
    )
    .sort();
  return {
    count: rows.length,
    sha256: createHash("sha256").update(JSON.stringify(canonical)).digest("hex"),
  };
}

export async function snapshotDatabase(query) {
  const objects = await query(schemaQuery);
  const names = objects
    .filter(({ type }) => type === "table")
    .map(({ name }) => name)
    .sort();
  assert.ok(
    JSON.stringify(names) === JSON.stringify(backupTables),
    "The backup must contain all seven product tables and d1_migrations, with no unexpected tables.",
  );
  assert.ok(
    !(await query("PRAGMA foreign_key_check")).length,
    "The backup contains foreign key violations.",
  );
  const integrity = await query("PRAGMA quick_check");
  assert.ok(
    integrity.length === 1 && Object.values(integrity[0])[0] === "ok",
    "The backup failed SQLite quick_check.",
  );
  const tables = {};
  for (const name of backupTables) {
    tables[name] = fingerprintRows(await query(`SELECT * FROM "${name}"`));
  }
  return { version: 1, schema: fingerprintRows(objects), tables };
}

export function assertMatchingSnapshots(expected, actual) {
  assert.ok(expected?.version === 1 && actual?.version === 1, "Unsupported snapshot version.");
  assert.ok(
    JSON.stringify(expected.schema) === JSON.stringify(actual.schema),
    "Backup schema/index definitions do not match the source snapshot.",
  );
  assert.ok(
    JSON.stringify(Object.keys(expected.tables ?? {}).sort()) === JSON.stringify(backupTables),
    "The expected snapshot does not include exactly the required tables.",
  );
  for (const name of backupTables) {
    assert.ok(
      JSON.stringify(expected.tables[name]) === JSON.stringify(actual.tables?.[name]),
      `Backup rows differ for ${name}; values are intentionally not printed.`,
    );
  }
}
