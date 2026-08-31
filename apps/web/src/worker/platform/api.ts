import type { ApiErrorResponse, HealthResponse } from "@rizakura-me/contracts/http";
import { Hono, type Context } from "hono";
import {
  authenticateAccessRequest,
  type AccessAuthBindings,
  type AuthPrincipal,
} from "./access-auth";
import { ApiError } from "./errors";
import { enforceApiRateLimit, type RateLimitBindings, type RateLimitCategory } from "./rate-limit";
import { SECURITY_HEADERS } from "./security-headers";

export type PlatformBindings = AccessAuthBindings &
  RateLimitBindings & {
    readonly APP_ORIGIN?: string;
  };

export type ApiEnvironment<Bindings extends PlatformBindings = PlatformBindings> = {
  Bindings: Bindings;
  Variables: {
    requestId: string;
    routeName: string;
    errorCode: string | undefined;
    principal: AuthPrincipal | undefined;
  };
};

export type RequestLogEvent = {
  readonly requestId: string;
  readonly route: string;
  readonly method: string;
  readonly status: number;
  readonly durationMs: number;
  readonly errorCode?: string;
};

export type ApiDependencies = {
  readonly authenticateAccess: (
    request: Request,
    bindings: AccessAuthBindings,
  ) => Promise<AuthPrincipal>;
  readonly enforceRateLimit: (
    bindings: RateLimitBindings,
    principal: AuthPrincipal,
    category: RateLimitCategory,
  ) => Promise<void>;
  readonly log: (event: RequestLogEvent) => void;
};

export type ApiRoutePolicy = {
  readonly name: string;
  readonly rateLimit: RateLimitCategory;
};

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const LOCAL_PRINCIPAL: AuthPrincipal = {
  subject: "local-development",
  email: "local@localhost.invalid",
  provider: "cloudflare-access",
};

function isLocalDevelopmentRequest(request: Request, bindings: PlatformBindings): boolean {
  if (bindings.ENVIRONMENT !== "local" || bindings.APP_ORIGIN === undefined) return false;
  try {
    const origin = new URL(bindings.APP_ORIGIN);
    return (
      origin.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) &&
      origin.origin === new URL(request.url).origin
    );
  } catch {
    return false;
  }
}

function enforceMutationRequest(request: Request, bindings: PlatformBindings): void {
  if (!MUTATION_METHODS.has(request.method)) return;
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Typeにapplication/jsonを指定してください。",
    );
  }
  if (bindings.APP_ORIGIN === undefined || request.headers.get("Origin") !== bindings.APP_ORIGIN) {
    throw new ApiError(403, "FORBIDDEN", "許可されていないOriginです。");
  }
  const client = request.headers.get("X-Rizakura-Me-Client");
  const legacyClient = request.headers.get("X-Tech-Inbox-Client");
  // Keep old installed clients working, but reject conflicting/invalid header values.
  if (
    (client !== "web" && legacyClient !== "web") ||
    (client !== null && client !== "web") ||
    (legacyClient !== null && legacyClient !== "web")
  ) {
    throw new ApiError(403, "FORBIDDEN", "必要なclient headerがありません。");
  }
}

function errorResponse<Bindings extends PlatformBindings>(
  context: Context<ApiEnvironment<Bindings>>,
  error: unknown,
): Response {
  const safeError =
    error instanceof ApiError
      ? error
      : new ApiError(500, "INTERNAL_ERROR", "内部エラーが発生しました。");
  context.set("errorCode", safeError.code);
  const body: ApiErrorResponse = {
    error: {
      code: safeError.code,
      message: safeError.message,
      requestId: context.get("requestId"),
      ...(safeError.details === undefined ? {} : { details: safeError.details }),
    },
  };
  return context.json(body, safeError.status);
}

// Every handler mounted into this API passes through the same protection.
// Only the exact read-only health endpoint is public; new products need no allowlist edit.
export function createApiApp<Bindings extends PlatformBindings>(
  overrides: Partial<ApiDependencies> = {},
  routePolicy: (method: string, pathname: string) => ApiRoutePolicy | undefined = () => undefined,
  registerRoutes: (api: Hono<ApiEnvironment<Bindings>>) => void = () => undefined,
) {
  const dependencies: ApiDependencies = {
    authenticateAccess: authenticateAccessRequest,
    enforceRateLimit: enforceApiRateLimit,
    log: (event) => console.info(JSON.stringify(event)),
    ...overrides,
  };
  const api = new Hono<ApiEnvironment<Bindings>>();
  api.use("*", async (context, next) => {
    const startedAt = Date.now();
    const request = context.req.raw;
    const pathname = new URL(request.url).pathname;
    const publicHealth =
      (request.method === "GET" || request.method === "HEAD") && pathname === "/api/v1/health";
    const policy = routePolicy(request.method, pathname) ?? {
      name: "api.not_found",
      rateLimit: MUTATION_METHODS.has(request.method) ? "mutate" : "read",
    };
    context.set("requestId", crypto.randomUUID());
    context.set("routeName", publicHealth ? "health.get" : policy.name);
    context.set("errorCode", undefined);
    context.set("principal", undefined);
    context.header("Cache-Control", "no-store");
    context.header("X-Request-Id", context.get("requestId"));
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) context.header(name, value);
    try {
      if (!publicHealth) {
        const principal = isLocalDevelopmentRequest(request, context.env)
          ? LOCAL_PRINCIPAL
          : await dependencies.authenticateAccess(request, context.env);
        context.set("principal", principal);
        await dependencies.enforceRateLimit(context.env, principal, policy.rateLimit);
        enforceMutationRequest(request, context.env);
      }
      await next();
    } catch (error: unknown) {
      context.res = errorResponse(context, error);
    } finally {
      const errorCode = context.get("errorCode");
      try {
        dependencies.log({
          requestId: context.get("requestId"),
          route: context.get("routeName"),
          method: request.method,
          status: context.res.status,
          durationMs: Math.max(0, Date.now() - startedAt),
          ...(errorCode === undefined ? {} : { errorCode }),
        });
      } catch {
        // Logging must never change the API result.
      }
    }
  });
  api.get("/v1/health", (context) => context.json<HealthResponse>({ status: "ok" }));
  registerRoutes(api);
  api.all("*", (context) =>
    errorResponse(context, new ApiError(404, "NOT_FOUND", "指定されたAPIは存在しません。")),
  );
  api.onError((error, context) => errorResponse(context, error));
  return api;
}
