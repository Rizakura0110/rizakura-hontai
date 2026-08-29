import type { Article } from "@tech-inbox/core/article";
import type { Tag } from "@tech-inbox/core/tag";
import type { BackupImportPlan } from "../backup-import";
import type { BackupRepository } from "./backup-repository";
import { createD1ArticleRepository } from "./d1-article-repository";

function articleInsert(binding: D1Database, article: Article): D1PreparedStatement {
  return binding
    .prepare(
      `INSERT INTO articles (
        id, original_url, canonical_url, title, title_is_manual, site_name, description,
        favicon_url, image_url, published_at, status, metadata_status, metadata_error_code,
        metadata_attempt_count, metadata_fetched_at, saved_at, read_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      article.id,
      article.originalUrl,
      article.canonicalUrl,
      article.title,
      article.titleIsManual ? 1 : 0,
      article.siteName,
      article.description,
      article.faviconUrl,
      article.imageUrl,
      article.publishedAt,
      article.status,
      article.metadataStatus,
      article.metadataErrorCode,
      article.metadataAttemptCount,
      article.metadataFetchedAt,
      article.savedAt,
      article.readAt,
      article.createdAt,
      article.updatedAt,
    );
}

function tagInsert(binding: D1Database, tag: Tag): D1PreparedStatement {
  return binding
    .prepare(
      `INSERT INTO tags (id, name, normalized_name, color_hue, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(tag.id, tag.name, tag.normalizedName, tag.colorHue, tag.createdAt, tag.updatedAt);
}

class D1BackupRepository implements BackupRepository {
  readonly #binding: D1Database;

  constructor(binding: D1Database) {
    this.#binding = binding;
  }

  loadSnapshot() {
    return createD1ArticleRepository(this.#binding).exportAll();
  }

  async apply(plan: BackupImportPlan): Promise<void> {
    const statements: D1PreparedStatement[] = [
      ...plan.articles.map((article) => articleInsert(this.#binding, article)),
      ...plan.tags.map((tag) => tagInsert(this.#binding, tag)),
      ...plan.articleUrls.map((alias) =>
        this.#binding
          .prepare(
            "INSERT INTO article_urls (normalized_url, article_id, kind, created_at) VALUES (?, ?, ?, ?)",
          )
          .bind(alias.normalizedUrl, alias.articleId, alias.kind, alias.createdAt),
      ),
      ...plan.articleTags.map((assignment) =>
        this.#binding
          .prepare("INSERT INTO article_tags (article_id, tag_id, created_at) VALUES (?, ?, ?)")
          .bind(assignment.articleId, assignment.tagId, assignment.createdAt),
      ),
    ];

    if (statements.length > 0) await this.#binding.batch(statements);
  }
}

export function createD1BackupRepository(binding: D1Database): BackupRepository {
  return new D1BackupRepository(binding);
}
