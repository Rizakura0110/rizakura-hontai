import {
  ARTICLE_LIST_STATUSES,
  ARTICLE_SORTS,
  type ArticleListStatus,
  type ArticleSort,
} from "./article";

declare const TextEncoder: {
  new (): {
    encode(input?: string): Uint8Array;
  };
};

declare const TextDecoder: {
  new (
    label?: string,
    options?: { fatal?: boolean },
  ): {
    decode(input?: Uint8Array): string;
  };
};

declare function atob(value: string): string;
declare function btoa(value: string): string;

export const MAX_ARTICLE_CURSOR_LENGTH = 2_048;

export type ArticleCursorContext = {
  readonly status: ArticleListStatus;
  readonly search: string | null;
  readonly site: string | null;
  readonly tagId: string | null;
  readonly sort: ArticleSort;
};

export type ArticleCursorPosition = {
  readonly sortValue: string | null;
  readonly id: string;
};

type ArticleCursorPayload = ArticleCursorContext &
  ArticleCursorPosition & {
    readonly version: 1;
  };

export type DecodeArticleCursorResult =
  | {
      readonly ok: true;
      readonly value: ArticleCursorPosition;
    }
  | {
      readonly ok: false;
      readonly code: "INVALID_CURSOR";
    };

const payloadKeys = ["id", "search", "site", "sort", "sortValue", "status", "tagId", "version"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isCanonicalUtcTimestamp(value: string): boolean {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function isValidPosition(
  sort: ArticleSort,
  position: ArticleCursorPosition,
): position is ArticleCursorPosition {
  return (
    position.id.length > 0 &&
    position.id.length <= 128 &&
    (position.sortValue === null
      ? sort === "read_desc"
      : isCanonicalUtcTimestamp(position.sortValue))
  );
}

function isArticleCursorPayload(value: unknown): value is ArticleCursorPayload {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value).sort();
  if (keys.length !== payloadKeys.length || keys.some((key, index) => key !== payloadKeys[index])) {
    return false;
  }

  return (
    value.version === 1 &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 128 &&
    isNullableString(value.sortValue) &&
    isNullableString(value.search) &&
    isNullableString(value.site) &&
    isNullableString(value.tagId) &&
    typeof value.status === "string" &&
    ARTICLE_LIST_STATUSES.includes(value.status as ArticleListStatus) &&
    typeof value.sort === "string" &&
    ARTICLE_SORTS.includes(value.sort as ArticleSort) &&
    (value.sortValue === null
      ? value.sort === "read_desc"
      : isCanonicalUtcTimestamp(value.sortValue))
  );
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): string {
  const remainder = value.length % 4;
  if (remainder === 1) {
    throw new Error("Invalid base64url length");
  }

  const padding = remainder === 0 ? "" : "=".repeat(4 - remainder);
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function encodeArticleCursor(
  context: ArticleCursorContext,
  position: ArticleCursorPosition,
): string {
  if (!isValidPosition(context.sort, position)) {
    throw new Error("Cannot encode an invalid article cursor position.");
  }

  const payload: ArticleCursorPayload = {
    version: 1,
    status: context.status,
    search: context.search,
    site: context.site,
    tagId: context.tagId,
    sort: context.sort,
    sortValue: position.sortValue,
    id: position.id,
  };

  return encodeBase64Url(JSON.stringify(payload));
}

export function decodeArticleCursor(
  cursor: string,
  expectedContext: ArticleCursorContext,
): DecodeArticleCursorResult {
  if (
    cursor.length === 0 ||
    cursor.length > MAX_ARTICLE_CURSOR_LENGTH ||
    !/^[A-Za-z0-9_-]+$/u.test(cursor)
  ) {
    return { ok: false, code: "INVALID_CURSOR" };
  }

  try {
    const payload: unknown = JSON.parse(decodeBase64Url(cursor));

    if (
      !isArticleCursorPayload(payload) ||
      payload.status !== expectedContext.status ||
      payload.search !== expectedContext.search ||
      payload.site !== expectedContext.site ||
      payload.tagId !== expectedContext.tagId ||
      payload.sort !== expectedContext.sort
    ) {
      return { ok: false, code: "INVALID_CURSOR" };
    }

    return {
      ok: true,
      value: {
        sortValue: payload.sortValue,
        id: payload.id,
      },
    };
  } catch {
    return { ok: false, code: "INVALID_CURSOR" };
  }
}
