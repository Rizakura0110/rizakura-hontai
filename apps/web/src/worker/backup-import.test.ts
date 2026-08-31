import type { BackupImportSnapshot } from "@rizakura-me/contracts";
import type { Article, ArticleUrlAlias } from "@tech-inbox/core/article";
import type { Tag } from "@tech-inbox/core/tag";
import type { NormalizedUrl } from "@tech-inbox/core/url-normalization";
import { describe, expect, it } from "vitest";
import { buildBackupImportPlan } from "./backup-import";
import type { ArticleExportSnapshot } from "./repositories/article-repository";

const now = "2026-08-29T00:00:00.000Z";

function article(id: string, originalUrl: string): Article {
  return {
    id,
    originalUrl,
    canonicalUrl: null,
    title: null,
    titleIsManual: false,
    siteName: null,
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
}

function alias(
  normalizedUrl: string,
  articleId: string,
  kind: "original" | "canonical" = "original",
): ArticleUrlAlias {
  return { normalizedUrl: normalizedUrl as NormalizedUrl, articleId, kind, createdAt: now };
}

const existingTag: Tag = {
  id: "tag-existing",
  name: "React",
  normalizedName: "react",
  colorHue: 220,
  createdAt: now,
  updatedAt: now,
};

describe("buildBackupImportPlan", () => {
  it("merges without overwriting and remaps conflicting IDs and colors", () => {
    const existing = article("article-existing", "https://example.com/existing");
    const current: ArticleExportSnapshot = {
      articles: [existing],
      articleUrls: [
        alias(existing.originalUrl, existing.id),
        alias("https://example.com/conflict", existing.id, "canonical"),
      ],
      tags: [existingTag],
      articleTags: [{ articleId: existing.id, tagId: existingTag.id }],
    };
    const pending = {
      ...article("article-existing", "https://example.com/new"),
      canonicalUrl: "https://example.com/conflict",
      metadataStatus: "pending" as const,
      metadataErrorCode: null,
      metadataAttemptCount: 0,
      metadataFetchedAt: null,
    };
    const backup: BackupImportSnapshot = {
      schemaVersion: 2,
      exportedAt: now,
      articles: [article("source-match", existing.originalUrl), pending],
      articleUrls: [
        alias(existing.originalUrl, "source-match"),
        alias("https://example.com/new", pending.id),
        alias("https://example.com/conflict", pending.id, "canonical"),
      ],
      tags: [
        { id: "source-react", name: "ＲＥＡＣＴ", colorHue: 40, createdAt: now, updatedAt: now },
        { id: existingTag.id, name: "Cloudflare", colorHue: 220, createdAt: now, updatedAt: now },
      ],
      articleTags: [
        { articleId: "source-match", tagId: "source-react" },
        { articleId: pending.id, tagId: "source-react" },
        { articleId: pending.id, tagId: existingTag.id },
      ],
    };
    const generatedIds = ["article-remapped", "tag-remapped"];
    const plan = buildBackupImportPlan(current, backup, now, () => generatedIds.shift() ?? "id");

    expect(plan.articles).toEqual([
      expect.objectContaining({
        id: "article-remapped",
        originalUrl: "https://example.com/new",
        canonicalUrl: null,
        metadataStatus: "failed",
        metadataErrorCode: "NETWORK_ERROR",
        metadataFetchedAt: now,
      }),
    ]);
    expect(plan.articleUrls).toEqual([
      expect.objectContaining({
        normalizedUrl: "https://example.com/new",
        articleId: "article-remapped",
      }),
    ]);
    expect(plan.tags).toEqual([
      expect.objectContaining({
        id: "tag-remapped",
        name: "Cloudflare",
        normalizedName: "cloudflare",
      }),
    ]);
    expect(plan.tags[0]?.colorHue).not.toBe(existingTag.colorHue);
    expect(plan.articleTags).toEqual([
      { articleId: "article-remapped", tagId: existingTag.id, createdAt: now },
      { articleId: "article-remapped", tagId: "tag-remapped", createdAt: now },
    ]);
    expect(plan.summary).toMatchObject({
      hasChanges: true,
      changes: {
        articlesCreated: 1,
        articlesMatched: 1,
        articleIdsRemapped: 1,
        articleUrlsCreated: 1,
        articleUrlsMatched: 1,
        articleUrlsSkipped: 1,
        tagsCreated: 1,
        tagsMatched: 1,
        tagIdsRemapped: 1,
        tagColorsReassigned: 1,
        articleTagsCreated: 2,
        articleTagsMatched: 1,
        pendingArticlesReset: 1,
      },
    });
  });

  it("produces an idempotent no-op for an identical v1 backup", () => {
    const existing = article("article-existing", "https://example.com/existing");
    const current: ArticleExportSnapshot = {
      articles: [existing],
      articleUrls: [alias(existing.originalUrl, existing.id)],
      tags: [],
      articleTags: [],
    };
    const backup: BackupImportSnapshot = {
      schemaVersion: 1,
      exportedAt: now,
      articles: [existing],
      articleUrls: [alias(existing.originalUrl, existing.id)],
    };

    const plan = buildBackupImportPlan(current, backup, now, () => "unused");

    expect(plan).toMatchObject({
      articles: [],
      articleUrls: [],
      tags: [],
      articleTags: [],
      summary: {
        hasChanges: false,
        changes: { articlesMatched: 1, articleUrlsMatched: 1 },
      },
    });
  });
});
