import type {
  CreateArticleRequest,
  CreateArticleResponse,
  ListArticlesQuery,
  ListArticlesResponse,
  UpdateArticleRequest,
} from "@tech-inbox/contracts";
import {
  decodeArticleCursor,
  encodeArticleCursor,
  type ArticleCursorContext,
} from "@tech-inbox/core/article-cursor";
import type { Article, ArticleChanges } from "@tech-inbox/core/article";
import { normalizeUrl } from "@tech-inbox/core/url-normalization";
import { toArticleDto } from "./article-dto";
import { ApiError, validationError } from "./errors";
import type { ArticleRepository } from "./repositories/article-repository";

export type Clock = () => Date;
export type IdGenerator = () => string;

export class ArticleService {
  readonly #repository: ArticleRepository;
  readonly #clock: Clock;
  readonly #idGenerator: IdGenerator;

  constructor(repository: ArticleRepository, clock: Clock, idGenerator: IdGenerator) {
    this.#repository = repository;
    this.#clock = clock;
    this.#idGenerator = idGenerator;
  }

  async list(query: ListArticlesQuery): Promise<ListArticlesResponse> {
    const cursorContext: ArticleCursorContext = {
      status: query.status,
      search: query.q ?? null,
      site: query.site ?? null,
      sort: query.sort,
    };
    const decodedCursor =
      query.cursor === undefined ? null : decodeArticleCursor(query.cursor, cursorContext);

    if (decodedCursor !== null && !decodedCursor.ok) {
      throw validationError("cursorが無効です。");
    }

    const page = await this.#repository.list({
      ...cursorContext,
      limit: query.limit,
      cursor: decodedCursor?.value ?? null,
    });

    return {
      articles: page.items.map(toArticleDto),
      nextCursor:
        page.nextCursor === null ? null : encodeArticleCursor(cursorContext, page.nextCursor),
    };
  }

  async create(request: CreateArticleRequest): Promise<CreateArticleResponse> {
    const normalizedUrl = normalizeUrl(request.url);
    if (!normalizedUrl.ok) {
      throw validationError("URLが無効です。");
    }

    const now = this.#clock().toISOString();
    const result = await this.#repository.createWithOriginalAlias({
      id: this.#idGenerator(),
      originalUrl: request.url,
      normalizedUrl: normalizedUrl.value,
      savedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      result: result.outcome,
      article: toArticleDto(result.article),
    };
  }

  async get(id: string): Promise<Article> {
    const article = await this.#repository.findById(id);
    if (article === null) {
      throw new ApiError(404, "NOT_FOUND", "記事が見つかりません。");
    }

    return article;
  }

  async update(id: string, request: UpdateArticleRequest): Promise<Article> {
    const existing = await this.get(id);
    const now = this.#clock().toISOString();
    let changes: ArticleChanges = { updatedAt: now };

    if (request.title !== undefined) {
      changes = { ...changes, title: request.title, titleIsManual: true };
    }

    if (request.status !== undefined && request.status !== existing.status) {
      changes = {
        ...changes,
        readState:
          request.status === "read"
            ? { status: "read", readAt: now }
            : { status: "unread", readAt: null },
      };
    }

    if (request.url !== undefined) {
      const normalizedUrl = normalizeUrl(request.url);
      if (!normalizedUrl.ok) {
        throw validationError("URLが無効です。");
      }

      changes = {
        ...changes,
        ...(request.title === undefined && !existing.titleIsManual
          ? { title: null, titleIsManual: false }
          : {}),
        urlChange: { originalUrl: request.url, normalizedUrl: normalizedUrl.value },
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
      };
    }

    const result = await this.#repository.update({ id, changes });
    if (result.outcome === "notFound") {
      throw new ApiError(404, "NOT_FOUND", "記事が見つかりません。");
    }
    if (result.outcome === "urlConflict") {
      throw new ApiError(409, "URL_CONFLICT", "同じURLの記事が既に存在します。");
    }

    return result.article;
  }

  async delete(id: string): Promise<void> {
    const result = await this.#repository.deleteById(id);
    if (result.outcome === "notFound") {
      throw new ApiError(404, "NOT_FOUND", "記事が見つかりません。");
    }
  }
}
