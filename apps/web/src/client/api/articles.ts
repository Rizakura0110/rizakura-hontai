import {
  apiErrorResponseSchema,
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

export class ApiClientError extends Error {
  readonly code: string;
  readonly requestId: string | undefined;
  readonly status: number;

  constructor(message: string, status: number, code: string, requestId?: string) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.requestId = requestId;
    this.status = status;
  }
}

type ListArticleOptions = {
  readonly status: ArticleListStatus;
  readonly query: string;
  readonly sort: ArticleSort;
  readonly limit?: number;
  readonly cursor?: string;
  readonly signal?: AbortSignal;
};

type MutationOptions = {
  readonly signal?: AbortSignal;
};

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiClientError(
      "サーバーから正しいJSON応答を受け取れませんでした。",
      response.status,
      "INVALID_RESPONSE",
    );
  }
}

async function assertSuccess(response: Response): Promise<unknown> {
  const body = await parseJson(response);
  if (response.ok) return body;

  const error = apiErrorResponseSchema.safeParse(body);
  if (error.success) {
    throw new ApiClientError(
      error.data.error.message,
      response.status,
      error.data.error.code,
      error.data.error.requestId,
    );
  }

  throw new ApiClientError("リクエストを完了できませんでした。", response.status, "UNKNOWN_ERROR");
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body !== undefined && init.body !== null) {
    headers.set("Content-Type", "application/json");
    headers.set("X-Tech-Inbox-Client", "web");
  }

  const requestInit: RequestInit = {
    ...init,
    credentials: "same-origin",
    headers,
  };
  if (signal !== undefined) requestInit.signal = signal;

  return fetch(path, requestInit);
}

export async function listArticles(options: ListArticleOptions) {
  const query = new URLSearchParams({
    status: options.status,
    sort: options.sort,
    limit: String(options.limit ?? 30),
  });
  if (options.query !== "") query.set("q", options.query);
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

export function userFacingError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof DOMException && error.name === "AbortError") return "";
  return "通信に失敗しました。時間をおいて再度お試しください。";
}
