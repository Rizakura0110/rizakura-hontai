import { describe, expect, it } from "vitest";
import { articleActivityResponseSchema } from "./activity";

function response() {
  const days = Array.from({ length: 365 }, (_, index) => {
    const date = new Date(Date.UTC(2025, 8, 12 + index)).toISOString().slice(0, 10);
    return { date, count: index === 364 ? 1 : 0 };
  });
  return {
    timeZone: "Asia/Tokyo",
    startDate: "2025-09-12",
    endDate: "2026-09-11",
    totalReadCount: 3,
    currentMonthReadCount: 1,
    currentStreakDays: 1,
    days,
  } as const;
}

describe("article activity contracts", () => {
  it("accepts a bounded 365-day response", () => {
    expect(articleActivityResponseSchema.parse(response())).toEqual(response());
  });

  it("rejects incorrect bounds, oversized summary values, and unknown fields", () => {
    expect(
      articleActivityResponseSchema.safeParse({ ...response(), startDate: "2025-09-13" }).success,
    ).toBe(false);
    expect(
      articleActivityResponseSchema.safeParse({ ...response(), endDate: "2026-09-10" }).success,
    ).toBe(false);
    expect(
      articleActivityResponseSchema.safeParse({
        ...response(),
        totalReadCount: 0,
        currentMonthReadCount: 1,
      }).success,
    ).toBe(false);
    expect(
      articleActivityResponseSchema.safeParse({ ...response(), secret: "not allowed" }).success,
    ).toBe(false);
  });
});
