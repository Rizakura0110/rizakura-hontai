import type { Article, UpdateArticleInput } from "@tech-inbox/core/article";
import type { Tag } from "@tech-inbox/core/tag";
import type { NormalizedUrl } from "@tech-inbox/core/url-normalization";
import { describe, expect, it, vi } from "vitest";
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

const existingTag: Tag = {
  id: "tag-react",
  name: "React",
  normalizedName: "react",
  colorHue: 220,
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

function repository(overrides: Partial<ArticleRepository> = {}): ArticleRepository {
  return {
    list: async () => ({ items: [], availableTags: [], tagsByArticleId: {}, nextCursor: null }),
    exportAll: async () => ({ articles: [], articleUrls: [] }),
    findById: async () => existingArticle,
    findByNormalizedUrl: async () => null,
    createWithOriginalAlias: async () => ({ outcome: "created", article: existingArticle }),
    update: async () => ({ outcome: "updated", article: existingArticle }),
    applyMetadata: async () => ({ outcome: "updated", article: existingArticle }),
    recordMetadataFailure: async () => ({ outcome: "updated", article: existingArticle }),
    deleteById: async () => ({ outcome: "deleted" }),
    ...overrides,
  };
}

describe("ArticleService", () => {
  it("includes assigned tags and binds the tag filter into list criteria", async () => {
    const list = vi.fn<ArticleRepository["list"]>(async () => ({
      items: [existingArticle],
      availableTags: [existingTag],
      tagsByArticleId: { [existingArticle.id]: [existingTag] },
      nextCursor: null,
    }));
    const service = new ArticleService(
      repository({ list }),
      () => new Date("2026-08-28T00:00:00.000Z"),
      () => "unused-id",
      { send: async () => undefined },
    );

    await expect(
      service.list({ status: "all", tagId: existingTag.id, sort: "saved_desc", limit: 30 }),
    ).resolves.toMatchObject({
      articles: [{ id: existingArticle.id }],
      availableTags: [{ id: existingTag.id, colorHue: existingTag.colorHue }],
      tagsByArticleId: { [existingArticle.id]: [{ id: existingTag.id }] },
      nextCursor: null,
    });
    expect(list).toHaveBeenCalledWith({
      status: "all",
      search: null,
      site: null,
      tagId: existingTag.id,
      sort: "saved_desc",
      limit: 30,
      cursor: null,
    });
  });

  it("creates a complete versioned export snapshot", async () => {
    const service = new ArticleService(
      repository({
        exportAll: async () => ({
          articles: [existingArticle],
          articleUrls: [
            {
              normalizedUrl: "https://example.com/old" as NormalizedUrl,
              articleId: existingArticle.id,
              kind: "original",
              createdAt: existingArticle.createdAt,
            },
          ],
        }),
      }),
      () => new Date("2026-08-27T02:03:04.000Z"),
      () => "unused-id",
      { send: async () => undefined },
    );

    await expect(service.exportAll()).resolves.toEqual({
      schemaVersion: 1,
      exportedAt: "2026-08-27T02:03:04.000Z",
      articles: [
        expect.objectContaining({
          id: existingArticle.id,
          originalUrl: existingArticle.originalUrl,
        }),
      ],
      articleUrls: [
        {
          normalizedUrl: "https://example.com/old",
          articleId: existingArticle.id,
          kind: "original",
          createdAt: existingArticle.createdAt,
        },
      ],
    });
  });

  it("exports more articles than the list API page limit without truncation", async () => {
    const articles = Array.from(
      { length: 101 },
      (_, index): Article => ({
        ...existingArticle,
        id: `article-${index}`,
        originalUrl: `https://example.com/articles/${index}`,
      }),
    );
    const service = new ArticleService(
      repository({ exportAll: async () => ({ articles, articleUrls: [] }) }),
      () => new Date("2026-08-27T02:03:04.000Z"),
      () => "unused-id",
      { send: async () => undefined },
    );

    const exported = await service.exportAll();
    expect(exported.articles).toHaveLength(101);
    expect(new Set(exported.articles.map(({ id }) => id)).size).toBe(101);
  });

  it("enqueues a newly created article but not an existing duplicate", async () => {
    const send = vi.fn(async () => undefined);
    const createdService = new ArticleService(
      repository({
        createWithOriginalAlias: async () => ({ outcome: "created", article: existingArticle }),
      }),
      () => new Date("2026-08-27T02:03:04.000Z"),
      () => "article-new",
      { send },
    );
    const duplicateService = new ArticleService(
      repository({
        createWithOriginalAlias: async () => ({
          outcome: "alreadyExists",
          article: existingArticle,
        }),
      }),
      () => new Date("2026-08-27T02:03:04.000Z"),
      () => "article-duplicate",
      { send },
    );

    await createdService.create({ url: existingArticle.originalUrl });
    await duplicateService.create({ url: existingArticle.originalUrl });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      articleId: existingArticle.id,
      url: existingArticle.originalUrl,
      attempt: 0,
    });
  });

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
      { send: async () => undefined },
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
      { send: async () => undefined },
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
      { send: async () => undefined },
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
      { send: async () => undefined },
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
      { send: async () => undefined },
    );

    await expect(
      service.update(existingArticle.id, { url: "https://example.com/conflict" }),
    ).rejects.toMatchObject({ status: 409, code: "URL_CONFLICT" });
  });
});
