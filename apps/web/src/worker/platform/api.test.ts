import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  createApiApp,
  type ApiDependencies,
  type PlatformBindings,
  type RequestLogEvent,
} from "./api";
import { ApiError } from "./errors";

const origin = "https://app.example.invalid";
const principal = {
  subject: "test-subject",
  email: "owner@example.invalid",
  provider: "cloudflare-access",
} as const;
const bindings: PlatformBindings = {
  ENVIRONMENT: "production",
  APP_ORIGIN: origin,
  TEAM_DOMAIN: "https://test.cloudflareaccess.com",
  POLICY_AUD: "test-audience",
  ALLOWED_EMAIL: principal.email,
};
const mutationHeaders = {
  "Content-Type": "application/json",
  Origin: origin,
  "X-Rizakura-Me-Client": "web",
};

function fixture(overrides: Partial<ApiDependencies> = {}) {
  const handler = vi.fn(() => Response.json({ ok: true }));
  const authenticateAccess = vi.fn(async () => principal);
  const enforceRateLimit = vi.fn(async () => undefined);
  const events: RequestLogEvent[] = [];
  const api = createApiApp<PlatformBindings>(
    {
      authenticateAccess,
      enforceRateLimit,
      log: (event) => events.push(event),
      ...overrides,
    },
    undefined,
    (protectedApi) => {
      protectedApi.get("/v1/probe", handler);
      protectedApi.post("/v1/probe", handler);
      protectedApi.get("/v1/probe/error", () => {
        throw new Error("private-data-do-not-log");
      });
    },
  );
  const app = new Hono<{ Bindings: PlatformBindings }>().route("/api", api);
  return { app, handler, authenticateAccess, enforceRateLimit, events };
}

describe("default-protected shared API", () => {
  it.each([
    "/api",
    "/api/v1/probe",
    "/api/v1/daymark/future",
    "/api/v2/unknown",
    "/api/v1/health/",
  ])("rejects unauthenticated %s before any handler", async (path) => {
    const { app, handler, enforceRateLimit } = fixture({
      authenticateAccess: async () => {
        throw new ApiError(401, "UNAUTHORIZED", "認証が必要です。");
      },
    });
    const response = await app.request(origin + path, undefined, bindings);
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
    expect(enforceRateLimit).not.toHaveBeenCalled();
  });
  it("protects new GET/POST handlers without adding them to a path allowlist", async () => {
    const { app, authenticateAccess, enforceRateLimit, handler } = fixture();
    expect((await app.request(`${origin}/api/v1/probe`, undefined, bindings)).status).toBe(200);
    expect(enforceRateLimit).toHaveBeenLastCalledWith(bindings, principal, "read");
    expect(
      (
        await app.request(
          `${origin}/api/v1/probe`,
          { method: "POST", headers: mutationHeaders, body: "{}" },
          bindings,
        )
      ).status,
    ).toBe(200);
    expect(enforceRateLimit).toHaveBeenLastCalledWith(bindings, principal, "mutate");
    expect(authenticateAccess).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledTimes(2);
  });
  it("lets only the exact read-only health endpoint skip protection", async () => {
    const { app, authenticateAccess, enforceRateLimit } = fixture();
    for (const method of ["GET", "HEAD"]) {
      expect((await app.request(`${origin}/api/v1/health`, { method }, bindings)).status).toBe(200);
    }
    expect(authenticateAccess).not.toHaveBeenCalled();
    expect(enforceRateLimit).not.toHaveBeenCalled();
    expect(
      (
        await app.request(
          `${origin}/api/v1/health`,
          { method: "POST", headers: mutationHeaders, body: "{}" },
          bindings,
        )
      ).status,
    ).toBe(404);
    expect(authenticateAccess).toHaveBeenCalledOnce();
    expect(enforceRateLimit).toHaveBeenCalledOnce();
  });
  it.each([
    [{ ...mutationHeaders, Origin: "https://other.invalid" }, 403],
    [{ ...mutationHeaders, Origin: "" }, 403],
    [{ ...mutationHeaders, "Content-Type": "text/plain" }, 415],
    [{ "Content-Type": "application/json", Origin: origin }, 403],
    [{ ...mutationHeaders, "X-Rizakura-Me-Client": "other", "X-Tech-Inbox-Client": "web" }, 403],
    [{ ...mutationHeaders, "X-Tech-Inbox-Client": "other" }, 403],
  ] as const)("rejects invalid mutation headers before a handler (%j)", async (headers, status) => {
    const { app, handler } = fixture();
    const response = await app.request(
      `${origin}/api/v1/probe`,
      { method: "POST", headers, body: "{}" },
      bindings,
    );
    expect(response.status).toBe(status);
    expect(handler).not.toHaveBeenCalled();
  });
  it("keeps the old Tech Inbox mutation header compatible", async () => {
    const { app, handler } = fixture();
    const response = await app.request(
      `${origin}/api/v1/probe`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          "X-Tech-Inbox-Client": "web",
        },
        body: "{}",
      },
      bindings,
    );
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
  it("stops a rate-limited new handler", async () => {
    const { app, handler } = fixture({
      enforceRateLimit: async () => {
        throw new ApiError(429, "RATE_LIMITED", "しばらく待ってください。");
      },
    });
    const response = await app.request(`${origin}/api/v1/probe`, undefined, bindings);
    expect(response.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
  });
  it("uses the real default limiter for a new handler and fails closed without bindings", async () => {
    const protectedApi = createApiApp<PlatformBindings>(
      { authenticateAccess: async () => principal, log: () => undefined },
      undefined,
      (api) => api.get("/v1/new-product", (context) => context.json({ ok: true })),
    );
    const app = new Hono<{ Bindings: PlatformBindings }>().route("/api", protectedApi);
    expect((await app.request(`${origin}/api/v1/new-product`, undefined, bindings)).status).toBe(
      503,
    );
    const limit = vi.fn(async () => ({ success: true }));
    expect(
      (
        await app.request(`${origin}/api/v1/new-product`, undefined, {
          ...bindings,
          RATE_LIMIT_READ: { limit },
        })
      ).status,
    ).toBe(200);
    expect(limit).toHaveBeenCalledOnce();
  });
  it("redacts unknown errors, raw paths, queries and bodies from responses/logs", async () => {
    const { app, events } = fixture();
    const failed = await app.request(
      `${origin}/api/v1/probe/error?private-query`,
      undefined,
      bindings,
    );
    expect(failed.status).toBe(500);
    expect(await failed.text()).not.toContain("private-data");
    const missing = await app.request(
      `${origin}/api/v1/private-title?q=private-query`,
      {
        method: "POST",
        headers: mutationHeaders,
        body: '{"secret":"private-body"}',
      },
      bindings,
    );
    expect(missing.status).toBe(404);
    expect(JSON.stringify(events)).not.toContain("private-");
    expect(events.map(({ errorCode }) => errorCode)).toEqual(["INTERNAL_ERROR", "NOT_FOUND"]);
  });
  it("does not let a log sink failure alter the API response", async () => {
    const { app } = fixture({
      log: () => {
        throw new Error("sink offline");
      },
    });
    expect((await app.request(`${origin}/api/v1/probe`, undefined, bindings)).status).toBe(200);
  });
  it.each(["https://public.invalid", "bad-origin", "http://127.0.0.1:9999"])(
    "cannot enable local bypass with %s",
    async (appOrigin) => {
      const { app, authenticateAccess } = fixture();
      await app.request(`${origin}/api/v1/probe`, undefined, {
        ...bindings,
        ENVIRONMENT: "local",
        APP_ORIGIN: appOrigin,
      });
      expect(authenticateAccess).toHaveBeenCalledOnce();
    },
  );
  it("only skips Access for explicitly configured loopback development", async () => {
    const { app, authenticateAccess, enforceRateLimit } = fixture();
    const localOrigin = "http://127.0.0.1:5173";
    const response = await app.request(`${localOrigin}/api/v1/probe`, undefined, {
      ENVIRONMENT: "local",
      APP_ORIGIN: localOrigin,
    });
    expect(response.status).toBe(200);
    expect(authenticateAccess).not.toHaveBeenCalled();
    expect(enforceRateLimit).toHaveBeenCalledOnce();
  });
});
