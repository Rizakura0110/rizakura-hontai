import type { DaymarkBackupImportPlan, HabitRecordEntity } from "@rizakura-hontai/daymark/server";
import { describe, expect, it, vi } from "vitest";
import { createD1DaymarkBackupRepository } from "./d1-daymark-backup-repository";

const timestamp = "2026-09-01T00:00:00.000Z";

function plan(): DaymarkBackupImportPlan {
  return {
    habits: [
      {
        id: "habit-check",
        name: "水を飲む",
        kind: "check",
        createdOn: "2026-09-01",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    habitVersions: [
      {
        id: "version-check",
        habitId: "habit-check",
        effectiveFrom: "2026-09-01",
        kind: "check",
        status: "active",
        targetMilli: null,
        unit: null,
        comparison: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    records: [
      {
        id: "record-check",
        habitId: "habit-check",
        recordDate: "2026-09-01",
        kind: "check",
        checked: true,
        valueMilli: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    summary: {
      source: {
        schemaVersion: 1,
        exportedAt: timestamp,
        habits: 1,
        habitVersions: 1,
        records: 1,
      },
      changes: {
        habitsCreated: 1,
        habitsMatched: 0,
        habitIdsRemapped: 0,
        habitVersionsCreated: 1,
        habitVersionsMatched: 0,
        habitVersionsSkipped: 0,
        habitVersionIdsRemapped: 0,
        recordsCreated: 1,
        recordsMatched: 0,
        recordsSkipped: 0,
        recordIdsRemapped: 0,
      },
      hasChanges: true,
    },
  };
}

describe("D1DaymarkBackupRepository", () => {
  it("loads all Daymark tables without touching article tables", async () => {
    const queries: string[] = [];
    const database = {
      prepare(query: string) {
        queries.push(query);
        const results = query.includes("FROM daymark_habits ")
          ? [
              {
                id: "habit-check",
                name: "水を飲む",
                kind: "check",
                created_on: "2026-09-01",
                created_at: timestamp,
                updated_at: timestamp,
              },
            ]
          : query.includes("FROM daymark_habit_versions")
            ? [
                {
                  id: "version-check",
                  habit_id: "habit-check",
                  effective_from: "2026-09-01",
                  kind: "check",
                  status: "active",
                  target_milli: null,
                  unit: null,
                  comparison: null,
                  created_at: timestamp,
                  updated_at: timestamp,
                },
              ]
            : [
                {
                  id: "record-check",
                  habit_id: "habit-check",
                  record_date: "2026-09-01",
                  kind: "check",
                  checked: 1,
                  value_milli: null,
                  created_at: timestamp,
                  updated_at: timestamp,
                },
              ];
        const statement = {
          all: async () => ({ results }),
          bind: (...values: unknown[]) => ({
            all: async () => {
              expect(values).toEqual(["0000-01-01", "9999-12-31"]);
              return { results };
            },
          }),
        };
        return statement;
      },
    } as unknown as D1Database;

    await expect(createD1DaymarkBackupRepository(database).loadSnapshot()).resolves.toEqual({
      habits: plan().habits,
      habitVersions: plan().habitVersions,
      records: plan().records,
    });
    expect(queries).toHaveLength(3);
    expect(queries.every((query) => query.includes("daymark_"))).toBe(true);
    expect(queries.some((query) => /\barticles?\b/u.test(query))).toBe(false);
  });

  it("inserts each Daymark table through one ordered JSON batch statement", async () => {
    const statements: Array<{ query: string; values: unknown[] }> = [];
    const batch = vi.fn(async (received: D1PreparedStatement[]) => received.map(() => ({})));
    const database = {
      prepare: (query: string) => ({
        bind: (...values: unknown[]) => {
          const statement = { query, values };
          statements.push(statement);
          return statement;
        },
      }),
      batch,
    } as unknown as D1Database;

    const longTermRecords: readonly HabitRecordEntity[] = [
      plan().records[0] as HabitRecordEntity,
      ...Array.from({ length: 19_999 }, (_, index) => ({
        id: `record-${index + 1}`,
        habitId: "habit-number",
        recordDate: new Date(Date.UTC(2000, 0, 2 + index)).toISOString().slice(0, 10),
        kind: "number" as const,
        checked: null,
        valueMilli: 1_000,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    ];
    const importPlan = {
      ...plan(),
      records: longTermRecords,
    };
    await createD1DaymarkBackupRepository(database).apply(importPlan);

    expect(batch).toHaveBeenCalledOnce();
    expect(batch.mock.calls[0]?.[0]).toHaveLength(3);
    expect(statements.map(({ query }) => query.match(/INSERT INTO (daymark_\w+)/u)?.[1])).toEqual([
      "daymark_habits",
      "daymark_habit_versions",
      "daymark_records",
    ]);
    expect(statements.every(({ query }) => query.includes("json_each(?)"))).toBe(true);
    expect(JSON.parse(String(statements[2]?.values[0]))[0][4]).toBe(1);
    expect(JSON.parse(String(statements[2]?.values[0]))[1][4]).toBeNull();
    expect(JSON.parse(String(statements[2]?.values[0]))).toHaveLength(20_000);
  });

  it("skips an empty plan and surfaces an atomic batch failure without retrying", async () => {
    const batch = vi.fn(async () => Promise.reject(new Error("D1 batch failed")));
    const database = {
      prepare: (query: string) => ({ bind: (...values: unknown[]) => ({ query, values }) }),
      batch,
    } as unknown as D1Database;
    const repository = createD1DaymarkBackupRepository(database);
    const empty = { ...plan(), habits: [], habitVersions: [], records: [] };
    await repository.apply(empty);
    expect(batch).not.toHaveBeenCalled();

    await expect(repository.apply(plan())).rejects.toThrow("D1 batch failed");
    expect(batch).toHaveBeenCalledOnce();
  });
});
