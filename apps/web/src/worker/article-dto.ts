import type { ArticleDto } from "@tech-inbox/contracts";
import type { Article } from "@tech-inbox/core/article";

export function toArticleDto(article: Article): ArticleDto {
  return {
    id: article.id,
    originalUrl: article.originalUrl,
    canonicalUrl: article.canonicalUrl,
    title: article.title,
    titleIsManual: article.titleIsManual,
    siteName: article.siteName,
    description: article.description,
    faviconUrl: article.faviconUrl,
    imageUrl: article.imageUrl,
    publishedAt: article.publishedAt,
    status: article.status,
    metadataStatus: article.metadataStatus,
    metadataErrorCode: article.metadataErrorCode,
    metadataAttemptCount: article.metadataAttemptCount,
    metadataFetchedAt: article.metadataFetchedAt,
    savedAt: article.savedAt,
    readAt: article.readAt,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  };
}
