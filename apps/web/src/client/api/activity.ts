import { articleActivityResponseSchema } from "@rizakura-hontai/contracts";
import { apiFetch, assertSuccess } from "../platform/http";

export async function getArticleActivity(options: { readonly signal?: AbortSignal } = {}) {
  const response = await apiFetch("/api/v1/activity", {}, options.signal);
  return articleActivityResponseSchema.parse(await assertSuccess(response));
}
