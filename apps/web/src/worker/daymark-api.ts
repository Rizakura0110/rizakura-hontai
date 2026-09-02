import {
  createHabitRequestSchema,
  daymarkBackupImportRequestSchema,
  type DaymarkBackupImportPreviewResponse,
  type DaymarkBackupImportResponse,
  type DaymarkBackupSnapshot,
  daymarkDateQuerySchema,
  daymarkHabitDateParamsSchema,
  daymarkHabitParamsSchema,
  daymarkMonthQuerySchema,
  daymarkWeekQuerySchema,
  type DeleteHabitRecordResponse,
  type DayResponse,
  type HabitResponse,
  type ListHabitsResponse,
  type MonthResponse,
  MAX_DAYMARK_BACKUP_IMPORT_BYTES,
  putHabitConfigurationRequestSchema,
  putHabitRecordRequestSchema,
  renameHabitRequestSchema,
  type WeekResponse,
} from "@rizakura-hontai/daymark/contracts";
import {
  DaymarkBackupService,
  DaymarkError,
  DaymarkService,
  getDaymarkConnectionStatus,
  type DaymarkClock,
  type DaymarkBackupRepository,
  type DaymarkIdGenerator,
  type DaymarkRepository,
} from "@rizakura-hontai/daymark/server";
import { Hono, type Context } from "hono";
import type { AppBindings } from "./bindings";
import type { ApiEnvironment, ApiRoutePolicy } from "./platform/api";
import { ApiError, validationError } from "./platform/errors";
import { parseQuery, parseWithSchema, readJsonBody } from "./platform/request-validation";
import { createD1DaymarkRepository } from "./repositories/d1-daymark-repository";
import { createD1DaymarkBackupRepository } from "./repositories/d1-daymark-backup-repository";

type AppEnvironment = ApiEnvironment<AppBindings>;

export type DaymarkDependencies = {
  readonly daymarkRepositoryFactory: (bindings: AppBindings) => DaymarkRepository;
  readonly daymarkBackupRepositoryFactory: (bindings: AppBindings) => DaymarkBackupRepository;
  readonly clock: DaymarkClock;
  readonly idGenerator: DaymarkIdGenerator;
};

export const defaultDaymarkDependencies: DaymarkDependencies = {
  daymarkRepositoryFactory: (bindings) => createD1DaymarkRepository(bindings.DB),
  daymarkBackupRepositoryFactory: (bindings) => createD1DaymarkBackupRepository(bindings.DB),
  clock: () => new Date(),
  idGenerator: () => crypto.randomUUID(),
};

const daymarkRoutePattern = /^\/api\/v1\/daymark(?:\/|$)/u;

export function daymarkRoutePolicy(method: string, pathname: string): ApiRoutePolicy | undefined {
  if (!daymarkRoutePattern.test(pathname)) return undefined;
  const normalizedMethod = method === "HEAD" ? "GET" : method;
  if (normalizedMethod === "GET" && pathname === "/api/v1/daymark/status") {
    return { name: "daymark.status", rateLimit: "read" };
  }
  if (normalizedMethod === "GET" && pathname === "/api/v1/daymark/habits") {
    return { name: "daymark.habits.list", rateLimit: "read" };
  }
  if (normalizedMethod === "GET" && pathname === "/api/v1/daymark/export") {
    return { name: "daymark.export.get", rateLimit: "export" };
  }
  if (normalizedMethod === "POST" && pathname === "/api/v1/daymark/import/preview") {
    return { name: "daymark.import.preview", rateLimit: "read" };
  }
  if (normalizedMethod === "POST" && pathname === "/api/v1/daymark/import") {
    return { name: "daymark.import.apply", rateLimit: "mutate" };
  }
  if (normalizedMethod === "POST" && pathname === "/api/v1/daymark/habits") {
    return { name: "daymark.habits.create", rateLimit: "mutate" };
  }
  if (normalizedMethod === "GET" && pathname === "/api/v1/daymark/day") {
    return { name: "daymark.day.get", rateLimit: "read" };
  }
  if (normalizedMethod === "GET" && pathname === "/api/v1/daymark/history/week") {
    return { name: "daymark.history.week", rateLimit: "read" };
  }
  if (normalizedMethod === "GET" && pathname === "/api/v1/daymark/history/month") {
    return { name: "daymark.history.month", rateLimit: "read" };
  }
  if (/^\/api\/v1\/daymark\/habits\/[^/]+$/u.test(pathname) && normalizedMethod === "PATCH") {
    return { name: "daymark.habits.rename", rateLimit: "mutate" };
  }
  if (
    /^\/api\/v1\/daymark\/habits\/[^/]+\/configurations\/[^/]+$/u.test(pathname) &&
    normalizedMethod === "PUT"
  ) {
    return { name: "daymark.habits.configure", rateLimit: "mutate" };
  }
  if (/^\/api\/v1\/daymark\/habits\/[^/]+\/records\/[^/]+$/u.test(pathname)) {
    if (normalizedMethod === "PUT") return { name: "daymark.records.put", rateLimit: "mutate" };
    if (normalizedMethod === "DELETE") {
      return { name: "daymark.records.delete", rateLimit: "mutate" };
    }
  }
  return undefined;
}

function service(context: Context<AppEnvironment>, dependencies: DaymarkDependencies) {
  return new DaymarkService(
    dependencies.daymarkRepositoryFactory(context.env),
    dependencies.clock,
    dependencies.idGenerator,
  );
}

function backupService(context: Context<AppEnvironment>, dependencies: DaymarkDependencies) {
  return new DaymarkBackupService(
    dependencies.daymarkBackupRepositoryFactory(context.env),
    dependencies.clock,
    dependencies.idGenerator,
  );
}

async function daymarkResult<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (!(error instanceof DaymarkError)) throw error;
    if (error.code === "VALIDATION_ERROR") throw validationError(error.message);
    if (error.code === "NOT_FOUND") throw new ApiError(404, "NOT_FOUND", error.message);
    throw new ApiError(409, "DAYMARK_CONFLICT", error.message);
  }
}

export function createDaymarkApi(dependencies: DaymarkDependencies) {
  const app = new Hono<AppEnvironment>();
  app.get("/v1/daymark/status", (context) => context.json(getDaymarkConnectionStatus()));
  app.get("/v1/daymark/export", async (context) => {
    const response = await daymarkResult(() => backupService(context, dependencies).exportAll());
    context.header(
      "Content-Disposition",
      `attachment; filename="daymark-export-${response.exportedAt.slice(0, 10)}.json"`,
    );
    return context.json<DaymarkBackupSnapshot>(response);
  });
  app.post("/v1/daymark/import/preview", async (context) => {
    const request = parseWithSchema(
      daymarkBackupImportRequestSchema,
      await readJsonBody(context.req.raw, MAX_DAYMARK_BACKUP_IMPORT_BYTES),
    );
    return context.json<DaymarkBackupImportPreviewResponse>(
      await daymarkResult(() => backupService(context, dependencies).preview(request)),
    );
  });
  app.post("/v1/daymark/import", async (context) => {
    const request = parseWithSchema(
      daymarkBackupImportRequestSchema,
      await readJsonBody(context.req.raw, MAX_DAYMARK_BACKUP_IMPORT_BYTES),
    );
    return context.json<DaymarkBackupImportResponse>(
      await daymarkResult(() => backupService(context, dependencies).apply(request)),
    );
  });
  app.get("/v1/daymark/habits", async (context) =>
    context.json<ListHabitsResponse>(
      await daymarkResult(() => service(context, dependencies).listHabits()),
    ),
  );
  app.post("/v1/daymark/habits", async (context) => {
    const request = parseWithSchema(createHabitRequestSchema, await readJsonBody(context.req.raw));
    return context.json<HabitResponse>(
      await daymarkResult(() => service(context, dependencies).createHabit(request)),
      201,
    );
  });
  app.patch("/v1/daymark/habits/:id", async (context) => {
    const { id } = parseWithSchema(daymarkHabitParamsSchema, context.req.param());
    const request = parseWithSchema(renameHabitRequestSchema, await readJsonBody(context.req.raw));
    return context.json<HabitResponse>(
      await daymarkResult(() => service(context, dependencies).renameHabit(id, request)),
    );
  });
  app.put("/v1/daymark/habits/:id/configurations/:date", async (context) => {
    const { id, date } = parseWithSchema(daymarkHabitDateParamsSchema, context.req.param());
    const request = parseWithSchema(
      putHabitConfigurationRequestSchema,
      await readJsonBody(context.req.raw),
    );
    return context.json<HabitResponse>(
      await daymarkResult(() => service(context, dependencies).putConfiguration(id, date, request)),
    );
  });
  app.get("/v1/daymark/day", async (context) => {
    const { date } = parseWithSchema(
      daymarkDateQuerySchema,
      parseQuery(new URL(context.req.url).searchParams),
    );
    return context.json<DayResponse>(
      await daymarkResult(() => service(context, dependencies).getDay(date)),
    );
  });
  app.put("/v1/daymark/habits/:id/records/:date", async (context) => {
    const { id, date } = parseWithSchema(daymarkHabitDateParamsSchema, context.req.param());
    const request = parseWithSchema(
      putHabitRecordRequestSchema,
      await readJsonBody(context.req.raw),
    );
    return context.json<DayResponse>(
      await daymarkResult(() => service(context, dependencies).putRecord(id, date, request)),
    );
  });
  app.delete("/v1/daymark/habits/:id/records/:date", async (context) => {
    const { id, date } = parseWithSchema(daymarkHabitDateParamsSchema, context.req.param());
    await daymarkResult(() => service(context, dependencies).deleteRecord(id, date));
    return context.json<DeleteHabitRecordResponse>({ result: "deleted" });
  });
  app.get("/v1/daymark/history/week", async (context) => {
    const { start } = parseWithSchema(
      daymarkWeekQuerySchema,
      parseQuery(new URL(context.req.url).searchParams),
    );
    return context.json<WeekResponse>(
      await daymarkResult(() => service(context, dependencies).getWeek(start)),
    );
  });
  app.get("/v1/daymark/history/month", async (context) => {
    const { month } = parseWithSchema(
      daymarkMonthQuerySchema,
      parseQuery(new URL(context.req.url).searchParams),
    );
    return context.json<MonthResponse>(
      await daymarkResult(() => service(context, dependencies).getMonth(month)),
    );
  });
  return app;
}
