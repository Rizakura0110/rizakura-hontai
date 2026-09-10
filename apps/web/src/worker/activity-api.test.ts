import { articleActivityResponseSchema } from "@rizakura-hontai/contracts";
import { describe, expect, it, vi } from "vitest";
import { createApp, type AppBindings, type RequestLogEvent } from "./app";
import type { ActivityRepository } from "./repositories/activity-repository";

const origin = "http://localhost";

function localBindings(): AppBindings {
  const allow = { limit: async () => ({ success: true }) } as RateLimit;
  return {
    DB: {} as D1Database,
    ASSETS: {} as Fetcher,
    METADATA_QUEUE: {} as Queue,
    METADATA_FETCHER: {} as Fetcher,
    RATE_LIMIT_CREATE: allow,
    RATE_LIMIT_RETRY: allow,
    RATE_LIMIT_MUTATE: allow,
    RATE_LIMIT_READ: allow,
    RATE_LIMIT_EXPORT: allow,
    ENVIRONMENT: "local",
    APP_ORIGIN: origin,
  };
}

describe("activity API", () => {
  it("returns a protected, no-store, schema-valid JST activity summary", async () => {
    const events: RequestLogEvent[] = [];
    const loadReadActivity = vi.fn<ActivityRepository["loadReadActivity"]>(async () => ({
      totalReadCount: 5,
      days: [
        { date: "2026-09-09", count: 2 },
        { date: "2026-09-10", count: 1 },
        { date: "2026-09-11", count: 1 },
      ],
    }));
    const app = createApp({
      activityRepositoryFactory: () => ({ loadReadActivity }),
      clock: () => new Date("2026-09-11T03:00:00.000Z"),
      log: (event) => events.push(event),
    });

    const response = await app.request(`${origin}/api/v1/activity`, undefined, localBindings());
    const body = articleActivityResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      timeZone: "Asia/Tokyo",
      startDate: "2025-09-12",
      endDate: "2026-09-11",
      totalReadCount: 5,
      currentMonthReadCount: 4,
      currentStreakDays: 3,
    });
    expect(body.days).toHaveLength(365);
    expect(loadReadActivity).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      expect.objectContaining({ route: "activity.get", method: "GET", status: 200 }),
    ]);
  });

  it("authenticates before loading private activity data", async () => {
    const activityRepositoryFactory = vi.fn(
      (): ActivityRepository => ({
        loadReadActivity: async () => ({ totalReadCount: 0, days: [] }),
      }),
    );
    const app = createApp({ activityRepositoryFactory, log: () => undefined });

    const response = await app.request(`${origin}/api/v1/activity`, undefined, {
      ...localBindings(),
      ENVIRONMENT: "production",
    });

    expect(response.status).toBe(403);
    expect(activityRepositoryFactory).not.toHaveBeenCalled();
  });
});
