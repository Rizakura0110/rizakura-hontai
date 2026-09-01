import type {
  DaymarkBackupImportSummary,
  DaymarkBackupSnapshot,
  DayResponse,
  HabitDto,
  MonthResponse,
  WeekResponse,
} from "@rizakura-hontai/daymark/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { daymarkClient } from "./daymark";

const timestamp = "2026-09-01T00:00:00.000Z";
const habit: HabitDto = {
  id: "habit/water",
  name: "水を飲む",
  createdOn: "2026-09-01",
  configuration: { kind: "check", status: "active", effectiveFrom: "2026-09-01" },
  createdAt: timestamp,
  updatedAt: timestamp,
};
const day: DayResponse = {
  date: "2026-09-01",
  habits: [
    {
      habitId: habit.id,
      name: habit.name,
      date: "2026-09-01",
      configuration: habit.configuration,
      record: { kind: "check", checked: true },
      state: "complete",
    },
  ],
  summary: {
    date: "2026-09-01",
    complete: 1,
    incomplete: 0,
    unentered: 0,
    due: 1,
    rate: 100,
  },
};
const emptySummary = {
  date: "2026-09-01",
  complete: 0,
  incomplete: 0,
  unentered: 0,
  due: 0,
  rate: null,
} as const;
const week: WeekResponse = {
  start: "2026-08-31",
  end: "2026-09-06",
  days: Array.from({ length: 7 }, () => emptySummary),
  habits: [],
  summary: {
    complete: 0,
    incomplete: 0,
    unentered: 0,
    due: 0,
    rate: null,
    perfectDays: 0,
  },
};
const month: MonthResponse = {
  month: "2026-09",
  days: Array.from({ length: 30 }, () => emptySummary),
  summary: {
    complete: 0,
    incomplete: 0,
    unentered: 0,
    due: 0,
    rate: null,
    perfectDays: 0,
  },
};
const backup: DaymarkBackupSnapshot = {
  product: "daymark",
  schemaVersion: 1,
  exportedAt: timestamp,
  habits: [
    {
      id: habit.id,
      name: habit.name,
      kind: "check",
      createdOn: habit.createdOn,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
  habitVersions: [
    {
      id: "version-water",
      habitId: habit.id,
      effectiveFrom: habit.createdOn,
      kind: "check",
      status: "active",
      targetMilli: null,
      unit: null,
      comparison: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
  records: [],
};
const backupSummary: DaymarkBackupImportSummary = {
  source: { schemaVersion: 1, exportedAt: timestamp, habits: 1, habitVersions: 1, records: 0 },
  changes: {
    habitsCreated: 1,
    habitsMatched: 0,
    habitIdsRemapped: 0,
    habitVersionsCreated: 1,
    habitVersionsMatched: 0,
    habitVersionsSkipped: 0,
    habitVersionIdsRemapped: 0,
    recordsCreated: 0,
    recordsMatched: 0,
    recordsSkipped: 0,
    recordIdsRemapped: 0,
  },
  hasChanges: true,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("Daymark API client", () => {
  it("validates all responses and encodes paths and query values", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const path = String(input);
        if (path === "/api/v1/daymark/export") return jsonResponse(backup);
        if (path === "/api/v1/daymark/import/preview") {
          return jsonResponse({ result: "preview", summary: backupSummary });
        }
        if (path === "/api/v1/daymark/import") {
          return jsonResponse({ result: "imported", summary: backupSummary });
        }
        if (path === "/api/v1/daymark/habits" && init?.method === undefined) {
          return jsonResponse({ habits: [habit] });
        }
        if (path === "/api/v1/daymark/habits" && init?.method === "POST") {
          return jsonResponse({ habit }, 201);
        }
        if (path.endsWith("/configurations/2026-09-01")) return jsonResponse({ habit });
        if (path === "/api/v1/daymark/habits/habit%2Fwater" && init?.method === "PATCH") {
          return jsonResponse({ habit });
        }
        if (path === "/api/v1/daymark/day?date=2026-09-01") return jsonResponse(day);
        if (path.endsWith("/records/2026-09-01") && init?.method === "PUT") {
          return jsonResponse(day);
        }
        if (path.endsWith("/records/2026-09-01") && init?.method === "DELETE") {
          return jsonResponse({ result: "deleted" });
        }
        if (path === "/api/v1/daymark/history/week?start=2026-08-31") {
          return jsonResponse(week);
        }
        if (path === "/api/v1/daymark/history/month?month=2026-09") {
          return jsonResponse(month);
        }
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(daymarkClient.listHabits(controller.signal)).resolves.toEqual({ habits: [habit] });
    await expect(daymarkClient.createHabit({ name: habit.name, kind: "check" })).resolves.toEqual(
      habit,
    );
    await expect(daymarkClient.renameHabit(habit.id, "白湯を飲む")).resolves.toEqual(habit);
    await expect(
      daymarkClient.putConfiguration(habit.id, "2026-09-01", {
        kind: "check",
        status: "paused",
      }),
    ).resolves.toEqual(habit);
    await expect(daymarkClient.getDay("2026-09-01")).resolves.toEqual(day);
    await expect(
      daymarkClient.putRecord(habit.id, "2026-09-01", { kind: "check", checked: true }),
    ).resolves.toEqual(day);
    await expect(daymarkClient.deleteRecord(habit.id, "2026-09-01")).resolves.toBeUndefined();
    await expect(daymarkClient.getWeek("2026-08-31")).resolves.toEqual(week);
    await expect(daymarkClient.getMonth("2026-09")).resolves.toEqual(month);
    await expect(daymarkClient.exportBackup()).resolves.toEqual(backup);
    await expect(daymarkClient.previewBackup(backup)).resolves.toEqual({
      result: "preview",
      summary: backupSummary,
    });
    await expect(daymarkClient.importBackup(backup)).resolves.toEqual({
      result: "imported",
      summary: backupSummary,
    });

    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    expect(fetchMock.mock.calls.map(([path]) => String(path))).toContain(
      "/api/v1/daymark/habits/habit%2Fwater/configurations/2026-09-01",
    );
    const bodies = fetchMock.mock.calls
      .filter(([, init]) => init?.body !== undefined)
      .map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies).toEqual([
      { name: "水を飲む", kind: "check" },
      { name: "白湯を飲む" },
      { kind: "check", status: "paused" },
      { kind: "check", checked: true },
      {},
      { backup },
      { backup },
    ]);
  });

  it("rejects a malformed successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ habits: "invalid" })),
    );
    await expect(daymarkClient.listHabits()).rejects.toMatchObject({ name: "ZodError" });
  });
});
