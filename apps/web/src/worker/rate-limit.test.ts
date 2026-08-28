import { describe, expect, it, vi } from "vitest";
import type { AuthPrincipal } from "./access-auth";
import type { ApiError } from "./errors";
import { enforceApiRateLimit, type RateLimitBindings } from "./rate-limit";

const principal: AuthPrincipal = {
  subject: "private-access-subject",
  email: "owner@example.com",
  provider: "cloudflare-access",
};

function binding(success: boolean) {
  return { limit: vi.fn(async () => ({ success })) } as unknown as RateLimit;
}

describe("article API rate limiting", () => {
  it.each([
    ["articles.create", "RATE_LIMIT_CREATE", "create"],
    ["articles.retry_metadata", "RATE_LIMIT_RETRY", "retry"],
    ["articles.update", "RATE_LIMIT_MUTATE", "mutate"],
    ["articles.delete", "RATE_LIMIT_MUTATE", "mutate"],
    ["articles.list", "RATE_LIMIT_READ", "read"],
    ["articles.get", "RATE_LIMIT_READ", "read"],
    ["tags.create", "RATE_LIMIT_MUTATE", "mutate"],
    ["tags.update", "RATE_LIMIT_MUTATE", "mutate"],
    ["tags.delete", "RATE_LIMIT_MUTATE", "mutate"],
    ["article_tags.replace", "RATE_LIMIT_MUTATE", "mutate"],
    ["tags.list", "RATE_LIMIT_READ", "read"],
    ["article_tags.list", "RATE_LIMIT_READ", "read"],
    ["export.get", "RATE_LIMIT_EXPORT", "export"],
  ] as const)("uses a pseudonymous key for %s", async (routeName, bindingName, category) => {
    const limiter = binding(true);
    await enforceApiRateLimit({ [bindingName]: limiter }, principal, routeName);

    expect(limiter.limit).toHaveBeenCalledOnce();
    const key = vi.mocked(limiter.limit).mock.calls[0]?.[0].key;
    expect(key).toMatch(new RegExp(`^${category}:[a-f0-9]{64}$`, "u"));
    expect(key).not.toContain(principal.subject);
    expect(key).not.toContain(principal.email);
  });

  it("returns a safe 429 when the binding rejects the request", async () => {
    await expect(
      enforceApiRateLimit({ RATE_LIMIT_CREATE: binding(false) }, principal, "articles.create"),
    ).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
    } satisfies Partial<ApiError>);
  });

  it("fails closed when a non-local deployment is missing its binding", async () => {
    await expect(
      enforceApiRateLimit({ ENVIRONMENT: "production" }, principal, "articles.list"),
    ).rejects.toMatchObject({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
    } satisfies Partial<ApiError>);
  });

  it("allows binding-free local development and ignores unrelated routes", async () => {
    await expect(
      enforceApiRateLimit({ ENVIRONMENT: "local" }, principal, "articles.list"),
    ).resolves.toBeUndefined();
    await expect(
      enforceApiRateLimit({} satisfies RateLimitBindings, principal, "api.not_found"),
    ).resolves.toBeUndefined();
  });
});
