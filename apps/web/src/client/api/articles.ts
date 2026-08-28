import {
  articleResponseSchema,
  type ArticleDto,
  type ArticleListStatus,
  type ArticleSort,
  createArticleResponseSchema,
  deleteArticleResponseSchema,
  exportResponseSchema,
  listArticlesResponseSchema,
  retryMetadataResponseSchema,
} from "@tech-inbox/contracts";
import { apiFetch, assertSuccess } from "./http";

export { ApiClientError, userFacingError } from "./http";

type ListArticleOptions = {
  readonly status: ArticleListStatus;
  readonly query: string;
  readonly tagId?: string;
  readonly sort: ArticleSort;
  readonly limit?: number;
  readonly cursor?: string;
  readonly signal?: AbortSignal;
};

type MutationOptions = {
  readonly signal?: AbortSignal;
};

export async function listArticles(options: ListArticleOptions) {
  const query = new URLSearchParams({
    status: options.status,
    sort: options.sort,
    limit: String(options.limit ?? 30),
  });
  if (options.query !== "") query.set("q", options.query);
  if (options.tagId !== undefined && options.tagId !== "") query.set("tagId", options.tagId);
  if (options.cursor !== undefined) query.set("cursor", options.cursor);

  const response = await apiFetch(`/api/v1/articles?${query.toString()}`, {}, options.signal);
  return listArticlesResponseSchema.parse(await assertSuccess(response));
}

export async function exportArticles(options: MutationOptions = {}) {
  const response = await apiFetch("/api/v1/export", {}, options.signal);
  return exportResponseSchema.parse(await assertSuccess(response));
}

export async function createArticle(url: string, options: MutationOptions = {}) {
  const response = await apiFetch(
    "/api/v1/articles",
    { method: "POST", body: JSON.stringify({ url }) },
    options.signal,
  );
  return createArticleResponseSchema.parse(await assertSuccess(response));
}

export async function updateArticle(
  id: string,
  changes: { readonly title?: string; readonly url?: string; readonly status?: "unread" | "read" },
  options: MutationOptions = {},
): Promise<ArticleDto> {
  const response = await apiFetch(
    `/api/v1/articles/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(changes) },
    options.signal,
  );
  return articleResponseSchema.parse(await assertSuccess(response)).article;
}

export async function deleteArticle(id: string, options: MutationOptions = {}): Promise<void> {
  const response = await apiFetch(
    `/api/v1/articles/${encodeURIComponent(id)}`,
    { method: "DELETE", body: "{}" },
    options.signal,
  );
  deleteArticleResponseSchema.parse(await assertSuccess(response));
}

export async function retryArticleMetadata(
  id: string,
  options: MutationOptions = {},
): Promise<ArticleDto> {
  const response = await apiFetch(
    `/api/v1/articles/${encodeURIComponent(id)}/retry-metadata`,
    { method: "POST", body: "{}" },
    options.signal,
  );
  return retryMetadataResponseSchema.parse(await assertSuccess(response)).article;
}
