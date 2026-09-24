import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createApp, type AppBindings } from "./app";
import { createApiApp, type PlatformBindings } from "./platform/api";
import { ApiError } from "./platform/errors";

const origin = "https://app.example.invalid";
const headers = {
  "Content-Type": "application/json",
  Origin: origin,
  "X-Rizakura-Hontai-Client": "web",
};
const principal = {
  subject: "test-subject",
  email: "owner@example.invalid",
  provider: "cloudflare-access",
} as const;

describe("maintenance API protection", () => {
  it.each(["read-only", "frozen", "invalid"])(
    "blocks both products before side effects in %s",
    async (mode) => {
      const repositoryFactory = vi.fn(() => {
        throw new Error("must not access a repository");
      });
      const metadataQueueFactory = vi.fn(() => {
        throw new Error("must not enqueue");
      });
      const app = createApp({
        authenticateAccess: async () => principal,
        enforceRateLimit: async () => undefined,
        log: () => undefined,
        repositoryFactory,
        tagRepositoryFactory: repositoryFactory,
        backupRepositoryFactory: repositoryFactory,
        daymarkRepositoryFactory: repositoryFactory,
        daymarkBackupRepositoryFactory: repositoryFactory,
        metadataQueueFactory,
      });
      // Intentionally omit real resource bindings: no protected mutation may use them.
      const bindings = { APP_ORIGIN: origin, MAINTENANCE_MODE: mode } as AppBindings;
      for (const [method, path] of [
        ["POST", "/articles"],
        ["PATCH", "/articles/article-1"],
        ["DELETE", "/articles/article-1"],
        ["POST", "/articles/article-1/retry-metadata"],
        ["PUT", "/articles/article-1/tags"],
        ["POST", "/tags"],
        ["PATCH", "/tags/tag-1"],
        ["DELETE", "/tags/tag-1"],
        ["POST", "/import"],
        ["POST", "/import/preview"],
        ["POST", "/daymark/habits"],
        ["PATCH", "/daymark/habits/habit-1"],
        ["PUT", "/daymark/habits/habit-1/configurations/2026-09-19"],
        ["PUT", "/daymark/habits/habit-1/records/2026-09-19"],
        ["DELETE", "/daymark/habits/habit-1/records/2026-09-19"],
        ["DELETE", "/daymark/habits/habit-1"],
        ["POST", "/daymark/import"],
        ["POST", "/daymark/import/preview"],
        ["POST", "/future-product"],
      ] as const) {
        const response = await app.request(
          `${origin}/api/v1${path}`,
          { method, headers, body: "{}" },
          bindings,
        );
        expect(response.status, `${method} ${path}`).toBe(503);
        expect(response.headers.get("Retry-After")).toBe("60");
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(await response.json()).toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" } });
      }
      expect(repositoryFactory).not.toHaveBeenCalled();
      expect(metadataQueueFactory).not.toHaveBeenCalled();
    },
  );

  it("keeps authenticated reads, auth/Origin checks, health and normal writes intact", async () => {
    const handler = vi.fn(() => Response.json({ ok: true }));
    const authenticateAccess = vi.fn(async () => principal);
    const log = vi.fn();
    const api = createApiApp<PlatformBindings>(
      { authenticateAccess, enforceRateLimit: async () => undefined, log },
      undefined,
      (protectedApi) => protectedApi.all("/v1/probe", handler),
    );
    const app = new Hono<{ Bindings: PlatformBindings }>().route("/api", api);
    const bindings = { APP_ORIGIN: origin, MAINTENANCE_MODE: "frozen" };
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect((await app.request(`${origin}/api/v1/probe`, { method }, bindings)).status).toBe(200);
    }
    expect(authenticateAccess).toHaveBeenCalledTimes(3);
    handler.mockClear();
    const request = (bindings: PlatformBindings, requestHeaders = headers) =>
      app.request(
        `${origin}/api/v1/probe`,
        {
          method: "POST",
          headers: requestHeaders,
          body: "{}",
        },
        bindings,
      );
    expect(
      (await request(bindings, { ...headers, Origin: "https://other.example.invalid" })).status,
    ).toBe(403);
    authenticateAccess.mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED", "認証が必要です。"));
    expect((await request(bindings)).status).toBe(401);
    const blocked = await request(bindings);
    expect(blocked.status).toBe(503);
    expect(log).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 503, errorCode: "SERVICE_UNAVAILABLE" }),
    );
    expect(handler).not.toHaveBeenCalled();
    authenticateAccess.mockClear();
    expect((await app.request(`${origin}/api/v1/health`, undefined, bindings)).status).toBe(200);
    expect(authenticateAccess).not.toHaveBeenCalled();
    const resumed = await request({ ...bindings, MAINTENANCE_MODE: "off" });
    expect(resumed.status).toBe(200);
    expect(resumed.headers.has("Retry-After")).toBe(false);
    expect(handler).toHaveBeenCalledOnce();
  });
});
