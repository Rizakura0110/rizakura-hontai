import { ApiError, validationError } from "./errors";

export const MAX_REQUEST_BODY_BYTES = 16 * 1_024;

type RuntimeSchema<T> = {
  safeParse(
    value: unknown,
  ): { readonly success: true; readonly data: T } | { readonly success: false };
};

export function parseWithSchema<T>(schema: RuntimeSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw validationError();
  }

  return result.data;
}

export function parseQuery(searchParams: URLSearchParams): Record<string, string> {
  const query: Record<string, string> = {};

  for (const [key, value] of searchParams) {
    if (query[key] !== undefined) {
      throw validationError("同じquery parameterを複数指定できません。");
    }
    query[key] = value;
  }

  return query;
}

function assertDeclaredBodySize(request: Request): void {
  const contentLength = request.headers.get("content-length");
  if (contentLength === null) {
    return;
  }

  const declaredBytes = Number(contentLength);
  if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
    throw validationError("Content-Lengthが無効です。");
  }
  if (declaredBytes > MAX_REQUEST_BODY_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "request bodyが大きすぎます。");
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  assertDeclaredBodySize(request);

  if (request.body === null) {
    throw validationError("JSON bodyが必要です。");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      byteLength += value.byteLength;
      if (byteLength > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError(413, "PAYLOAD_TOO_LARGE", "request bodyが大きすぎます。");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(body));
  } catch {
    throw validationError("正しいJSON bodyを指定してください。");
  }
}
