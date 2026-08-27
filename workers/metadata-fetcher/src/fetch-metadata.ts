import type { MetadataFetchResponse } from "@tech-inbox/contracts";
import type { MetadataErrorCode } from "@tech-inbox/core/metadata";
import { parseHtmlMetadata } from "./html-metadata";
import { validateFetchUrl } from "./url-policy";

export const FETCH_TIMEOUT_MS = 8_000;
export const MAX_RESPONSE_BYTES = 1024 * 1024;
export const MAX_REDIRECTS = 3;

export type FetchMetadataDependencies = {
  readonly fetch: typeof fetch;
  readonly parse: typeof parseHtmlMetadata;
  readonly setTimeout: typeof setTimeout;
  readonly clearTimeout: typeof clearTimeout;
};

const defaultDependencies: FetchMetadataDependencies = {
  fetch,
  parse: parseHtmlMetadata,
  setTimeout,
  clearTimeout,
};

function failure(code: MetadataErrorCode): MetadataFetchResponse {
  return { ok: false, error: { code } };
}

function errorForStatus(status: number): MetadataErrorCode | null {
  if (status === 429) return "HTTP_RATE_LIMITED";
  if (status >= 500) return "HTTP_SERVER_ERROR";
  if (status >= 400 || status < 200) return "HTTP_CLIENT_ERROR";
  return null;
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function readLimitedBody(response: Response): Promise<Uint8Array | null> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      await response.body?.cancel();
      return null;
    }
  }

  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(result.value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function fetchMetadata(
  rawUrl: string,
  dependencies: FetchMetadataDependencies = defaultDependencies,
): Promise<MetadataFetchResponse> {
  let validation = validateFetchUrl(rawUrl);
  if (!validation.ok) return failure(validation.errorCode);

  const controller = new AbortController();
  const timeout = dependencies.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let currentUrl = validation.url;
    const visited = new Set<string>();

    for (let redirectCount = 0; ; redirectCount += 1) {
      if (visited.has(currentUrl.href)) return failure("REDIRECT_LOOP");
      visited.add(currentUrl.href);

      const response = await dependencies.fetch(currentUrl.href, {
        method: "GET",
        redirect: "manual",
        headers: { Accept: "text/html, application/xhtml+xml;q=0.9" },
        signal: controller.signal,
      });

      if (isRedirect(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (location === null) return failure("HTTP_CLIENT_ERROR");
        if (redirectCount >= MAX_REDIRECTS) return failure("TOO_MANY_REDIRECTS");

        let redirectUrl: string;
        try {
          redirectUrl = new URL(location, currentUrl).href;
        } catch {
          return failure("INVALID_URL");
        }
        validation = validateFetchUrl(redirectUrl);
        if (!validation.ok) return failure(validation.errorCode);
        currentUrl = validation.url;
        continue;
      }

      const statusError = errorForStatus(response.status);
      if (statusError !== null) {
        await response.body?.cancel();
        return failure(statusError);
      }

      const contentType = response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase();
      if (contentType !== "text/html" && contentType !== "application/xhtml+xml") {
        await response.body?.cancel();
        return failure("UNSUPPORTED_CONTENT_TYPE");
      }

      const body = await readLimitedBody(response);
      if (body === null) return failure("RESPONSE_TOO_LARGE");

      try {
        const metadata = await dependencies.parse(
          new Response(body, { headers: { "Content-Type": contentType } }),
          currentUrl.href,
        );
        return { ok: true, metadata };
      } catch {
        return failure("PARSE_ERROR");
      }
    }
  } catch (error: unknown) {
    return failure(isAbortError(error) ? "FETCH_TIMEOUT" : "NETWORK_ERROR");
  } finally {
    dependencies.clearTimeout(timeout);
  }
}
