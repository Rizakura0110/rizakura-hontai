import { describe, expect, it } from "vitest";
import {
  MAX_ARTICLE_CURSOR_LENGTH,
  decodeArticleCursor,
  encodeArticleCursor,
  type ArticleCursorContext,
} from "./article-cursor";

const context = {
  status: "unread",
  search: "型 安全",
  site: "Example",
  sort: "saved_desc",
} as const satisfies ArticleCursorContext;

function encodeOpaquePayload(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

describe("article cursor", () => {
  it("round-trips an opaque UTF-8 cursor", () => {
    const cursor = encodeArticleCursor(context, {
      sortValue: "2026-08-27T00:00:00.000Z",
      id: "article-1",
    });

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(cursor).not.toContain("=");
    expect(decodeArticleCursor(cursor, context)).toEqual({
      ok: true,
      value: {
        sortValue: "2026-08-27T00:00:00.000Z",
        id: "article-1",
      },
    });
  });

  it("supports a null read timestamp only for read-desc ordering", () => {
    const readContext = { ...context, sort: "read_desc" } as const;
    const cursor = encodeArticleCursor(readContext, {
      sortValue: null,
      id: "unread-article",
    });

    expect(decodeArticleCursor(cursor, readContext)).toEqual({
      ok: true,
      value: { sortValue: null, id: "unread-article" },
    });
    expect(decodeArticleCursor(cursor, context)).toEqual({
      ok: false,
      code: "INVALID_CURSOR",
    });
  });

  it.each([
    ["status", { ...context, status: "read" }],
    ["search", { ...context, search: "different" }],
    ["site", { ...context, site: null }],
    ["sort", { ...context, sort: "saved_asc" }],
  ] as const)("rejects a cursor reused with different %s criteria", (_field, otherContext) => {
    const cursor = encodeArticleCursor(context, {
      sortValue: "2026-08-27T00:00:00.000Z",
      id: "article-1",
    });

    expect(decodeArticleCursor(cursor, otherContext)).toEqual({
      ok: false,
      code: "INVALID_CURSOR",
    });
  });

  it.each(["", "has=padding", "not+base64url", "a", "_".repeat(MAX_ARTICLE_CURSOR_LENGTH + 1)])(
    "rejects malformed cursor %j",
    (cursor) => {
      expect(decodeArticleCursor(cursor, context)).toEqual({
        ok: false,
        code: "INVALID_CURSOR",
      });
    },
  );

  it("rejects a valid JSON payload with extra fields", () => {
    const payload = encodeOpaquePayload({
      version: 1,
      ...context,
      sortValue: "2026-08-27T00:00:00.000Z",
      id: "article-1",
      unexpected: true,
    });

    expect(decodeArticleCursor(payload, context)).toEqual({
      ok: false,
      code: "INVALID_CURSOR",
    });
  });

  it("rejects a tampered non-UTC sort value", () => {
    const payload = encodeOpaquePayload({
      version: 1,
      ...context,
      sortValue: "tomorrow",
      id: "article-1",
    });

    expect(decodeArticleCursor(payload, context)).toEqual({
      ok: false,
      code: "INVALID_CURSOR",
    });
  });

  it("refuses to encode invalid internal cursor positions", () => {
    expect(() => encodeArticleCursor(context, { sortValue: null, id: "article-1" })).toThrow();
    expect(() =>
      encodeArticleCursor(context, { sortValue: "not-a-timestamp", id: "article-1" }),
    ).toThrow();
    expect(() =>
      encodeArticleCursor(context, { sortValue: "2026-08-27T00:00:00.000Z", id: "" }),
    ).toThrow();
  });
});
