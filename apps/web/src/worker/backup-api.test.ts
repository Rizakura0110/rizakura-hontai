import type { BackupImportSnapshot } from "@rizakura-me/contracts";
import type { Article } from "@tech-inbox/core/article";
import type { NormalizedUrl } from "@tech-inbox/core/url-normalization";
import { describe, expect, it, vi } from "vitest";
import { createApp, type AppBindings } from "./app";
import type { BackupRepository } from "./repositories/backup-repository";

const origin = "http://localhost";
const now = "2026-08-29T00:00:00.000Z";
const restoredArticle: Article = {
  id: "article-restored",
  originalUrl: "https://example.com/restored",
  canonicalUrl: null,
  title: "Restored article",
  titleIsManual: false,
  siteName: "Example",
  description: null,
  faviconUrl: null,
  imageUrl: null,
  publishedAt: null,
  status: "unread",
  metadataStatus: "ready",
  metadataErrorCode: null,
  metadataAttemptCount: 1,
  metadataFetchedAt: now,
  savedAt: now,
  readAt: null,
  createdAt: now,
  updatedAt: now,
};
const backup: BackupImportSnapshot = {
  schemaVersion: 2,
  exportedAt: now,
  articles: [restoredArticle],
  articleUrls: [
    {
      normalizedUrl: restoredArticle.originalUrl,
      articleId: restoredArticle.id,
      kind: "original",
      createdAt: now,
    },
  ],
  tags: [],
  articleTags: [],
};

function localBindings(): AppBindings {
  const allow = { limit: async () => ({ success: true }) } as RateLimit;
  return {
    DB: {} as D1Database,
    ASSETS: {} as Fetcher,
    METADATA_QUEUE: {} as Queue,
    METADATA_FETCHER: {} as Fetcher,
    RATE_LIMIT_CREATE: allow,
    RATE_LIMIT_RETRY: allow,
    RATE_LIMIT_MUTATE: allow,
    RATE_LIMIT_READ: allow,
    RATE_LIMIT_EXPORT: allow,
    ENVIRONMENT: "local",
    APP_ORIGIN: origin,
  };
}

function request(path: string, body: unknown = { backup }): Request {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "X-Tech-Inbox-Client": "web",
    },
    body: JSON.stringify(body),
  });
}

function repository(apply = vi.fn<BackupRepository["apply"]>()): BackupRepository {
  return {
    loadSnapshot: async () => ({ articles: [], articleUrls: [], tags: [], articleTags: [] }),
    apply,
  };
}

describe("backup import API", () => {
  it("previews a validated merge without writing", async () => {
    const apply = vi.fn<BackupRepository["apply"]>();
    const app = createApp({
      backupRepositoryFactory: () => repository(apply),
      clock: () => new Date(now),
      idGenerator: () => "generated-id",
      log: () => undefined,
    });

    const response = await app.request(
      request("/api/v1/import/preview"),
      undefined,
      localBindings(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: "preview",
      summary: { hasChanges: true, changes: { articlesCreated: 1, articleUrlsCreated: 1 } },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("recomputes and applies the merge through the protected mutation route", async () => {
    const apply = vi.fn<BackupRepository["apply"]>(async () => undefined);
    const app = createApp({
      backupRepositoryFactory: () => repository(apply),
      clock: () => new Date(now),
      idGenerator: () => "generated-id",
      log: () => undefined,
    });

    const response = await app.request(request("/api/v1/import"), undefined, localBindings());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ result: "imported" });
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        articles: [expect.objectContaining({ id: restoredArticle.id })],
        articleUrls: [
          expect.objectContaining({
            normalizedUrl: restoredArticle.originalUrl as NormalizedUrl,
          }),
        ],
      }),
    );
  });

  it("rejects invalid backup structure before opening the repository", async () => {
    const backupRepositoryFactory = vi.fn(() => repository());
    const app = createApp({ backupRepositoryFactory, log: () => undefined });
    const response = await app.request(
      request("/api/v1/import", { backup: { secret: "value" } }),
      undefined,
      localBindings(),
    );
    const responseText = await response.text();

    expect(response.status).toBe(400);
    expect(responseText).not.toContain("value");
    expect(backupRepositoryFactory).not.toHaveBeenCalled();
  });

  it("authenticates import requests outside local development", async () => {
    const backupRepositoryFactory = vi.fn(() => repository());
    const app = createApp({ backupRepositoryFactory, log: () => undefined });
    const response = await app.request(request("/api/v1/import/preview"), undefined, {
      ...localBindings(),
      ENVIRONMENT: "production",
    });

    expect(response.status).toBe(403);
    expect(backupRepositoryFactory).not.toHaveBeenCalled();
  });
});
