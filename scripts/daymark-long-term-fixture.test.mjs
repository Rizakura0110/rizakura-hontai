import { describe, expect, it } from "vitest";
import {
  buildLongTermDaymarkBackup,
  PHASE25_DAYMARK_RECORD_COUNT,
} from "./daymark-long-term-fixture.mjs";

describe("Phase 25 Daymark long-term fixture", () => {
  it("builds the same 10-habit and 10,950-record shape used by the integration gate", () => {
    const backup = buildLongTermDaymarkBackup({ exportedAt: "2026-09-02T00:00:00.000Z" });

    expect(backup.product).toBe("daymark");
    expect(backup.schemaVersion).toBe(1);
    expect(backup.habits).toHaveLength(10);
    expect(backup.habitVersions).toHaveLength(10);
    expect(backup.records).toHaveLength(PHASE25_DAYMARK_RECORD_COUNT);
    expect(new Set(backup.records.map(({ id }) => id)).size).toBe(PHASE25_DAYMARK_RECORD_COUNT);
    expect(Buffer.byteLength(`${JSON.stringify(backup, null, 2)}\n`)).toBeLessThan(4 * 1024 * 1024);
  });

  it.each([0, 20_001, 1.5])("rejects an unsupported record count: %s", (recordCount) => {
    expect(() =>
      buildLongTermDaymarkBackup({
        exportedAt: "2026-09-02T00:00:00.000Z",
        recordCount,
      }),
    ).toThrow("recordCount must be an integer between 1 and 20,000.");
  });

  it("rejects an invalid export timestamp", () => {
    expect(() => buildLongTermDaymarkBackup({ exportedAt: "not-a-timestamp" })).toThrow(
      "exportedAt must be an ISO-compatible timestamp.",
    );
  });
});
