import type { ApiErrorResponse, HealthResponse } from "@tech-inbox/contracts";
import { Hono } from "hono";

export const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/api/v1/health", (context) => {
  const requestId = crypto.randomUUID();

  context.header("Cache-Control", "no-store");
  context.header("X-Request-Id", requestId);

  return context.json<HealthResponse>({ status: "ok" });
});

app.notFound((context) => {
  const requestId = crypto.randomUUID();

  context.header("Cache-Control", "no-store");
  context.header("X-Request-Id", requestId);

  return context.json<ApiErrorResponse>(
    {
      error: {
        code: "NOT_FOUND",
        message: "指定されたAPIは存在しません。",
        requestId,
      },
    },
    404,
  );
});
