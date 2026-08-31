import { describe, expect, it, vi } from "vitest";
import { daymarkSchema } from "@rizakura-hontai/daymark/schema";
import { createApp, type AppBindings } from "./app";
import { ApiError } from "./platform/errors";

const origin = "https://app.invalid";
const path = "/api/v1/daymark/status";
const principal = {
  subject: "fixture",
  email: "fixture@example.invalid",
  provider: "cloudflare-access" as const,
};
const bindings = { ENVIRONMENT: "production", APP_ORIGIN: origin } as AppBindings;

describe("Daymark integration uses the shared protection", () => {
  it.each(["GET", "HEAD"])(
    "rejects unauthenticated %s without exposing the stub",
    async (method) => {
      const enforceRateLimit = vi.fn();
      const app = createApp({
        authenticateAccess: async () => {
          throw new ApiError(401, "UNAUTHORIZED", "認証が必要です。");
        },
        enforceRateLimit,
        log: () => undefined,
      });
      const response = await app.request(origin + path, { method }, bindings);
      expect(response.status).toBe(401);
      expect(enforceRateLimit).not.toHaveBeenCalled();
    },
  );
  it("returns only non-sensitive status after authentication and read rate limiting", async () => {
    const authenticateAccess = vi.fn().mockResolvedValue(principal);
    const enforceRateLimit = vi.fn();
    const log = vi.fn();
    const app = createApp({ authenticateAccess, enforceRateLimit, log });
    const response = await app.request(origin + path, undefined, bindings);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(authenticateAccess).toHaveBeenCalledOnce();
    expect(enforceRateLimit).toHaveBeenCalledWith(bindings, principal, "read");
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ route: "daymark.status", status: 200 }),
    );
    await expect(response.json()).resolves.toEqual({
      product: "daymark",
      status: "not_configured",
    });
    expect(daymarkSchema).toEqual({});
  });
  it("does not bypass a rate limit failure", async () => {
    const app = createApp({
      authenticateAccess: async () => principal,
      enforceRateLimit: async () => {
        throw new ApiError(429, "RATE_LIMITED", "しばらく待ってください。");
      },
      log: () => undefined,
    });
    const response = await app.request(origin + path, undefined, bindings);
    expect(response.status).toBe(429);
    expect(await response.text()).not.toContain("not_configured");
  });
  it("provides no write or habit-record endpoints", async () => {
    const app = createApp({
      authenticateAccess: async () => principal,
      enforceRateLimit: async () => undefined,
      log: () => undefined,
    });
    const invalid = await app.request(origin + path, { method: "POST" }, bindings);
    expect(invalid.status).toBe(415);
    const write = await app.request(
      origin + path,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          "X-Rizakura-Hontai-Client": "web",
        },
        body: "{}",
      },
      bindings,
    );
    expect(write.status).toBe(404);
    const unknown = await app.request(`${origin}/api/v1/daymark/records`, undefined, bindings);
    expect(unknown.status).toBe(404);
  });
});
