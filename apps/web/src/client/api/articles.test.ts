import type { ArticleDto, ExportResponse } from "@rizakura-hontai/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
  createArticle,
  deleteArticle,
  exportArticles,
  listArticles,
  retryArticleMetadata,
  updateArticle,
  userFacingError,
} from "./articles";

const now = "2026-08-27T01:02:03.000Z";
const article: ArticleDto = {
  id: "article/1",
  originalUrl: "https://example.org/article",
  canonicalUrl: null,
  title: "Example",
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

const exported: ExportResponse = {
  schemaVersion: 2,
  exportedAt: now,
  articles: [article],
  articleUrls: [
    {
      normalizedUrl: article.originalUrl,
      articleId: article.id,
      kind: "original",
      createdAt: now,
    },
  ],
  tags: [],
  articleTags: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("article API client", () => {
  it("validates every success response and sends safe same-origin requests", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const path = String(input);
        if (path.startsWith("/api/v1/articles?") && init?.method === undefined) {
          return jsonResponse({
            articles: [article],
            availableTags: [],
            tagsByArticleId: { [article.id]: [] },
            nextCursor: null,
          });
        }
        if (path === "/api/v1/export") return jsonResponse(exported);
        if (path === "/api/v1/articles" && init?.method === "POST") {
          return jsonResponse({ result: "created", article, tags: [] }, 201);
        }
        if (path.endsWith("/retry-metadata")) return jsonResponse({ article });
        if (init?.method === "PATCH") return jsonResponse({ article });
        if (init?.method === "DELETE") return jsonResponse({ result: "deleted" });
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(
      listArticles({
        status: "all",
        query: "Example Query",
        tagId: "tag-react",
        sort: "saved_asc",
        limit: 10,
        cursor: "cursor_1",
        signal: controller.signal,
      }),
    ).resolves.toEqual({
      articles: [article],
      availableTags: [],
      tagsByArticleId: { [article.id]: [] },
      nextCursor: null,
    });
    await expect(exportArticles({ signal: controller.signal })).resolves.toEqual(exported);
    await expect(
      createArticle(article.originalUrl, { tagIds: ["tag-react"] }),
    ).resolves.toMatchObject({
      result: "created",
      tags: [],
    });
    await expect(updateArticle(article.id, { title: "Updated" })).resolves.toEqual(article);
    await expect(deleteArticle(article.id)).resolves.toBeUndefined();
    await expect(retryArticleMetadata(article.id)).resolves.toEqual(article);

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/api/v1/articles?status=all&sort=saved_asc&limit=10&q=Example+Query&tagId=tag-react&cursor=cursor_1",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    const mutationCalls = fetchMock.mock.calls.filter(([, init]) => init?.body !== undefined);
    expect(mutationCalls).toHaveLength(4);
    for (const [, init] of mutationCalls) {
      const headers = new Headers(init?.headers);
      expect(headers.get("Accept")).toBe("application/json");
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("X-Rizakura-Hontai-Client")).toBe("web");
      expect(headers.get("X-Tech-Inbox-Client")).toBe("web");
      expect(init?.credentials).toBe("same-origin");
    }
    expect(fetchMock.mock.calls.map(([path]) => String(path))).toContain(
      "/api/v1/articles/article%2F1",
    );
    const createCall = fetchMock.mock.calls.find(
      ([path, init]) => String(path) === "/api/v1/articles" && init?.method === "POST",
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      url: article.originalUrl,
      tagIds: ["tag-react"],
    });
  });

  it("uses list defaults without adding empty optional query parameters", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) =>
      jsonResponse({ articles: [], availableTags: [], tagsByArticleId: {}, nextCursor: null }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listArticles({ status: "unread", query: "", sort: "saved_desc" });

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/api/v1/articles?status=unread&sort=saved_desc&limit=30",
    );
  });

  it("preserves a validated server error and request id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "URL_CONFLICT",
              message: "このURLは登録済みです。",
              requestId: "123e4567-e89b-42d3-a456-426614174000",
            },
          },
          409,
        ),
      ),
    );

    await expect(updateArticle(article.id, { url: article.originalUrl })).rejects.toMatchObject({
      name: "ApiClientError",
      code: "URL_CONFLICT",
      message: "このURLは登録済みです。",
      requestId: "123e4567-e89b-42d3-a456-426614174000",
      status: 409,
    });
  });

  it("maps invalid JSON and malformed error responses to safe client errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("not-json", { status: 502 }))
      .mockResolvedValueOnce(jsonResponse({ internal: "hidden" }, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(exportArticles()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      message: "サーバーから正しいJSON応答を受け取れませんでした。",
      status: 502,
    });
    await expect(exportArticles()).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
      message: "リクエストを完了できませんでした。",
      status: 500,
    });
  });
});

describe("userFacingError", () => {
  it("returns server messages, suppresses aborts, and hides unknown errors", () => {
    expect(userFacingError(new ApiClientError("安全なメッセージ", 400, "VALIDATION_ERROR"))).toBe(
      "安全なメッセージ",
    );
    expect(userFacingError(new DOMException("aborted", "AbortError"))).toBe("");
    expect(userFacingError(new Error("private detail"))).toBe(
      "通信に失敗しました。時間をおいて再度お試しください。",
    );
  });
});
