import { describe, expect, it, vi } from "vitest";
import { ActivityService } from "./activity-service";
import type { ActivityRepository } from "./repositories/activity-repository";

describe("ActivityService", () => {
  it("queries the JST window and returns its complete summary", async () => {
    const loadReadActivity = vi.fn<ActivityRepository["loadReadActivity"]>(async () => ({
      totalReadCount: 7,
      days: [
        { date: "2026-09-09", count: 2 },
        { date: "2026-09-10", count: 1 },
      ],
    }));
    const service = new ActivityService(
      { loadReadActivity },
      () => new Date("2026-09-11T03:00:00.000Z"),
    );

    await expect(service.get()).resolves.toMatchObject({
      timeZone: "Asia/Tokyo",
      startDate: "2025-09-12",
      endDate: "2026-09-11",
      totalReadCount: 7,
      currentMonthReadCount: 3,
      currentStreakDays: 2,
    });
    expect(loadReadActivity).toHaveBeenCalledWith({
      startDate: "2025-09-12",
      endDate: "2026-09-11",
      startAt: "2025-09-11T15:00:00.000Z",
      endAtExclusive: "2026-09-11T15:00:00.000Z",
    });
  });
});
