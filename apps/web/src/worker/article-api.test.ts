import type { Article } from "@tech-inbox/core/article";
import { describe, expect, it, vi } from "vitest";
import { createApp, type RequestLogEvent } from "./app";
import type { ArticleRepository } from "./repositories/article-repository";

const origin = "http://localhost";
const now = "2026-08-27T00:00:00.000Z";

const article: Article = {
  id: "article-1",
  originalUrl: "https://example.com/article",
  canonicalUrl: null,
  title: null,
  titleIsManual: false,
  siteName: null,
  description: null,
  faviconUrl: null,
  imageUrl: null,
  publishedAt: null,
  status: "unread",
  metadataStatus: "pending",
  metadataErrorCode: null,
  metadataAttemptCount: 0,
  metadataFetchedAt: null,
  savedAt: now,
  readAt: null,
  createdAt: now,
  updatedAt: now,
};

function stubRepository(overrides: Partial<ArticleRepository> = {}): ArticleRepository {
  return {
    list: async () => ({ items: [article], nextCursor: null }),
    findById: async () => article,
    findByNormalizedUrl: async () => null,
    createWithOriginalAlias: async () => ({ outcome: "created", article }),
    update: async () => ({ outcome: "updated", article }),
    applyMetadata: async () => ({ outcome: "updated", article }),
    recordMetadataFailure: async () => ({ outcome: "updated", article }),
    deleteById: async () => ({ outcome: "deleted" }),
    ...overrides,
  };
}

function localBindings(): CloudflareBindings & {
  ENVIRONMENT: string;
  APP_ORIGIN: string;
} {
  return {
    DB: {} as D1Database,
    METADATA_QUEUE: {} as Queue,
    METADATA_FETCHER: {} as Fetcher,
    ENVIRONMENT: "local",
    APP_ORIGIN: origin,
  };
}

describe("article API", () => {
  it("validates and queues a failed metadata retry", async () => {
    const failedArticle: Article = {
      ...article,
      metadataStatus: "failed",
      metadataErrorCode: "NETWORK_ERROR",
      metadataAttemptCount: 3,
    };
    const pendingArticle: Article = {
      ...failedArticle,
      metadataStatus: "pending",
      metadataErrorCode: null,
      metadataAttemptCount: 0,
    };
    const send = vi.fn(async () => undefined);
    const app = createApp({
      repositoryFactory: () =>
        stubRepository({
          findById: async () => failedArticle,
          update: async () => ({ outcome: "updated", article: pendingArticle }),
        }),
      clock: () => new Date(now),
      idGenerator: () => article.id,
      metadataQueueFactory: () => ({ send }),
      log: () => undefined,
    });
    const response = await app.request(
      `${origin}/api/v1/articles/${article.id}/retry-metadata`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          "X-Tech-Inbox-Client": "web",
        },
        body: "{}",
      },
      localBindings(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      article: { id: article.id, metadataStatus: "pending" },
    });
    expect(send).toHaveBeenCalledWith({
      articleId: article.id,
      url: article.originalUrl,
      attempt: 0,
    });
  });

  it("routes a locally authenticated create request", async () => {
    const app = createApp({
      repositoryFactory: () => stubRepository(),
      clock: () => new Date(now),
      idGenerator: () => article.id,
      metadataQueueFactory: () => ({ send: async () => undefined }),
      log: () => undefined,
    });
    const response = await app.request(
      `${origin}/api/v1/articles`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          "X-Tech-Inbox-Client": "web",
        },
        body: JSON.stringify({ url: article.originalUrl }),
      },
      localBindings(),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      result: "created",
      article: { id: article.id },
    });
  });

  it("fails closed outside local mode before touching the repository", async () => {
    const app = createApp({
      repositoryFactory: () => {
        throw new Error("The repository must not be created.");
      },
      clock: () => new Date(now),
      idGenerator: () => article.id,
      metadataQueueFactory: () => ({ send: async () => undefined }),
      log: () => undefined,
    });
    const response = await app.request(`${origin}/api/v1/articles`, undefined, {
      ...localBindings(),
      ENVIRONMENT: "production",
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("rejects unknown mutation fields with the unified safe error shape", async () => {
    const events: RequestLogEvent[] = [];
    const app = createApp({
      repositoryFactory: () => stubRepository(),
      clock: () => new Date(now),
      idGenerator: () => article.id,
      metadataQueueFactory: () => ({ send: async () => undefined }),
      log: (event) => events.push(event),
    });
    const response = await app.request(
      `${origin}/api/v1/articles`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          "X-Tech-Inbox-Client": "web",
        },
        body: JSON.stringify({ url: article.originalUrl, secretField: "do-not-log" }),
      },
      localBindings(),
    );
    const responseText = await response.text();

    expect(response.status).toBe(400);
    expect(responseText).not.toContain("do-not-log");
    expect(JSON.parse(responseText)).toMatchObject({
      error: { code: "VALIDATION_ERROR", requestId: response.headers.get("x-request-id") },
    });
    expect(events).toEqual([
      expect.objectContaining({
        route: "articles.create",
        method: "POST",
        status: 400,
        errorCode: "VALIDATION_ERROR",
      }),
    ]);
  });

  it("does not expose internal errors, raw query values, URLs, or stacks in responses and logs", async () => {
    const events: RequestLogEvent[] = [];
    const repository = stubRepository({
      list: async () => {
        throw new Error("https://private.example/token?secret=yes\ninternal stack detail");
      },
    });
    const app = createApp({
      repositoryFactory: () => repository,
      clock: () => new Date(now),
      idGenerator: () => article.id,
      metadataQueueFactory: () => ({ send: async () => undefined }),
      log: (event) => events.push(event),
    });
    const response = await app.request(
      `${origin}/api/v1/articles?q=private-search-value`,
      undefined,
      localBindings(),
    );
    const responseText = await response.text();
    const logged = JSON.stringify(events);

    expect(response.status).toBe(500);
    expect(responseText).not.toContain("private.example");
    expect(responseText).not.toContain("stack");
    expect(logged).not.toContain("private-search-value");
    expect(logged).not.toContain("private.example");
    expect(events).toEqual([
      expect.objectContaining({
        route: "articles.list",
        method: "GET",
        status: 500,
        errorCode: "INTERNAL_ERROR",
      }),
    ]);
  });

  it("accepts a protected DELETE without requiring a request body", async () => {
    const app = createApp({
      repositoryFactory: () => stubRepository(),
      clock: () => new Date(now),
      idGenerator: () => article.id,
      metadataQueueFactory: () => ({ send: async () => undefined }),
      log: () => undefined,
    });
    const response = await app.request(
      `${origin}/api/v1/articles/${article.id}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          "X-Tech-Inbox-Client": "web",
        },
      },
      localBindings(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ result: "deleted" });
  });
});
