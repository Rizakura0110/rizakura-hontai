import { describe, expect, it, vi } from "vitest";
import { ActivityDataIntegrityError, createD1ActivityRepository } from "./d1-activity-repository";

function database(results: readonly unknown[]) {
  const prepared: Array<{ query: string; values: readonly unknown[] }> = [];
  const binding = {
    prepare(query: string) {
      const statement = { query, values: [] as readonly unknown[] };
      prepared.push(statement);
      return {
        ...statement,
        bind(...values: unknown[]) {
          statement.values = values;
          return statement;
        },
      };
    },
    batch: vi.fn(async () => results),
  } as unknown as D1Database;
  return { binding, prepared };
}

const range = {
  startAt: "2025-09-11T15:00:00.000Z",
  endAtExclusive: "2026-09-11T15:00:00.000Z",
};

describe("D1ActivityRepository", () => {
  it("loads the total and indexed read-date range in one D1 batch", async () => {
    const { binding, prepared } = database([
      { results: [{ total_read_count: 8 }] },
      {
        results: [
          { activity_date: "2026-09-09", read_count: 2 },
          { activity_date: "2026-09-10", read_count: 1 },
        ],
      },
    ]);

    await expect(createD1ActivityRepository(binding).loadReadActivity(range)).resolves.toEqual({
      totalReadCount: 8,
      days: [
        { date: "2026-09-09", count: 2 },
        { date: "2026-09-10", count: 1 },
      ],
    });
    expect(prepared).toHaveLength(2);
    expect(prepared[0]?.query).toContain("status = 'read'");
    expect(prepared[1]?.query).toContain("read_at >= ? AND read_at < ?");
    expect(prepared[1]?.query).toContain("'+9 hours'");
    expect(prepared[1]?.values).toEqual([range.startAt, range.endAtExclusive]);
  });

  it.each([
    [[{ results: [] }, { results: [] }]],
    [[{ results: [{ total_read_count: -1 }] }, { results: [] }]],
    [
      [
        { results: [{ total_read_count: 1 }] },
        { results: [{ activity_date: null, read_count: 1 }] },
      ],
    ],
    [
      [
        { results: [{ total_read_count: 1 }] },
        { results: [{ activity_date: "2026-09-10", read_count: 0 }] },
      ],
    ],
  ])("rejects malformed D1 result rows", async (results) => {
    const { binding } = database(results);
    await expect(
      createD1ActivityRepository(binding).loadReadActivity(range),
    ).rejects.toBeInstanceOf(ActivityDataIntegrityError);
  });
});
