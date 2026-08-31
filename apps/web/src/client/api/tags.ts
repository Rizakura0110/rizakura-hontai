import {
  articleTagsResponseSchema,
  createTagResponseSchema,
  deleteTagResponseSchema,
  listTagsResponseSchema,
  tagResponseSchema,
} from "@rizakura-me/contracts";
import { apiFetch, assertSuccess } from "../platform/http";

type RequestOptions = {
  readonly signal?: AbortSignal;
};

export async function listTags(options: RequestOptions = {}) {
  const response = await apiFetch("/api/v1/tags", {}, options.signal);
  return listTagsResponseSchema.parse(await assertSuccess(response));
}

export async function createTag(name: string, options: RequestOptions = {}) {
  const response = await apiFetch(
    "/api/v1/tags",
    { method: "POST", body: JSON.stringify({ name }) },
    options.signal,
  );
  return createTagResponseSchema.parse(await assertSuccess(response));
}

export async function updateTag(id: string, name: string, options: RequestOptions = {}) {
  const response = await apiFetch(
    `/api/v1/tags/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify({ name }) },
    options.signal,
  );
  return tagResponseSchema.parse(await assertSuccess(response)).tag;
}

export async function deleteTag(id: string, options: RequestOptions = {}): Promise<void> {
  const response = await apiFetch(
    `/api/v1/tags/${encodeURIComponent(id)}`,
    { method: "DELETE", body: "{}" },
    options.signal,
  );
  deleteTagResponseSchema.parse(await assertSuccess(response));
}

export async function replaceArticleTags(
  articleId: string,
  tagIds: readonly string[],
  options: RequestOptions = {},
) {
  const response = await apiFetch(
    `/api/v1/articles/${encodeURIComponent(articleId)}/tags`,
    { method: "PUT", body: JSON.stringify({ tagIds }) },
    options.signal,
  );
  return articleTagsResponseSchema.parse(await assertSuccess(response)).tags;
}
