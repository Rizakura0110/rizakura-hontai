import { describe, expect, it } from "vitest";
import {
  assertMatchingSnapshots,
  backupTables,
  fingerprintRows,
  snapshotDatabase,
} from "./d1-backup-snapshot.mjs";

function queryFixture(overrides = {}) {
  return async (sql) => {
    if (sql.startsWith("SELECT type"))
      return (
        overrides.objects ??
        backupTables.map((name) => ({
          type: "table",
          name,
          tbl_name: name,
          sql: `CREATE TABLE ${name} (id text)`,
        }))
      );
    if (sql === "PRAGMA foreign_key_check") return overrides.foreignKeys ?? [];
    if (sql === "PRAGMA quick_check") return overrides.integrity ?? [{ quick_check: "ok" }];
    return [{ id: "fixture", read_at: null, color_hue: 120, value_milli: 1000000000000 }];
  };
}

describe("D1 backup fingerprints", () => {
  it("ignores row and property order, but preserves duplicate rows", () => {
    expect(fingerprintRows([{ a: 1, b: 2 }, { a: null }])).toEqual(
      fingerprintRows([{ a: null }, { b: 2, a: 1 }]),
    );
    expect(fingerprintRows([{ a: 1 }, { a: 1 }])).not.toEqual(fingerprintRows([{ a: 1 }]));
  });
  it.each(["id", "read_at", "color_hue", "value_milli"])(
    "detects a changed %s even when counts match",
    async (field) => {
      const before = await snapshotDatabase(queryFixture());
      const after = structuredClone(before);
      after.tables.articles = fingerprintRows([{ [field]: "changed" }]);
      expect(() => assertMatchingSnapshots(before, after)).toThrow("Backup rows differ");
    },
  );
  it("accepts an exact copy including migration history", async () => {
    const before = await snapshotDatabase(queryFixture());
    expect(() => assertMatchingSnapshots(before, structuredClone(before))).not.toThrow();
  });
  it("rejects schema changes and missing migration history", async () => {
    const before = await snapshotDatabase(queryFixture());
    const after = structuredClone(before);
    after.schema.sha256 = "changed";
    expect(() => assertMatchingSnapshots(before, after)).toThrow("schema/index");
    await expect(snapshotDatabase(queryFixture({ objects: [] }))).rejects.toThrow("all seven");
    delete before.tables.d1_migrations;
    expect(() => assertMatchingSnapshots(before, before)).toThrow("required tables");
  });
  it("rejects foreign key and integrity failures", async () => {
    await expect(
      snapshotDatabase(queryFixture({ foreignKeys: [{ table: "fixture" }] })),
    ).rejects.toThrow("foreign key");
    await expect(
      snapshotDatabase(queryFixture({ integrity: [{ quick_check: "corrupt" }] })),
    ).rejects.toThrow("quick_check");
  });
  it("never includes private field values in mismatch errors", async () => {
    const before = await snapshotDatabase(queryFixture());
    const after = structuredClone(before);
    after.tables.articles = fingerprintRows([{ title: "private-title" }]);
    try {
      assertMatchingSnapshots(before, after);
      expect.fail("A mismatch must fail.");
    } catch (error) {
      expect(String(error)).toContain("Backup rows differ");
      expect(String(error)).not.toContain("private-title");
    }
  });
});
