import type { Article } from "@tech-inbox/core/article";
import type { NormalizedUrl } from "@tech-inbox/core/url-normalization";
import { describe, expect, it, vi } from "vitest";
import type { BackupImportPlan } from "../backup-import";
import { createD1BackupRepository } from "./d1-backup-repository";

const now = "2026-08-29T00:00:00.000Z";
const article: Article = {
  id: "article-1",
  originalUrl: "https://example.com/1",
  canonicalUrl: null,
  title: null,
  titleIsManual: false,
  siteName: null,
  description: null,
  faviconUrl: null,
  imageUrl: null,
  publishedAt: null,
  status: "unread",
  metadataStatus: "failed",
  metadataErrorCode: "NETWORK_ERROR",
  metadataAttemptCount: 0,
  metadataFetchedAt: now,
  savedAt: now,
  readAt: null,
  createdAt: now,
  updatedAt: now,
};

function plan(): BackupImportPlan {
  return {
    articles: [article],
    articleUrls: [
      {
        normalizedUrl: article.originalUrl as NormalizedUrl,
        articleId: article.id,
        kind: "original",
        createdAt: now,
      },
    ],
    tags: [
      {
        id: "tag-1",
        name: "React",
        normalizedName: "react",
        colorHue: 220,
        createdAt: now,
        updatedAt: now,
      },
    ],
    articleTags: [{ articleId: article.id, tagId: "tag-1", createdAt: now }],
    summary: {
      source: {
        schemaVersion: 2,
        exportedAt: now,
        articles: 1,
        articleUrls: 1,
        tags: 1,
        articleTags: 1,
      },
      changes: {
        articlesCreated: 1,
        articlesMatched: 0,
        articleIdsRemapped: 0,
        articleUrlsCreated: 1,
        articleUrlsMatched: 0,
        articleUrlsSkipped: 0,
        tagsCreated: 1,
        tagsMatched: 0,
        tagsSkipped: 0,
        tagIdsRemapped: 0,
        tagColorsReassigned: 0,
        articleTagsCreated: 1,
        articleTagsMatched: 0,
        articleTagsSkipped: 0,
        pendingArticlesReset: 0,
      },
      hasChanges: true,
    },
  };
}

describe("D1BackupRepository", () => {
  it("sends all inserts in one ordered D1 batch", async () => {
    const statements: { query: string; values: unknown[] }[] = [];
    const batch = vi.fn(async (received: D1PreparedStatement[]) => received.map(() => ({})));
    const binding = {
      prepare: (query: string) => ({
        bind: (...values: unknown[]) => {
          const statement = { query, values };
          statements.push(statement);
          return statement;
        },
      }),
      batch,
    } as unknown as D1Database;

    await createD1BackupRepository(binding).apply(plan());

    expect(batch).toHaveBeenCalledOnce();
    expect(batch.mock.calls[0]?.[0]).toHaveLength(4);
    expect(statements.map(({ query }) => query.trim().split(/\s+/u).slice(0, 3).join(" "))).toEqual(
      [
        "INSERT INTO articles",
        "INSERT INTO tags",
        "INSERT INTO article_urls",
        "INSERT INTO article_tags",
      ],
    );
  });

  it("surfaces a failed atomic batch and does not retry partial writes", async () => {
    const failure = new Error("D1 batch failed");
    const batch = vi.fn(async () => Promise.reject(failure));
    const binding = {
      prepare: (query: string) => ({ bind: (...values: unknown[]) => ({ query, values }) }),
      batch,
    } as unknown as D1Database;

    await expect(createD1BackupRepository(binding).apply(plan())).rejects.toBe(failure);
    expect(batch).toHaveBeenCalledOnce();
  });
});
