import type { ArticleDto } from "../src/article";
import {
  createReadActivityWindow,
  summarizeReadActivity,
  type ReadActivitySnapshot,
} from "@tech-inbox/core/activity";
import { articleActivityResponseSchema } from "../src/activity";

export function articleActivityFixture(
  snapshot: ReadActivitySnapshot = { totalReadCount: 0, days: [] },
) {
  const window = createReadActivityWindow(new Date("2026-09-12T03:00:00.000Z"));
  return articleActivityResponseSchema.parse(summarizeReadActivity(window, snapshot));
}

export const articleDtoFixture = (overrides: Partial<ArticleDto> = {}): ArticleDto => ({
  id: "article-1",
  originalUrl: "https://example.com/articles/1",
  canonicalUrl: null,
  title: "Example article",
  titleIsManual: false,
  siteName: "Example",
  description: "A useful article.",
  faviconUrl: null,
  imageUrl: null,
  publishedAt: null,
  status: "unread",
  metadataStatus: "ready",
  metadataErrorCode: null,
  metadataAttemptCount: 1,
  metadataFetchedAt: "2026-08-26T01:02:03.000Z",
  savedAt: "2026-08-26T01:02:03.000Z",
  readAt: null,
  createdAt: "2026-08-26T01:02:03.000Z",
  updatedAt: "2026-08-26T01:02:03.000Z",
  ...overrides,
});
