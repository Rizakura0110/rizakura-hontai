import { describe, expect, it } from "vitest";
import {
  apiErrorResponseSchema,
  backupImportRequestSchema,
  createArticleRequestSchema,
  createArticleResponseSchema,
  createTagRequestSchema,
  createTagResponseSchema,
  exportResponseSchema,
  listArticlesQuerySchema,
  listArticlesResponseSchema,
  replaceArticleTagsRequestSchema,
  updateArticleRequestSchema,
} from "../src/api";
import { articleDtoSchema } from "../src/article";
import { CONTRACT_LIMITS } from "../src/primitives";
import { tagDtoSchema } from "../src/tag";
import { articleDtoFixture } from "./fixtures";

const urlWithLength = (length: number): string => {
  const prefix = "https://example.com/";
  return `${prefix}${"a".repeat(length - prefix.length)}`;
};

describe("API request contracts", () => {
  it("applies documented list defaults and coerces a valid limit", () => {
    expect(listArticlesQuerySchema.parse({})).toEqual({
      status: "all",
      sort: "saved_desc",
      limit: 30,
    });

    expect(listArticlesQuerySchema.parse({ limit: "100" }).limit).toBe(100);
  });

  it.each([0, 101, 1.5, "invalid", "", " ", true])("rejects invalid list limit %s", (limit) => {
    expect(listArticlesQuerySchema.safeParse({ limit }).success).toBe(false);
  });

  it("enforces search-query boundaries", () => {
    expect(
      listArticlesQuerySchema.safeParse({ q: "q".repeat(CONTRACT_LIMITS.searchQuery) }).success,
    ).toBe(true);
    expect(
      listArticlesQuerySchema.safeParse({
        q: "q".repeat(CONTRACT_LIMITS.searchQuery + 1),
      }).success,
    ).toBe(false);
  });

  it("accepts a tag filter and rejects an empty tag id", () => {
    expect(listArticlesQuerySchema.parse({ tagId: " tag-react " }).tagId).toBe("tag-react");
    expect(listArticlesQuerySchema.safeParse({ tagId: " " }).success).toBe(false);
  });

  it("rejects invalid enums, malformed cursors, and unknown query fields", () => {
    expect(listArticlesQuerySchema.safeParse({ status: "archived" }).success).toBe(false);
    expect(listArticlesQuerySchema.safeParse({ sort: "title_asc" }).success).toBe(false);
    expect(listArticlesQuerySchema.safeParse({ cursor: "has=padding" }).success).toBe(false);
    expect(listArticlesQuerySchema.safeParse({ unexpected: true }).success).toBe(false);
  });

  it("accepts the maximum URL length and rejects a longer URL", () => {
    expect(
      createArticleRequestSchema.safeParse({ url: urlWithLength(CONTRACT_LIMITS.url) }).success,
    ).toBe(true);
    expect(
      createArticleRequestSchema.safeParse({ url: urlWithLength(CONTRACT_LIMITS.url + 1) }).success,
    ).toBe(false);
    expect(
      createArticleRequestSchema.safeParse({
        url: `  ${urlWithLength(CONTRACT_LIMITS.url)}  `,
      }).success,
    ).toBe(true);
  });

  it("trims an HTTP URL and rejects unsafe URL forms", () => {
    expect(createArticleRequestSchema.parse({ url: "  https://example.com/article  " })).toEqual({
      url: "https://example.com/article",
      tagIds: [],
    });
    expect(createArticleRequestSchema.safeParse({ url: "file:///tmp/article" }).success).toBe(
      false,
    );
    expect(
      createArticleRequestSchema.safeParse({ url: "https://user:secret@example.com/article" })
        .success,
    ).toBe(false);
    expect(createArticleRequestSchema.safeParse({ url: "not a URL" }).success).toBe(false);
  });

  it.each([
    "http://192.0.2.1/article",
    "https://[2001:db8::1]/article",
    "https://例え.テスト/資料",
  ])("accepts a syntactically valid URL for later fetch-policy validation: %s", (url) => {
    expect(createArticleRequestSchema.safeParse({ url }).success).toBe(true);
  });

  it("rejects unknown create fields", () => {
    expect(
      createArticleRequestSchema.safeParse({
        url: "https://example.com/article",
        status: "read",
      }).success,
    ).toBe(false);
  });

  it("accepts up to ten unique tags when creating an article", () => {
    expect(
      createArticleRequestSchema.parse({
        url: "https://example.com/article",
        tagIds: ["tag-react", "tag-cloudflare"],
      }).tagIds,
    ).toEqual(["tag-react", "tag-cloudflare"]);
    expect(
      createArticleRequestSchema.safeParse({
        url: "https://example.com/article",
        tagIds: ["tag-react", "tag-react"],
      }).success,
    ).toBe(false);
    expect(
      createArticleRequestSchema.safeParse({
        url: "https://example.com/article",
        tagIds: Array.from({ length: 11 }, (_, index) => `tag-${index}`),
      }).success,
    ).toBe(false);
  });

  it("requires at least one PATCH field and rejects server-managed or unknown fields", () => {
    expect(updateArticleRequestSchema.safeParse({}).success).toBe(false);
    expect(updateArticleRequestSchema.safeParse({ status: "read" }).success).toBe(true);
    expect(updateArticleRequestSchema.safeParse({ status: "archived" }).success).toBe(false);
    expect(updateArticleRequestSchema.safeParse({ metadataStatus: "ready" }).success).toBe(false);
    expect(updateArticleRequestSchema.safeParse({ unexpected: true }).success).toBe(false);
  });

  it("enforces the title boundary", () => {
    expect(
      updateArticleRequestSchema.safeParse({ title: "t".repeat(CONTRACT_LIMITS.title) }).success,
    ).toBe(true);
    expect(
      updateArticleRequestSchema.safeParse({ title: "t".repeat(CONTRACT_LIMITS.title + 1) })
        .success,
    ).toBe(false);
  });

  it("normalizes tag names and enforces tag assignment limits", () => {
    expect(createTagRequestSchema.parse({ name: "  Ｒｅａｃｔ\n 入門  " })).toEqual({
      name: "React 入門",
    });
    expect(createTagRequestSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(
      createTagRequestSchema.safeParse({ name: "a".repeat(CONTRACT_LIMITS.tagName + 1) }).success,
    ).toBe(false);

    expect(replaceArticleTagsRequestSchema.safeParse({ tagIds: ["tag-1", "tag-2"] }).success).toBe(
      true,
    );
    expect(replaceArticleTagsRequestSchema.safeParse({ tagIds: ["tag-1", "tag-1"] }).success).toBe(
      false,
    );
    expect(
      replaceArticleTagsRequestSchema.safeParse({
        tagIds: Array.from(
          { length: CONTRACT_LIMITS.tagsPerArticle + 1 },
          (_, index) => `tag-${index}`,
        ),
      }).success,
    ).toBe(false);
  });
});

describe("API response contracts", () => {
  it("accepts a camelCase article DTO and rejects DB-shaped or unknown fields", () => {
    expect(articleDtoSchema.safeParse(articleDtoFixture()).success).toBe(true);

    const { originalUrl: _originalUrl, ...withoutOriginalUrl } = articleDtoFixture();
    expect(
      articleDtoSchema.safeParse({
        ...withoutOriginalUrl,
        original_url: "https://example.com/articles/1",
      }).success,
    ).toBe(false);
    expect(articleDtoSchema.safeParse({ ...articleDtoFixture(), internal: true }).success).toBe(
      false,
    );
  });

  it("accepts UTC timestamps and rejects offset timestamps", () => {
    expect(articleDtoSchema.safeParse(articleDtoFixture()).success).toBe(true);
    expect(
      articleDtoSchema.safeParse(articleDtoFixture({ savedAt: "2026-08-26T10:02:03.000+09:00" }))
        .success,
    ).toBe(false);
  });

  it("enforces the article status and readAt invariant", () => {
    expect(
      articleDtoSchema.safeParse(
        articleDtoFixture({ status: "unread", readAt: "2026-08-26T01:02:03.000Z" }),
      ).success,
    ).toBe(false);
    expect(
      articleDtoSchema.safeParse(articleDtoFixture({ status: "read", readAt: null })).success,
    ).toBe(false);
    expect(
      articleDtoSchema.safeParse(
        articleDtoFixture({ status: "read", readAt: "2026-08-26T01:02:03.000Z" }),
      ).success,
    ).toBe(true);
  });

  it.each(["created", "alreadyExists"] as const)("accepts the %s create result", (result) => {
    expect(
      createArticleResponseSchema.safeParse({ result, article: articleDtoFixture(), tags: [] })
        .success,
    ).toBe(true);
  });

  it("validates list response cursors strictly", () => {
    expect(
      listArticlesResponseSchema.safeParse({
        articles: [articleDtoFixture()],
        availableTags: [],
        tagsByArticleId: { "article-1": [] },
        nextCursor: "eyJ2IjoxfQ",
      }).success,
    ).toBe(true);
    expect(
      listArticlesResponseSchema.safeParse({
        articles: [],
        availableTags: [],
        tagsByArticleId: {},
        nextCursor: "not+base64url",
      }).success,
    ).toBe(false);
    expect(
      listArticlesResponseSchema.safeParse({
        articles: [articleDtoFixture()],
        availableTags: [],
        tagsByArticleId: {},
        nextCursor: null,
      }).success,
    ).toBe(false);
    expect(
      listArticlesResponseSchema.safeParse({
        articles: [articleDtoFixture()],
        availableTags: [],
        tagsByArticleId: {
          "article-1": [
            {
              id: "tag-1",
              name: "React",
              colorHue: 220,
              createdAt: "2026-08-27T00:00:00.000Z",
              updatedAt: "2026-08-27T00:00:00.000Z",
            },
          ],
        },
        nextCursor: null,
      }).success,
    ).toBe(false);
    expect(
      listArticlesResponseSchema.safeParse({
        articles: [],
        availableTags: Array.from({ length: CONTRACT_LIMITS.tags + 1 }, (_, index) => ({
          id: `tag-${index}`,
          name: `Tag ${index}`,
          colorHue: index,
          createdAt: "2026-08-27T00:00:00.000Z",
          updatedAt: "2026-08-27T00:00:00.000Z",
        })),
        tagsByArticleId: {},
        nextCursor: null,
      }).success,
    ).toBe(false);
  });

  it("accepts v1 exports and v2 exports with normalized tag relationships", () => {
    const exportedV1 = {
      schemaVersion: 1,
      exportedAt: "2026-08-27T00:00:00.000Z",
      articles: [articleDtoFixture()],
      articleUrls: [
        {
          normalizedUrl: "https://example.com/articles/1",
          articleId: "article-1",
          kind: "original",
          createdAt: "2026-08-26T01:02:03.000Z",
        },
      ],
    };
    const tag = {
      id: "tag-1",
      name: "React",
      colorHue: 220,
      createdAt: "2026-08-27T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    };
    const exportedV2 = {
      ...exportedV1,
      schemaVersion: 2,
      tags: [tag],
      articleTags: [{ articleId: "article-1", tagId: tag.id }],
    };

    expect(exportResponseSchema.safeParse(exportedV1).success).toBe(true);
    expect(exportResponseSchema.safeParse(exportedV2).success).toBe(true);
    expect(exportResponseSchema.safeParse({ ...exportedV1, schemaVersion: 3 }).success).toBe(false);
    expect(
      exportResponseSchema.safeParse({ ...exportedV1, TEAM_DOMAIN: "secret.example" }).success,
    ).toBe(false);
    expect(
      exportResponseSchema.safeParse({
        ...exportedV1,
        articleUrls: [{ ...exportedV1.articleUrls[0], internalId: "secret" }],
      }).success,
    ).toBe(false);
    expect(
      exportResponseSchema.safeParse({
        ...exportedV1,
        articleUrls: [{ ...exportedV1.articleUrls[0], articleId: "missing-article" }],
      }).success,
    ).toBe(false);
    expect(
      exportResponseSchema.safeParse({
        ...exportedV2,
        articleTags: [{ articleId: "missing-article", tagId: tag.id }],
      }).success,
    ).toBe(false);
    expect(
      exportResponseSchema.safeParse({
        ...exportedV2,
        articleTags: [{ articleId: "article-1", tagId: "missing-tag" }],
      }).success,
    ).toBe(false);
    expect(
      exportResponseSchema.safeParse({
        ...exportedV2,
        articleTags: [
          { articleId: "article-1", tagId: tag.id },
          { articleId: "article-1", tagId: tag.id },
        ],
      }).success,
    ).toBe(false);

    const tagsOverArticleLimit = Array.from(
      { length: CONTRACT_LIMITS.tagsPerArticle + 1 },
      (_, index) => ({ ...tag, id: `tag-${index}`, name: `Tag ${index}`, colorHue: index }),
    );
    expect(
      exportResponseSchema.safeParse({
        ...exportedV2,
        tags: tagsOverArticleLimit,
        articleTags: tagsOverArticleLimit.map(({ id }) => ({
          articleId: "article-1",
          tagId: id,
        })),
      }).success,
    ).toBe(false);
  });

  it("accepts only the safe API error envelope", () => {
    const safeError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "入力内容を確認してください。",
        requestId: "123e4567-e89b-42d3-a456-426614174000",
        details: { url: ["URLが不正です。"] },
      },
    };

    expect(apiErrorResponseSchema.safeParse(safeError).success).toBe(true);
    expect(
      apiErrorResponseSchema.safeParse({
        ...safeError,
        error: { ...safeError.error, stack: "secret stack" },
      }).success,
    ).toBe(false);
    expect(
      apiErrorResponseSchema.safeParse({
        ...safeError,
        error: { ...safeError.error, code: "SQLITE_ERROR" },
      }).success,
    ).toBe(false);
  });

  it("accepts only internally consistent Tech Inbox backups for import", () => {
    const article = articleDtoFixture();
    const backup = {
      backup: {
        schemaVersion: 2,
        exportedAt: "2026-08-27T00:00:00.000Z",
        articles: [article],
        articleUrls: [
          {
            normalizedUrl: "https://example.com/articles/1",
            articleId: article.id,
            kind: "original",
            createdAt: article.createdAt,
          },
        ],
        tags: [
          {
            id: "tag-1",
            name: "React",
            colorHue: 220,
            createdAt: article.createdAt,
            updatedAt: article.updatedAt,
          },
        ],
        articleTags: [{ articleId: article.id, tagId: "tag-1" }],
      },
    } as const;

    expect(backupImportRequestSchema.safeParse(backup).success).toBe(true);
    expect(
      backupImportRequestSchema.safeParse({
        backup: {
          schemaVersion: 1,
          exportedAt: backup.backup.exportedAt,
          articles: backup.backup.articles,
          articleUrls: backup.backup.articleUrls,
        },
      }).success,
    ).toBe(true);
    expect(
      backupImportRequestSchema.safeParse({
        backup: {
          ...backup.backup,
          articles: [article, article],
          articleUrls: [backup.backup.articleUrls[0], backup.backup.articleUrls[0]],
        },
      }).success,
    ).toBe(false);
    expect(
      backupImportRequestSchema.safeParse({
        backup: {
          ...backup.backup,
          tags: [
            backup.backup.tags[0],
            { ...backup.backup.tags[0], name: "Cloudflare", colorHue: 40 },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      backupImportRequestSchema.safeParse({
        backup: {
          ...backup.backup,
          tags: [
            backup.backup.tags[0],
            { ...backup.backup.tags[0], id: "tag-2", name: "Cloudflare" },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      backupImportRequestSchema.safeParse({
        backup: {
          ...backup.backup,
          articleUrls: [
            { ...backup.backup.articleUrls[0], normalizedUrl: "https://example.com/articles/1/" },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      backupImportRequestSchema.safeParse({
        backup: { ...backup.backup, articleUrls: [] },
      }).success,
    ).toBe(false);
    expect(
      backupImportRequestSchema.safeParse({
        backup: {
          ...backup.backup,
          tags: [
            backup.backup.tags[0],
            { ...backup.backup.tags[0], id: "tag-2", name: "ＲＥＡＣＴ", colorHue: 40 },
          ],
        },
      }).success,
    ).toBe(false);
  });

  it("accepts public tag fields and both create outcomes", () => {
    const tag = {
      id: "tag-1",
      name: "React",
      colorHue: 220,
      createdAt: "2026-08-27T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    };

    expect(tagDtoSchema.safeParse(tag).success).toBe(true);
    expect(tagDtoSchema.safeParse({ ...tag, normalizedName: "react" }).success).toBe(false);
    expect(tagDtoSchema.safeParse({ ...tag, colorHue: 360 }).success).toBe(false);
    for (const result of ["created", "alreadyExists"] as const) {
      expect(createTagResponseSchema.safeParse({ result, tag }).success).toBe(true);
    }
  });
});
