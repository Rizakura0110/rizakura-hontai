export const METADATA_STATUSES = ["pending", "ready", "failed"] as const;

export type MetadataStatus = (typeof METADATA_STATUSES)[number];

export const METADATA_ERROR_CODES = [
  "INVALID_URL",
  "UNSAFE_URL",
  "TOO_MANY_REDIRECTS",
  "REDIRECT_LOOP",
  "FETCH_TIMEOUT",
  "NETWORK_ERROR",
  "HTTP_CLIENT_ERROR",
  "HTTP_RATE_LIMITED",
  "HTTP_SERVER_ERROR",
  "UNSUPPORTED_CONTENT_TYPE",
  "RESPONSE_TOO_LARGE",
  "PARSE_ERROR",
] as const;

export type MetadataErrorCode = (typeof METADATA_ERROR_CODES)[number];

export const RETRYABLE_METADATA_ERROR_CODES = [
  "FETCH_TIMEOUT",
  "NETWORK_ERROR",
  "HTTP_RATE_LIMITED",
  "HTTP_SERVER_ERROR",
] as const satisfies readonly MetadataErrorCode[];

const retryableMetadataErrorCodes = new Set<MetadataErrorCode>(RETRYABLE_METADATA_ERROR_CODES);

export function isRetryableMetadataErrorCode(errorCode: MetadataErrorCode): boolean {
  return retryableMetadataErrorCodes.has(errorCode);
}

export type ArticleMetadata = {
  readonly canonicalUrl: string | null;
  readonly title: string | null;
  readonly siteName: string | null;
  readonly description: string | null;
  readonly faviconUrl: string | null;
  readonly imageUrl: string | null;
  readonly publishedAt: string | null;
};

export type MetadataFetchResult =
  | {
      readonly ok: true;
      readonly metadata: ArticleMetadata;
    }
  | {
      readonly ok: false;
      readonly errorCode: MetadataErrorCode;
    };
