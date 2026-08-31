import { getDaymarkConnectionStatus } from "@rizakura-hontai/daymark/server";
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
  const api = createApiApp<AppBindings>(
    overrides,
    (method, pathname) => {
      if ((method === "GET" || method === "HEAD") && pathname === "/api/v1/daymark/status") {
        return { name: "daymark.status", rateLimit: "read" };
      }
      return techInboxRoutePolicy(method, pathname);
    },
    (protectedApi) => {
      protectedApi.get("/v1/daymark/status", (context) =>
        context.json(getDaymarkConnectionStatus()),
      );
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
