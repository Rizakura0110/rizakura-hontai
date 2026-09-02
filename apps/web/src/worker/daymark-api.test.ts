import type {
  DaymarkBackupImportPlan,
  HabitEntity,
  HabitRecordEntity,
  HabitVersionEntity,
} from "@rizakura-hontai/daymark/server";
import type { DaymarkBackupSnapshot } from "@rizakura-hontai/daymark/contracts";
import { describe, expect, it, vi } from "vitest";
import { createApp, type AppBindings } from "./app";
import { daymarkRoutePolicy } from "./daymark-api";
import { ApiError } from "./platform/errors";

const origin = "https://app.invalid";
const timestamp = "2026-09-01T03:00:00.000Z";
const principal = {
  subject: "fixture",
  email: "fixture@example.invalid",
  provider: "cloudflare-access" as const,
};
const bindings = { ENVIRONMENT: "production", APP_ORIGIN: origin } as AppBindings;
const mutationHeaders = {
  "Content-Type": "application/json",
  Origin: origin,
  "X-Rizakura-Hontai-Client": "web",
};

class MemoryDaymarkRepository {
  habits: HabitEntity[] = [];
  versions: HabitVersionEntity[] = [];
  records: HabitRecordEntity[] = [];

  async listHabits() {
    return this.habits;
  }

  async listVersions() {
    return this.versions;
  }

  async listRecords(start: string, end: string) {
    return this.records.filter(({ recordDate }) => recordDate >= start && recordDate <= end);
  }

  async createHabit(habit: HabitEntity, version: HabitVersionEntity) {
    this.habits.push(habit);
    this.versions.push(version);
  }

  async updateHabitName(id: string, name: string, updatedAt: string) {
    const habit = this.habits.find((candidate) => candidate.id === id);
    if (habit === undefined) return false;
    this.habits[this.habits.indexOf(habit)] = { ...habit, name, updatedAt };
    return true;
  }

  async upsertVersion(version: HabitVersionEntity) {
    if (!this.habits.some(({ id }) => id === version.habitId)) return false;
    const existing = this.versions.find(
      (candidate) =>
        candidate.habitId === version.habitId && candidate.effectiveFrom === version.effectiveFrom,
    );
    if (existing === undefined) this.versions.push(version);
    else this.versions[this.versions.indexOf(existing)] = { ...version, id: existing.id };
    return true;
  }

  async upsertRecord(record: HabitRecordEntity) {
    if (!this.habits.some(({ id }) => id === record.habitId)) return false;
    const existing = this.records.find(
      (candidate) =>
        candidate.habitId === record.habitId && candidate.recordDate === record.recordDate,
    );
    if (existing === undefined) this.records.push(record);
    else this.records[this.records.indexOf(existing)] = { ...record, id: existing.id };
    return true;
  }

  async deleteRecord(habitId: string, recordDate: string) {
    const before = this.records.length;
    this.records = this.records.filter(
      (record) => record.habitId !== habitId || record.recordDate !== recordDate,
    );
    return before !== this.records.length;
  }

  async loadSnapshot() {
    return {
      habits: this.habits,
      habitVersions: this.versions,
      records: this.records,
    };
  }

  async apply(plan: DaymarkBackupImportPlan) {
    this.habits.push(...plan.habits);
    this.versions.push(...plan.habitVersions);
    this.records.push(...plan.records);
  }
}

const createFixture = () => {
  const repository = new MemoryDaymarkRepository();
  let id = 0;
  const enforceRateLimit = vi.fn(async () => undefined);
  const log = vi.fn();
  const app = createApp({
    authenticateAccess: async () => principal,
    enforceRateLimit,
    log,
    daymarkRepositoryFactory: () => repository,
    daymarkBackupRepositoryFactory: () => repository,
    clock: () => new Date("2026-09-01T03:00:00.000Z"),
    idGenerator: () => {
      id += 1;
      return `daymark-${id}`;
    },
  });
  return { app, repository, enforceRateLimit, log };
};

const jsonRequest = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: mutationHeaders,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("Daymark shared protection and routing", () => {
  it.each(["GET", "HEAD"])("rejects unauthenticated %s", async (method) => {
    const enforceRateLimit = vi.fn();
    const app = createApp({
      authenticateAccess: async () => {
        throw new ApiError(401, "UNAUTHORIZED", "認証が必要です。");
      },
      enforceRateLimit,
      log: () => undefined,
    });
    const response = await app.request(`${origin}/api/v1/daymark/status`, { method }, bindings);
    expect(response.status).toBe(401);
    expect(enforceRateLimit).not.toHaveBeenCalled();
  });

  it("returns ready metadata through the shared read limiter", async () => {
    const { app, enforceRateLimit, log } = createFixture();
    const response = await app.request(`${origin}/api/v1/daymark/status`, undefined, bindings);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(enforceRateLimit).toHaveBeenCalledWith(bindings, principal, "read");
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ route: "daymark.status", status: 200 }),
    );
    await expect(response.json()).resolves.toEqual({
      product: "daymark",
      status: "ready",
      timeZone: "Asia/Tokyo",
    });
  });

  it("classifies only known Daymark methods and paths", () => {
    expect(daymarkRoutePolicy("HEAD", "/api/v1/daymark/habits")).toEqual({
      name: "daymark.habits.list",
      rateLimit: "read",
    });
    expect(daymarkRoutePolicy("POST", "/api/v1/daymark/habits")?.rateLimit).toBe("mutate");
    expect(daymarkRoutePolicy("GET", "/api/v1/daymark/export")).toEqual({
      name: "daymark.export.get",
      rateLimit: "export",
    });
    expect(daymarkRoutePolicy("POST", "/api/v1/daymark/import/preview")).toEqual({
      name: "daymark.import.preview",
      rateLimit: "read",
    });
    expect(daymarkRoutePolicy("POST", "/api/v1/daymark/import")).toEqual({
      name: "daymark.import.apply",
      rateLimit: "mutate",
    });
    expect(
      daymarkRoutePolicy("PUT", "/api/v1/daymark/habits/a/configurations/2026-09-01")?.name,
    ).toBe("daymark.habits.configure");
    expect(daymarkRoutePolicy("PATCH", "/api/v1/daymark/habits/a")?.name).toBe(
      "daymark.habits.rename",
    );
    expect(daymarkRoutePolicy("GET", "/api/v1/daymark/day")?.name).toBe("daymark.day.get");
    expect(daymarkRoutePolicy("GET", "/api/v1/daymark/history/week")?.name).toBe(
      "daymark.history.week",
    );
    expect(daymarkRoutePolicy("GET", "/api/v1/daymark/history/month")?.name).toBe(
      "daymark.history.month",
    );
    expect(daymarkRoutePolicy("PUT", "/api/v1/daymark/habits/a/records/2026-09-01")?.name).toBe(
      "daymark.records.put",
    );
    expect(daymarkRoutePolicy("DELETE", "/api/v1/daymark/habits/a/records/2026-09-01")?.name).toBe(
      "daymark.records.delete",
    );
    expect(daymarkRoutePolicy("POST", "/api/v1/daymark/status")).toBeUndefined();
    expect(daymarkRoutePolicy("GET", "/api/v1/articles")).toBeUndefined();
  });
});

describe("Daymark habit API", () => {
  it("creates, lists, renames, records, clears, and aggregates a habit", async () => {
    const { app, enforceRateLimit } = createFixture();
    const createdResponse = await app.request(
      `${origin}/api/v1/daymark/habits`,
      jsonRequest("POST", {
        name: "本を読む",
        kind: "number",
        target: 30,
        unit: "分",
        comparison: "at_least",
      }),
      bindings,
    );
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()) as { habit: { id: string } };
    expect(enforceRateLimit).toHaveBeenLastCalledWith(bindings, principal, "mutate");

    const listed = await app.request(`${origin}/api/v1/daymark/habits`, undefined, bindings);
    expect(listed.status).toBe(200);
    expect(((await listed.json()) as { habits: unknown[] }).habits).toHaveLength(1);

    const renamed = await app.request(
      `${origin}/api/v1/daymark/habits/${created.habit.id}`,
      jsonRequest("PATCH", { name: "技術書を読む" }),
      bindings,
    );
    expect(((await renamed.json()) as { habit: { name: string } }).habit.name).toBe("技術書を読む");

    const recorded = await app.request(
      `${origin}/api/v1/daymark/habits/${created.habit.id}/records/2026-09-01`,
      jsonRequest("PUT", { kind: "number", value: 30 }),
      bindings,
    );
    expect(((await recorded.json()) as { summary: { rate: number } }).summary.rate).toBe(100);

    const day = await app.request(
      `${origin}/api/v1/daymark/day?date=2026-09-01`,
      undefined,
      bindings,
    );
    expect(((await day.json()) as { habits: Array<{ state: string }> }).habits[0]?.state).toBe(
      "complete",
    );

    const week = await app.request(
      `${origin}/api/v1/daymark/history/week?start=2026-08-31`,
      undefined,
      bindings,
    );
    expect(((await week.json()) as { days: unknown[] }).days).toHaveLength(7);
    const month = await app.request(
      `${origin}/api/v1/daymark/history/month?month=2026-09`,
      undefined,
      bindings,
    );
    expect(((await month.json()) as { days: unknown[] }).days).toHaveLength(30);

    const deleted = await app.request(
      `${origin}/api/v1/daymark/habits/${created.habit.id}/records/2026-09-01`,
      jsonRequest("DELETE"),
      bindings,
    );
    await expect(deleted.json()).resolves.toEqual({ result: "deleted" });
  });

  it("applies a non-retroactive pause and maps domain failures safely", async () => {
    const { app } = createFixture();
    const created = (await (
      await app.request(
        `${origin}/api/v1/daymark/habits`,
        jsonRequest("POST", { name: "運動", kind: "check" }),
        bindings,
      )
    ).json()) as { habit: { id: string } };
    const configured = await app.request(
      `${origin}/api/v1/daymark/habits/${created.habit.id}/configurations/2026-09-01`,
      jsonRequest("PUT", { kind: "check", status: "paused" }),
      bindings,
    );
    expect(configured.status).toBe(200);
    const conflict = await app.request(
      `${origin}/api/v1/daymark/habits/${created.habit.id}/records/2026-09-01`,
      jsonRequest("PUT", { kind: "check", checked: true }),
      bindings,
    );
    expect(conflict.status).toBe(409);
    expect((await conflict.json()) as object).toMatchObject({
      error: { code: "DAYMARK_CONFLICT" },
    });
    const retroactive = await app.request(
      `${origin}/api/v1/daymark/habits/${created.habit.id}/configurations/2026-08-31`,
      jsonRequest("PUT", { kind: "check", status: "active" }),
      bindings,
    );
    expect(retroactive.status).toBe(400);
    const missing = await app.request(
      `${origin}/api/v1/daymark/habits/missing`,
      jsonRequest("PATCH", { name: "なし" }),
      bindings,
    );
    expect(missing.status).toBe(404);
  });

  it("rejects malformed bodies, dates, duplicate queries, and invalid mutation headers", async () => {
    const { app } = createFixture();
    expect(
      (
        await app.request(
          `${origin}/api/v1/daymark/habits`,
          jsonRequest("POST", { name: "", kind: "check" }),
          bindings,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          `${origin}/api/v1/daymark/day?date=2026-09-01&date=2026-09-01`,
          undefined,
          bindings,
        )
      ).status,
    ).toBe(400);
    expect(
      (await app.request(`${origin}/api/v1/daymark/day?date=invalid`, undefined, bindings)).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          `${origin}/api/v1/daymark/habits`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Origin: "https://other.invalid" },
            body: JSON.stringify({ name: "運動", kind: "check" }),
          },
          bindings,
        )
      ).status,
    ).toBe(403);
  });
});

describe("Daymark product backup API", () => {
  it("exports, previews, imports, and repeats without changing Tech Inbox data", async () => {
    const source = createFixture();
    const created = (await (
      await source.app.request(
        `${origin}/api/v1/daymark/habits`,
        jsonRequest("POST", { name: "水を飲む", kind: "check" }),
        bindings,
      )
    ).json()) as { habit: { id: string } };
    await source.app.request(
      `${origin}/api/v1/daymark/habits/${created.habit.id}/records/2026-09-01`,
      jsonRequest("PUT", { kind: "check", checked: true }),
      bindings,
    );
    const exported = await source.app.request(
      `${origin}/api/v1/daymark/export`,
      undefined,
      bindings,
    );
    expect(exported.status).toBe(200);
    expect(exported.headers.get("content-disposition")).toBe(
      'attachment; filename="daymark-export-2026-09-01.json"',
    );
    const backup = (await exported.json()) as DaymarkBackupSnapshot;
    expect(backup).toMatchObject({
      product: "daymark",
      schemaVersion: 1,
      habits: [{ name: "水を飲む" }],
      records: [{ checked: true }],
    });
    expect(backup).not.toHaveProperty("articles");

    const target = createFixture();
    const preview = await target.app.request(
      `${origin}/api/v1/daymark/import/preview`,
      jsonRequest("POST", { backup }),
      bindings,
    );
    expect(preview.status).toBe(200);
    await expect(preview.json()).resolves.toMatchObject({
      result: "preview",
      summary: {
        changes: { habitsCreated: 1, habitVersionsCreated: 1, recordsCreated: 1 },
        hasChanges: true,
      },
    });
    expect(target.repository.habits).toHaveLength(0);

    const applied = await target.app.request(
      `${origin}/api/v1/daymark/import`,
      jsonRequest("POST", { backup }),
      bindings,
    );
    expect(applied.status).toBe(200);
    expect(target.repository.habits).toHaveLength(1);
    expect(target.repository.versions).toHaveLength(1);
    expect(target.repository.records).toHaveLength(1);

    const repeated = await target.app.request(
      `${origin}/api/v1/daymark/import/preview`,
      jsonRequest("POST", { backup }),
      bindings,
    );
    await expect(repeated.json()).resolves.toMatchObject({
      summary: {
        changes: { habitsMatched: 1, habitVersionsMatched: 1, recordsMatched: 1 },
        hasChanges: false,
      },
    });
    expect(target.enforceRateLimit).toHaveBeenCalledWith(bindings, principal, "read");
    expect(target.enforceRateLimit).toHaveBeenCalledWith(bindings, principal, "mutate");
  });

  it("rejects a Tech Inbox backup before opening Daymark storage", async () => {
    const repository = new MemoryDaymarkRepository();
    const loadSnapshot = vi.spyOn(repository, "loadSnapshot");
    const app = createApp({
      authenticateAccess: async () => principal,
      enforceRateLimit: async () => undefined,
      log: () => undefined,
      daymarkBackupRepositoryFactory: () => repository,
    });
    const response = await app.request(
      `${origin}/api/v1/daymark/import/preview`,
      jsonRequest("POST", {
        backup: {
          schemaVersion: 2,
          exportedAt: timestamp,
          articles: [],
          articleUrls: [],
          tags: [],
          articleTags: [],
        },
      }),
      bindings,
    );
    expect(response.status).toBe(400);
    expect(loadSnapshot).not.toHaveBeenCalled();
  });
});
