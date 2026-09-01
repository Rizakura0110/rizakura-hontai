import { Hono } from "hono";
import type { AppBindings } from "./bindings";
import {
  createDaymarkApi,
  daymarkRoutePolicy,
  defaultDaymarkDependencies,
  type DaymarkDependencies,
} from "./daymark-api";
import { createApiApp, type ApiDependencies } from "./platform/api";
import { serveDocument } from "./platform/documents";
import {
  createTechInboxApi,
  defaultTechInboxDependencies,
  techInboxRoutePolicy,
  type TechInboxDependencies,
} from "./tech-inbox-api";

export type { AppBindings } from "./bindings";
export type { RequestLogEvent } from "./platform/api";
export type AppDependencies = TechInboxDependencies & DaymarkDependencies & ApiDependencies;

export function createApp(overrides: Partial<AppDependencies> = {}) {
  const api = createApiApp<AppBindings>(
    overrides,
    (method, pathname) => {
      return daymarkRoutePolicy(method, pathname) ?? techInboxRoutePolicy(method, pathname);
    },
    (protectedApi) => {
      protectedApi.route("/", createDaymarkApi({ ...defaultDaymarkDependencies, ...overrides }));
      protectedApi.route(
        "/",
        createTechInboxApi({ ...defaultTechInboxDependencies, ...overrides }),
      );
    },
  );
  const app = new Hono<{ Bindings: AppBindings }>();
  app.route("/api", api);
  app.all("*", (context) => serveDocument(context.req.raw, context.env));
  return app;
}

export const app = createApp();
