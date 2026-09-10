import { describe, expect, it } from "vitest";
import {
  activityDateInTokyo,
  addActivityDays,
  createReadActivityWindow,
  summarizeReadActivity,
  TECH_INBOX_ACTIVITY_WINDOW_DAYS,
} from "./activity";

describe("Tech Inbox read activity", () => {
  it("creates an inclusive 365-day window at the JST day boundary", () => {
    const beforeMidnight = createReadActivityWindow(new Date("2026-09-10T14:59:59.999Z"));
    const afterMidnight = createReadActivityWindow(new Date("2026-09-10T15:00:00.000Z"));

    expect(beforeMidnight).toEqual({
      startDate: "2025-09-11",
      endDate: "2026-09-10",
      startAt: "2025-09-10T15:00:00.000Z",
      endAtExclusive: "2026-09-10T15:00:00.000Z",
    });
    expect(afterMidnight).toEqual({
      startDate: "2025-09-12",
      endDate: "2026-09-11",
      startAt: "2025-09-11T15:00:00.000Z",
      endAtExclusive: "2026-09-11T15:00:00.000Z",
    });
    expect(activityDateInTokyo(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01");
  });

  it("fills zero days and calculates totals, the current month, and an ongoing streak", () => {
    const window = createReadActivityWindow(new Date("2026-09-11T03:00:00.000Z"));
    const summary = summarizeReadActivity(window, {
      totalReadCount: 10,
      days: [
        { date: "2026-08-31", count: 3 },
        { date: "2026-09-08", count: 2 },
        { date: "2026-09-09", count: 1 },
        { date: "2026-09-10", count: 2 },
        { date: "2026-09-11", count: 1 },
      ],
    });

    expect(summary.days).toHaveLength(TECH_INBOX_ACTIVITY_WINDOW_DAYS);
    expect(summary.days[0]).toEqual({ date: "2025-09-12", count: 0 });
    expect(summary.days.at(-1)).toEqual({ date: "2026-09-11", count: 1 });
    expect(summary).toMatchObject({
      timeZone: "Asia/Tokyo",
      totalReadCount: 10,
      currentMonthReadCount: 6,
      currentStreakDays: 4,
    });
  });

  it("keeps yesterday's streak active until today's first read", () => {
    const window = createReadActivityWindow(new Date("2026-09-11T03:00:00.000Z"));
    const summary = summarizeReadActivity(window, {
      totalReadCount: 2,
      days: [
        { date: "2026-09-09", count: 1 },
        { date: "2026-09-10", count: 1 },
      ],
    });

    expect(summary.currentStreakDays).toBe(2);
    expect(summary.currentMonthReadCount).toBe(2);
  });

  it("returns a zero streak after a full inactive day", () => {
    const window = createReadActivityWindow(new Date("2026-09-11T03:00:00.000Z"));
    expect(
      summarizeReadActivity(window, {
        totalReadCount: 1,
        days: [{ date: "2026-09-08", count: 1 }],
      }).currentStreakDays,
    ).toBe(0);
  });

  it("rejects invalid dates, offsets, clocks, counts, duplicates, and inconsistent totals", () => {
    expect(() => addActivityDays("2026-02-30", 1)).toThrow("real calendar date");
    expect(() => addActivityDays("2026-01-01", 0.5)).toThrow("offset");
    expect(() => activityDateInTokyo(new Date("invalid"))).toThrow("valid instant");
    const window = createReadActivityWindow(new Date("2026-09-11T03:00:00.000Z"));
    expect(() => summarizeReadActivity(window, { totalReadCount: -1, days: [] })).toThrow(
      "non-negative",
    );
    expect(() =>
      summarizeReadActivity(window, {
        totalReadCount: 1,
        days: [{ date: "2026-09-12", count: 1 }],
      }),
    ).toThrow("outside");
    expect(() =>
      summarizeReadActivity(window, {
        totalReadCount: 1,
        days: [{ date: "2026-09-11", count: 0 }],
      }),
    ).toThrow("positive");
    expect(() =>
      summarizeReadActivity(window, {
        totalReadCount: 2,
        days: [
          { date: "2026-09-11", count: 1 },
          { date: "2026-09-11", count: 1 },
        ],
      }),
    ).toThrow("duplicate");
    expect(() =>
      summarizeReadActivity(window, {
        totalReadCount: 1,
        days: [{ date: "2026-09-11", count: 2 }],
      }),
    ).toThrow("must not exceed");
  });
});
