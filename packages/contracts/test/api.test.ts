import { describe, expect, it } from "vitest";
import {
  apiErrorResponseSchema,
  createArticleRequestSchema,
  createArticleResponseSchema,
  listArticlesQuerySchema,
  listArticlesResponseSchema,
  updateArticleRequestSchema,
} from "../src/api";
import { articleDtoSchema } from "../src/article";
import { CONTRACT_LIMITS } from "../src/primitives";
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
      createArticleResponseSchema.safeParse({ result, article: articleDtoFixture() }).success,
    ).toBe(true);
  });

  it("validates list response cursors strictly", () => {
    expect(
      listArticlesResponseSchema.safeParse({
        articles: [articleDtoFixture()],
        nextCursor: "eyJ2IjoxfQ",
      }).success,
    ).toBe(true);
    expect(
      listArticlesResponseSchema.safeParse({
        articles: [],
        nextCursor: "not+base64url",
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
});
