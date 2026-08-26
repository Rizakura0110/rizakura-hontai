import type { Article, UpdateArticleInput } from "@tech-inbox/core/article";
import { describe, expect, it } from "vitest";
import { ArticleService } from "./article-service";
import type { ArticleRepository } from "./repositories/article-repository";

const existingArticle: Article = {
  id: "article-1",
  originalUrl: "https://example.com/old",
  canonicalUrl: "https://example.com/canonical",
  title: "Fetched title",
  titleIsManual: false,
  siteName: "Example",
  description: "Fetched description",
  faviconUrl: "https://example.com/favicon.ico",
  imageUrl: "https://example.com/image.png",
  publishedAt: "2026-08-01T00:00:00.000Z",
  status: "read",
  metadataStatus: "ready",
  metadataErrorCode: null,
  metadataAttemptCount: 2,
  metadataFetchedAt: "2026-08-26T00:00:00.000Z",
  savedAt: "2026-08-25T00:00:00.000Z",
  readAt: "2026-08-26T01:00:00.000Z",
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-26T01:00:00.000Z",
};

function repository(overrides: Partial<ArticleRepository> = {}): ArticleRepository {
  return {
    list: async () => ({ items: [], nextCursor: null }),
    findById: async () => existingArticle,
    findByNormalizedUrl: async () => null,
    createWithOriginalAlias: async () => ({ outcome: "created", article: existingArticle }),
    update: async () => ({ outcome: "updated", article: existingArticle }),
    deleteById: async () => ({ outcome: "deleted" }),
    ...overrides,
  };
}

describe("ArticleService", () => {
  it("builds an atomic URL, metadata, manual-title, and read-state update", async () => {
    let received: UpdateArticleInput | undefined;
    const service = new ArticleService(
      repository({
        update: async (input) => {
          received = input;
          return { outcome: "updated", article: existingArticle };
        },
      }),
      () => new Date("2026-08-27T02:03:04.000Z"),
      () => "unused-id",
    );

    await service.update(existingArticle.id, {
      title: "Manual title",
      url: "https://EXAMPLE.com/new/?utm_source=test&a=1",
      status: "unread",
    });

    expect(received).toEqual({
      id: existingArticle.id,
      changes: {
        updatedAt: "2026-08-27T02:03:04.000Z",
        title: "Manual title",
        titleIsManual: true,
        readState: { status: "unread", readAt: null },
        urlChange: {
          originalUrl: "https://EXAMPLE.com/new/?utm_source=test&a=1",
          normalizedUrl: "https://example.com/new?a=1",
        },
        canonicalUrl: null,
        siteName: null,
        description: null,
        faviconUrl: null,
        imageUrl: null,
        publishedAt: null,
        metadataStatus: "pending",
        metadataErrorCode: null,
        metadataAttemptCount: 0,
        metadataFetchedAt: null,
      },
    });
  });

  it("does not replace readAt when the requested status is unchanged", async () => {
    let received: UpdateArticleInput | undefined;
    const service = new ArticleService(
      repository({
        update: async (input) => {
          received = input;
          return { outcome: "updated", article: existingArticle };
        },
      }),
      () => new Date("2026-08-27T02:03:04.000Z"),
      () => "unused-id",
    );

    await service.update(existingArticle.id, { status: "read" });

    expect(received?.changes).toEqual({ updatedAt: "2026-08-27T02:03:04.000Z" });
  });

  it("clears a fetched title when changing URL but preserves manual titles", async () => {
    const received: UpdateArticleInput[] = [];
    const captureRepository = repository({
      update: async (input) => {
        received.push(input);
        return { outcome: "updated", article: existingArticle };
      },
    });
    const service = new ArticleService(
      captureRepository,
      () => new Date("2026-08-27T02:03:04.000Z"),
      () => "unused-id",
    );

    await service.update(existingArticle.id, { url: "https://example.com/new" });
    expect(received[0]?.changes).toMatchObject({ title: null, titleIsManual: false });

    const manualArticle = { ...existingArticle, title: "Manual", titleIsManual: true };
    const manualService = new ArticleService(
      repository({
        findById: async () => manualArticle,
        update: async (input) => {
          received.push(input);
          return { outcome: "updated", article: manualArticle };
        },
      }),
      () => new Date("2026-08-27T02:03:04.000Z"),
      () => "unused-id",
    );
    await manualService.update(manualArticle.id, { url: "https://example.com/newer" });

    expect(received[1]?.changes).not.toHaveProperty("title");
    expect(received[1]?.changes).not.toHaveProperty("titleIsManual");
  });

  it("maps repository URL conflicts to the public conflict error", async () => {
    const service = new ArticleService(
      repository({ update: async () => ({ outcome: "urlConflict" }) }),
      () => new Date("2026-08-27T02:03:04.000Z"),
      () => "unused-id",
    );

    await expect(
      service.update(existingArticle.id, { url: "https://example.com/conflict" }),
    ).rejects.toMatchObject({ status: 409, code: "URL_CONFLICT" });
  });
});
