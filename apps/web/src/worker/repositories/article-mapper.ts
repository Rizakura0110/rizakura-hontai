import type { Article } from "@tech-inbox/core/article";
import type { ArticleRow } from "@rizakura-hontai/db";

export class ArticleDataIntegrityError extends Error {
  constructor() {
    super("The stored article violates a domain invariant.");
    this.name = "ArticleDataIntegrityError";
  }
}

export function mapArticleRow(row: ArticleRow): Article {
  const fields = {
    id: row.id,
    originalUrl: row.originalUrl,
    canonicalUrl: row.canonicalUrl,
    title: row.title,
    titleIsManual: row.titleIsManual,
    siteName: row.siteName,
    description: row.description,
    faviconUrl: row.faviconUrl,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt,
    metadataStatus: row.metadataStatus,
    metadataErrorCode: row.metadataErrorCode,
    metadataAttemptCount: row.metadataAttemptCount,
    metadataFetchedAt: row.metadataFetchedAt,
    savedAt: row.savedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as const;

  if (row.status === "unread" && row.readAt === null) {
    return { ...fields, status: "unread", readAt: null };
  }

  if (row.status === "read" && row.readAt !== null) {
    return { ...fields, status: "read", readAt: row.readAt };
  }

  throw new ArticleDataIntegrityError();
}
