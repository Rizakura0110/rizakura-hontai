import type { ArticleRow } from "@rizakura-hontai/db";
import { describe, expect, it } from "vitest";
import { ArticleDataIntegrityError, mapArticleRow } from "./article-mapper";

const row: ArticleRow = {
  id: "article-1",
  originalUrl: "https://example.com/article",
  canonicalUrl: null,
  title: null,
  titleIsManual: false,
  siteName: null,
  description: null,
  faviconUrl: null,
  imageUrl: null,
  publishedAt: null,
  status: "unread",
  metadataStatus: "pending",
  metadataErrorCode: null,
  metadataAttemptCount: 0,
  metadataFetchedAt: null,
  savedAt: "2026-08-27T00:00:00.000Z",
  readAt: null,
  createdAt: "2026-08-27T00:00:00.000Z",
  updatedAt: "2026-08-27T00:00:00.000Z",
};

describe("mapArticleRow", () => {
  it("maps a valid row without conflating the database and domain types", () => {
    expect(mapArticleRow(row)).toEqual(row);
  });

  it("rejects an unread row that contains a read timestamp", () => {
    expect(() => mapArticleRow({ ...row, readAt: "2026-08-27T01:00:00.000Z" })).toThrow(
      ArticleDataIntegrityError,
    );
  });

  it("rejects a read row without a read timestamp", () => {
    expect(() => mapArticleRow({ ...row, status: "read", readAt: null })).toThrow(
      ArticleDataIntegrityError,
    );
  });
});
