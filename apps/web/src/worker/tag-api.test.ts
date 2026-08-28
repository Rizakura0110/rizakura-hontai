import type { Article } from "@tech-inbox/core/article";
import type { Tag } from "@tech-inbox/core/tag";
import { describe, expect, it, vi } from "vitest";
import { createApp, type AppBindings, type RequestLogEvent } from "./app";
import { ApiError } from "./errors";
import type { ArticleRepository } from "./repositories/article-repository";
import type { TagRepository } from "./repositories/tag-repository";

const origin = "http://localhost";
const now = "2026-08-28T00:00:00.000Z";
const tag: Tag = {
  id: "tag-1",
  name: "React",
  normalizedName: "react",
  colorHue: 220,
  createdAt: now,
  updatedAt: now,
};

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

function articleRepository(): ArticleRepository {
  return {
    list: async () => ({
      items: [article],
      availableTags: [],
      tagsByArticleId: { [article.id]: [] },
      nextCursor: null,
    }),
    exportAll: async () => ({ articles: [article], articleUrls: [] }),
    findById: async () => article,
    findByNormalizedUrl: async () => null,
    createWithOriginalAlias: async () => ({ outcome: "created", article }),
    update: async () => ({ outcome: "updated", article }),
    applyMetadata: async () => ({ outcome: "updated", article }),
    recordMetadataFailure: async () => ({ outcome: "updated", article }),
    deleteById: async () => ({ outcome: "deleted" }),
  };
}

function tagRepository(overrides: Partial<TagRepository> = {}): TagRepository {
  return {
    list: async () => [tag],
    findById: async () => tag,
    findByNormalizedName: async () => null,
    create: async (input) => ({ outcome: "created", tag: input }),
    updateName: async (input) => ({ outcome: "updated", tag: { ...tag, ...input } }),
    deleteById: async () => ({ outcome: "deleted" }),
    listForArticle: async () => ({ outcome: "found", tags: [tag] }),
    replaceArticleTags: async () => ({ outcome: "updated", tags: [tag] }),
    ...overrides,
  };
}

function localBindings(): AppBindings {
  const allow = { limit: async () => ({ success: true }) } as RateLimit;
  return {
    DB: {} as D1Database,
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

const mutationHeaders = {
  "Content-Type": "application/json",
  Origin: origin,
  "X-Tech-Inbox-Client": "web",
};

describe("tag API", () => {
  it("supports tag CRUD and article assignment routes", async () => {
    const events: RequestLogEvent[] = [];
    const replaceArticleTags = vi.fn<TagRepository["replaceArticleTags"]>(async () => ({
      outcome: "updated",
      tags: [tag],
    }));
    const app = createApp({
      repositoryFactory: articleRepository,
      tagRepositoryFactory: () => tagRepository({ replaceArticleTags }),
      clock: () => new Date(now),
      idGenerator: () => "tag-new",
      log: (event) => events.push(event),
    });
    const bindings = localBindings();

    const listed = await app.request(`${origin}/api/v1/tags`, undefined, bindings);
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toEqual({
      tags: [
        {
          id: tag.id,
          name: tag.name,
          colorHue: tag.colorHue,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        },
      ],
    });

    const created = await app.request(
      `${origin}/api/v1/tags`,
      { method: "POST", headers: mutationHeaders, body: JSON.stringify({ name: "Cloudflare" }) },
      bindings,
    );
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      result: "created",
      tag: { id: "tag-new", name: "Cloudflare", colorHue: 40 },
    });

    const renamed = await app.request(
      `${origin}/api/v1/tags/${tag.id}`,
      { method: "PATCH", headers: mutationHeaders, body: JSON.stringify({ name: "TypeScript" }) },
      bindings,
    );
    expect(renamed.status).toBe(200);
    await expect(renamed.json()).resolves.toMatchObject({
      tag: { id: tag.id, name: "TypeScript", colorHue: tag.colorHue },
    });

    const assigned = await app.request(
      `${origin}/api/v1/articles/${article.id}/tags`,
      {
        method: "PUT",
        headers: mutationHeaders,
        body: JSON.stringify({ tagIds: [tag.id] }),
      },
      bindings,
    );
    expect(assigned.status).toBe(200);
    await expect(assigned.json()).resolves.toMatchObject({ tags: [{ id: tag.id }] });
    expect(replaceArticleTags).toHaveBeenCalledWith({
      articleId: article.id,
      tagIds: [tag.id],
      createdAt: now,
    });

    const articleTags = await app.request(
      `${origin}/api/v1/articles/${article.id}/tags`,
      undefined,
      bindings,
    );
    expect(articleTags.status).toBe(200);
    await expect(articleTags.json()).resolves.toMatchObject({ tags: [{ id: tag.id }] });

    const deleted = await app.request(
      `${origin}/api/v1/tags/${tag.id}`,
      { method: "DELETE", headers: mutationHeaders },
      bindings,
    );
    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toEqual({ result: "deleted" });

    expect(events.map(({ route, status }) => [route, status])).toEqual([
      ["tags.list", 200],
      ["tags.create", 201],
      ["tags.update", 200],
      ["article_tags.replace", 200],
      ["article_tags.list", 200],
      ["tags.delete", 200],
    ]);
  });

  it("rejects unknown fields and missing resources safely", async () => {
    const app = createApp({
      repositoryFactory: articleRepository,
      tagRepositoryFactory: () =>
        tagRepository({
          deleteById: async () => ({ outcome: "notFound" }),
          replaceArticleTags: async () => ({ outcome: "tagNotFound" }),
        }),
      log: () => undefined,
    });
    const bindings = localBindings();

    const invalid = await app.request(
      `${origin}/api/v1/tags`,
      {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ name: "React", colorHue: 1 }),
      },
      bindings,
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });

    const missingTag = await app.request(
      `${origin}/api/v1/articles/${article.id}/tags`,
      {
        method: "PUT",
        headers: mutationHeaders,
        body: JSON.stringify({ tagIds: ["missing"] }),
      },
      bindings,
    );
    expect(missingTag.status).toBe(400);
    await expect(missingTag.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });

    const missingDelete = await app.request(
      `${origin}/api/v1/tags/missing`,
      { method: "DELETE", headers: mutationHeaders },
      bindings,
    );
    expect(missingDelete.status).toBe(404);
    await expect(missingDelete.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("protects tag data before constructing its repository", async () => {
    const tagRepositoryFactory = vi.fn(() => tagRepository());
    const app = createApp({
      repositoryFactory: articleRepository,
      tagRepositoryFactory,
      authenticateAccess: async () => {
        throw new ApiError(401, "UNAUTHORIZED", "認証が必要です。");
      },
      log: () => undefined,
    });
    const bindings = { ...localBindings(), ENVIRONMENT: "production" };

    const response = await app.request(`${origin}/api/v1/tags`, undefined, bindings);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(tagRepositoryFactory).not.toHaveBeenCalled();
  });
});
