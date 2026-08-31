import { describe, expect, it, vi } from "vitest";
import type { AuthPrincipal } from "./platform/access-auth";
import type { ApiError } from "./platform/errors";
import { enforceApiRateLimit, type RateLimitBindings } from "./platform/rate-limit";

const principal: AuthPrincipal = {
  subject: "private-access-subject",
  email: "owner@example.com",
  provider: "cloudflare-access",
};

function binding(success: boolean) {
  return { limit: vi.fn(async () => ({ success })) } as unknown as RateLimit;
}

describe("shared API rate limiting", () => {
  it.each([
    ["create", "RATE_LIMIT_CREATE"],
    ["retry", "RATE_LIMIT_RETRY"],
    ["mutate", "RATE_LIMIT_MUTATE"],
    ["read", "RATE_LIMIT_READ"],
    ["export", "RATE_LIMIT_EXPORT"],
  ] as const)("uses a pseudonymous key for %s", async (category, bindingName) => {
    const limiter = binding(true);
    await enforceApiRateLimit({ [bindingName]: limiter }, principal, category);

    expect(limiter.limit).toHaveBeenCalledOnce();
    const key = vi.mocked(limiter.limit).mock.calls[0]?.[0].key;
    expect(key).toMatch(new RegExp(`^${category}:[a-f0-9]{64}$`, "u"));
    expect(key).not.toContain(principal.subject);
    expect(key).not.toContain(principal.email);
  });

  it("returns a safe 429 when the binding rejects the request", async () => {
    await expect(
      enforceApiRateLimit({ RATE_LIMIT_CREATE: binding(false) }, principal, "create"),
    ).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
    } satisfies Partial<ApiError>);
  });

  it("fails closed when a non-local deployment is missing its binding", async () => {
    await expect(
      enforceApiRateLimit({ ENVIRONMENT: "production" }, principal, "read"),
    ).rejects.toMatchObject({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
    } satisfies Partial<ApiError>);
  });

  it("allows binding-free local development", async () => {
    await expect(
      enforceApiRateLimit({ ENVIRONMENT: "local" } satisfies RateLimitBindings, principal, "read"),
    ).resolves.toBeUndefined();
  });
});
