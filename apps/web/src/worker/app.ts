import { Hono } from "hono";
import type { AppBindings } from "./bindings";
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
export type AppDependencies = TechInboxDependencies & ApiDependencies;

export function createApp(overrides: Partial<AppDependencies> = {}) {
  const api = createApiApp<AppBindings>(overrides, techInboxRoutePolicy, (protectedApi) => {
    protectedApi.route("/", createTechInboxApi({ ...defaultTechInboxDependencies, ...overrides }));
  });
  const app = new Hono<{ Bindings: AppBindings }>();
  app.route("/api", api);
  app.all("*", (context) => serveDocument(context.req.raw, context.env));
  return app;
}

export const app = createApp();
