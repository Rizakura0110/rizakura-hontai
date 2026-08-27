import type { AuthPrincipal } from "./access-auth";
import { ApiError } from "./errors";

export type RateLimitBindings = {
  readonly ENVIRONMENT?: string;
  readonly RATE_LIMIT_CREATE?: RateLimit;
  readonly RATE_LIMIT_RETRY?: RateLimit;
  readonly RATE_LIMIT_MUTATE?: RateLimit;
  readonly RATE_LIMIT_READ?: RateLimit;
};

type RateLimitCategory = "create" | "retry" | "mutate" | "read";

function categoryForRoute(routeName: string): RateLimitCategory | undefined {
  if (routeName === "articles.create") return "create";
  if (routeName === "articles.retry_metadata") return "retry";
  if (routeName === "articles.update" || routeName === "articles.delete") return "mutate";
  if (routeName === "articles.list" || routeName === "articles.get") return "read";
  return undefined;
}

function bindingForCategory(
  bindings: RateLimitBindings,
  category: RateLimitCategory,
): RateLimit | undefined {
  if (category === "create") return bindings.RATE_LIMIT_CREATE;
  if (category === "retry") return bindings.RATE_LIMIT_RETRY;
  if (category === "mutate") return bindings.RATE_LIMIT_MUTATE;
  return bindings.RATE_LIMIT_READ;
}

async function hashPrincipal(principal: AuthPrincipal): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${principal.subject}\u0000${principal.email}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function enforceArticleRateLimit(
  bindings: RateLimitBindings,
  principal: AuthPrincipal,
  routeName: string,
): Promise<void> {
  const category = categoryForRoute(routeName);
  if (category === undefined) return;

  const binding = bindingForCategory(bindings, category);
  if (binding === undefined) {
    if (bindings.ENVIRONMENT === "local") return;
    throw new ApiError(503, "SERVICE_UNAVAILABLE", "このAPIは現在利用できません。");
  }

  const outcome = await binding.limit({
    key: `${category}:${await hashPrincipal(principal)}`,
  });
  if (!outcome.success) {
    throw new ApiError(429, "RATE_LIMITED", "しばらく待ってから再度お試しください。");
  }
}
