import {
  type ApiErrorResponse,
  type ArticleResponse,
  articleIdParamsSchema,
  createArticleRequestSchema,
  type CreateArticleResponse,
  type DeleteArticleResponse,
  type HealthResponse,
  listArticlesQuerySchema,
  type ListArticlesResponse,
  type MetadataQueueMessage,
  retryMetadataRequestSchema,
  type RetryMetadataResponse,
  updateArticleRequestSchema,
} from "@tech-inbox/contracts";
import { Hono, type Context } from "hono";
import {
  authenticateAccessRequest,
  type AuthPrincipal,
  type AccessAuthBindings,
} from "./access-auth";
import { ArticleService, type Clock, type IdGenerator } from "./article-service";
import { toArticleDto } from "./article-dto";
import { ApiError } from "./errors";
import { createMetadataQueueProducer, type MetadataQueueProducer } from "./metadata-queue";
import { parseQuery, parseWithSchema, readJsonBody } from "./request-validation";
import { enforceArticleRateLimit, type RateLimitBindings } from "./rate-limit";
import { createD1ArticleRepository } from "./repositories/d1-article-repository";
import type { ArticleRepository } from "./repositories/article-repository";
import { SECURITY_HEADERS } from "./security-headers";

export type AppBindings = CloudflareBindings &
  AccessAuthBindings &
  RateLimitBindings & {
    readonly ENVIRONMENT?: string;
    readonly APP_ORIGIN?: string;
    readonly METADATA_QUEUE: Queue<MetadataQueueMessage>;
    readonly METADATA_FETCHER: Fetcher;
  };

type RequestVariables = {
  requestId: string;
  routeName: string;
  errorCode: string | undefined;
  principal: AuthPrincipal | undefined;
};

type AppEnvironment = {
  Bindings: AppBindings;
  Variables: RequestVariables;
};

export type RequestLogEvent = {
  readonly requestId: string;
  readonly route: string;
  readonly method: string;
  readonly status: number;
  readonly durationMs: number;
  readonly errorCode?: string;
};

export type AppDependencies = {
  readonly repositoryFactory: (bindings: AppBindings) => ArticleRepository;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly metadataQueueFactory: (bindings: AppBindings) => MetadataQueueProducer;
  readonly authenticateAccess: (
    request: Request,
    bindings: AccessAuthBindings,
  ) => Promise<AuthPrincipal>;
  readonly enforceRateLimit: (
    bindings: RateLimitBindings,
    principal: AuthPrincipal,
    routeName: string,
  ) => Promise<void>;
  readonly log: (event: RequestLogEvent) => void;
};

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isArticlePath(pathname: string): boolean {
  return pathname === "/api/v1/articles" || pathname.startsWith("/api/v1/articles/");
}

function safeRouteName(method: string, pathname: string): string {
  if (method === "GET" && pathname === "/api/v1/health") return "health.get";
  if (pathname === "/api/v1/articles") {
    if (method === "GET") return "articles.list";
    if (method === "POST") return "articles.create";
  }

  if (/^\/api\/v1\/articles\/[^/]+$/u.test(pathname)) {
    if (method === "GET") return "articles.get";
    if (method === "PATCH") return "articles.update";
    if (method === "DELETE") return "articles.delete";
  }

  if (/^\/api\/v1\/articles\/[^/]+\/retry-metadata$/u.test(pathname) && method === "POST") {
    return "articles.retry_metadata";
  }

  return "api.not_found";
}

const LOCAL_PRINCIPAL: AuthPrincipal = {
  subject: "local-development",
  email: "local@localhost.invalid",
  provider: "cloudflare-access",
};

function isLocalDevelopmentRequest(context: Context<AppEnvironment>): boolean {
  if (context.env.ENVIRONMENT !== "local" || context.env.APP_ORIGIN === undefined) return false;

  try {
    const applicationOrigin = new URL(context.env.APP_ORIGIN);
    const requestOrigin = new URL(context.req.url).origin;
    return (
      applicationOrigin.protocol === "http:" &&
      (applicationOrigin.hostname === "localhost" ||
        applicationOrigin.hostname === "127.0.0.1" ||
        applicationOrigin.hostname === "[::1]") &&
      applicationOrigin.origin === requestOrigin
    );
  } catch {
    return false;
  }
}

async function enforceArticleAccess(
  context: Context<AppEnvironment>,
  dependencies: AppDependencies,
): Promise<void> {
  const principal = isLocalDevelopmentRequest(context)
    ? LOCAL_PRINCIPAL
    : await dependencies.authenticateAccess(context.req.raw, context.env);
  context.set("principal", principal);
  await dependencies.enforceRateLimit(context.env, principal, context.get("routeName"));
}

function enforceMutationRequest(context: Context<AppEnvironment>): void {
  if (!MUTATION_METHODS.has(context.req.method)) {
    return;
  }

  const contentType = context.req.header("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Typeにapplication/jsonを指定してください。",
    );
  }

  const expectedOrigin = context.env.APP_ORIGIN;
  if (expectedOrigin === undefined || context.req.header("Origin") !== expectedOrigin) {
    throw new ApiError(403, "FORBIDDEN", "許可されていないOriginです。");
  }

  if (context.req.header("X-Tech-Inbox-Client") !== "web") {
    throw new ApiError(403, "FORBIDDEN", "必要なclient headerがありません。");
  }
}

function defaultLog(event: RequestLogEvent): void {
  console.info(JSON.stringify(event));
}

function errorResponse(context: Context<AppEnvironment>, error: ApiError): Response {
  context.set("errorCode", error.code);

  const body: ApiErrorResponse = {
    error: {
      code: error.code,
      message: error.message,
      requestId: context.get("requestId"),
      ...(error.details === undefined ? {} : { details: error.details }),
    },
  };

  return context.json(body, error.status);
}

function safeApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError(500, "INTERNAL_ERROR", "内部エラーが発生しました。");
}

function articleService(context: Context<AppEnvironment>, dependencies: AppDependencies) {
  return new ArticleService(
    dependencies.repositoryFactory(context.env),
    dependencies.clock,
    dependencies.idGenerator,
    dependencies.metadataQueueFactory(context.env),
  );
}

const defaultDependencies: AppDependencies = {
  repositoryFactory: (bindings) => createD1ArticleRepository(bindings.DB),
  clock: () => new Date(),
  idGenerator: () => crypto.randomUUID(),
  metadataQueueFactory: (bindings) => createMetadataQueueProducer(bindings.METADATA_QUEUE),
  authenticateAccess: authenticateAccessRequest,
  enforceRateLimit: enforceArticleRateLimit,
  log: defaultLog,
};

export function createApp(overrides: Partial<AppDependencies> = {}) {
  const dependencies: AppDependencies = { ...defaultDependencies, ...overrides };
  const app = new Hono<AppEnvironment>();

  app.use("/api/*", async (context, next) => {
    const startedAt = Date.now();
    const pathname = new URL(context.req.url).pathname;
    context.set("requestId", crypto.randomUUID());
    context.set("routeName", safeRouteName(context.req.method, pathname));
    context.set("errorCode", undefined);
    context.set("principal", undefined);
    context.header("Cache-Control", "no-store");
    context.header("X-Request-Id", context.get("requestId"));
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      context.header(name, value);
    }

    try {
      if (isArticlePath(pathname)) {
        await enforceArticleAccess(context, dependencies);
        enforceMutationRequest(context);
      }

      await next();
    } catch (error: unknown) {
      context.res = errorResponse(context, safeApiError(error));
    } finally {
      const errorCode = context.get("errorCode");
      try {
        dependencies.log({
          requestId: context.get("requestId"),
          route: context.get("routeName"),
          method: context.req.method,
          status: context.res.status,
          durationMs: Math.max(0, Date.now() - startedAt),
          ...(errorCode === undefined ? {} : { errorCode }),
        });
      } catch {
        // Logging must never change the API result.
      }
    }
  });

  app.get("/api/v1/health", (context) => {
    context.set("routeName", "health.get");
    return context.json<HealthResponse>({ status: "ok" });
  });

  app.get("/api/v1/articles", async (context) => {
    context.set("routeName", "articles.list");
    const query = parseWithSchema(
      listArticlesQuerySchema,
      parseQuery(new URL(context.req.url).searchParams),
    );
    const response = await articleService(context, dependencies).list(query);
    return context.json<ListArticlesResponse>(response);
  });

  app.post("/api/v1/articles", async (context) => {
    context.set("routeName", "articles.create");
    const request = parseWithSchema(
      createArticleRequestSchema,
      await readJsonBody(context.req.raw),
    );
    const response = await articleService(context, dependencies).create(request);
    const status = response.result === "created" ? 201 : 200;
    return context.json<CreateArticleResponse>(response, status);
  });

  app.get("/api/v1/articles/:id", async (context) => {
    context.set("routeName", "articles.get");
    const { id } = parseWithSchema(articleIdParamsSchema, context.req.param());
    const article = await articleService(context, dependencies).get(id);
    return context.json<ArticleResponse>({ article: toArticleDto(article) });
  });

  app.patch("/api/v1/articles/:id", async (context) => {
    context.set("routeName", "articles.update");
    const { id } = parseWithSchema(articleIdParamsSchema, context.req.param());
    const request = parseWithSchema(
      updateArticleRequestSchema,
      await readJsonBody(context.req.raw),
    );
    const article = await articleService(context, dependencies).update(id, request);
    return context.json<ArticleResponse>({ article: toArticleDto(article) });
  });

  app.delete("/api/v1/articles/:id", async (context) => {
    context.set("routeName", "articles.delete");
    const { id } = parseWithSchema(articleIdParamsSchema, context.req.param());
    await articleService(context, dependencies).delete(id);
    return context.json<DeleteArticleResponse>({ result: "deleted" });
  });

  app.post("/api/v1/articles/:id/retry-metadata", async (context) => {
    context.set("routeName", "articles.retry_metadata");
    const { id } = parseWithSchema(articleIdParamsSchema, { id: context.req.param("id") });
    parseWithSchema(retryMetadataRequestSchema, await readJsonBody(context.req.raw));
    const article = await articleService(context, dependencies).retryMetadata(id);
    return context.json<RetryMetadataResponse>({ article: toArticleDto(article) });
  });

  app.onError((error, context) => {
    return errorResponse(context, safeApiError(error));
  });

  app.notFound((context) => {
    context.set("routeName", "api.not_found");
    return errorResponse(context, new ApiError(404, "NOT_FOUND", "指定されたAPIは存在しません。"));
  });

  return app;
}

export const app = createApp();
