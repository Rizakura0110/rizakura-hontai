import type {
  Article,
  ArticleChanges,
  ArticleListCriteria,
  ArticlePage,
  ArticleUrlAlias,
  CreateArticleInput,
  UpdateArticleInput,
} from "@tech-inbox/core/article";
import { MAX_TAGS_PER_ARTICLE, type Tag } from "@tech-inbox/core/tag";
import type { NormalizedUrl } from "@tech-inbox/core/url-normalization";
import { articles, articleTags, articleUrls, type ArticleRow, tags } from "@tech-inbox/db";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, type SQL, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  ArticleRepository,
  ApplyMetadataInput,
  ApplyMetadataResult,
  CreateArticleResult,
  DeleteArticleResult,
  RecordMetadataFailureInput,
  RecordMetadataFailureResult,
  UpdateArticleResult,
} from "./article-repository";
import { mapArticleRow } from "./article-mapper";
import { mapTagRow } from "./tag-mapper";

type ArticleDatabase = ReturnType<typeof drizzle>;

function escapeLikePattern(value: string): string {
  return value.replaceAll("!", "!!").replaceAll("%", "!%").replaceAll("_", "!_");
}

function searchCondition(search: string): SQL {
  const pattern = `%${escapeLikePattern(search)}%`;

  return sql`(${articles.title} LIKE ${pattern} ESCAPE '!' OR ${articles.originalUrl} LIKE ${pattern} ESCAPE '!' OR ${articles.siteName} LIKE ${pattern} ESCAPE '!')`;
}

function cursorCondition(criteria: ArticleListCriteria): SQL | undefined {
  const cursor = criteria.cursor;
  if (cursor === null) {
    return undefined;
  }

  if (criteria.sort === "saved_desc") {
    if (cursor.sortValue === null) {
      throw new Error("A saved-date cursor must contain a sort value.");
    }
    return or(
      lt(articles.savedAt, cursor.sortValue),
      and(eq(articles.savedAt, cursor.sortValue), lt(articles.id, cursor.id)),
    );
  }

  if (criteria.sort === "saved_asc") {
    if (cursor.sortValue === null) {
      throw new Error("A saved-date cursor must contain a sort value.");
    }
    return or(
      gt(articles.savedAt, cursor.sortValue),
      and(eq(articles.savedAt, cursor.sortValue), gt(articles.id, cursor.id)),
    );
  }

  if (cursor.sortValue === null) {
    return and(isNull(articles.readAt), lt(articles.id, cursor.id));
  }

  return or(
    lt(articles.readAt, cursor.sortValue),
    and(eq(articles.readAt, cursor.sortValue), lt(articles.id, cursor.id)),
    isNull(articles.readAt),
  );
}

function listConditions(criteria: ArticleListCriteria): SQL[] {
  const conditions: SQL[] = [];

  if (criteria.status !== "all") {
    conditions.push(eq(articles.status, criteria.status));
  }

  if (criteria.search !== null) {
    conditions.push(searchCondition(criteria.search));
  }

  if (criteria.site !== null) {
    conditions.push(eq(articles.siteName, criteria.site));
  }

  if (criteria.tagId !== null) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${articleTags} WHERE ${articleTags.articleId} = ${articles.id} AND ${articleTags.tagId} = ${criteria.tagId})`,
    );
  }

  const afterCursor = cursorCondition(criteria);
  if (afterCursor !== undefined) {
    conditions.push(afterCursor);
  }

  return conditions;
}

function orderBy(criteria: ArticleListCriteria): readonly [SQL, SQL] {
  if (criteria.sort === "saved_asc") {
    return [asc(articles.savedAt), asc(articles.id)];
  }

  if (criteria.sort === "read_desc") {
    return [desc(articles.readAt), desc(articles.id)];
  }

  return [desc(articles.savedAt), desc(articles.id)];
}

function positionFor(article: Article, criteria: ArticleListCriteria) {
  return {
    sortValue: criteria.sort === "read_desc" ? article.readAt : article.savedAt,
    id: article.id,
  } as const;
}

function latestTimestamp(left: string, right: string): string {
  return left >= right ? left : right;
}

function articleUpdateSet(changes: ArticleChanges): Partial<ArticleRow> {
  const set: Partial<ArticleRow> = { updatedAt: changes.updatedAt };

  if (changes.urlChange !== undefined) set.originalUrl = changes.urlChange.originalUrl;
  if (changes.canonicalUrl !== undefined) set.canonicalUrl = changes.canonicalUrl;
  if (changes.title !== undefined) set.title = changes.title;
  if (changes.titleIsManual !== undefined) set.titleIsManual = changes.titleIsManual;
  if (changes.siteName !== undefined) set.siteName = changes.siteName;
  if (changes.description !== undefined) set.description = changes.description;
  if (changes.faviconUrl !== undefined) set.faviconUrl = changes.faviconUrl;
  if (changes.imageUrl !== undefined) set.imageUrl = changes.imageUrl;
  if (changes.publishedAt !== undefined) set.publishedAt = changes.publishedAt;
  if (changes.readState !== undefined) {
    set.status = changes.readState.status;
    set.readAt = changes.readState.readAt;
  }
  if (changes.metadataStatus !== undefined) set.metadataStatus = changes.metadataStatus;
  if (changes.metadataErrorCode !== undefined) {
    set.metadataErrorCode = changes.metadataErrorCode;
  }
  if (changes.metadataAttemptCount !== undefined) {
    set.metadataAttemptCount = changes.metadataAttemptCount;
  }
  if (changes.metadataFetchedAt !== undefined) set.metadataFetchedAt = changes.metadataFetchedAt;
  if (changes.savedAt !== undefined) set.savedAt = changes.savedAt;

  return set;
}

class D1ArticleRepository implements ArticleRepository {
  readonly #binding: D1Database;
  readonly #database: ArticleDatabase;

  constructor(binding: D1Database) {
    this.#binding = binding;
    this.#database = drizzle(binding);
  }

  async list(criteria: ArticleListCriteria): Promise<ArticlePage> {
    const conditions = listConditions(criteria);
    const rows = await this.#database
      .select()
      .from(articles)
      .where(conditions.length === 0 ? undefined : and(...conditions))
      .orderBy(...orderBy(criteria))
      .limit(criteria.limit + 1);
    const hasNextPage = rows.length > criteria.limit;
    const items = rows.slice(0, criteria.limit).map(mapArticleRow);
    const articleIds = items.map((article) => article.id);
    const tagRows =
      articleIds.length === 0
        ? []
        : await this.#database
            .select({ articleId: articleTags.articleId, tag: tags })
            .from(articleTags)
            .innerJoin(tags, eq(articleTags.tagId, tags.id))
            .where(inArray(articleTags.articleId, articleIds))
            .orderBy(asc(articleTags.articleId), asc(tags.normalizedName), asc(tags.id));
    const availableTags = (
      await this.#database.select().from(tags).orderBy(asc(tags.normalizedName), asc(tags.id))
    ).map(mapTagRow);
    const tagsByArticleId: Record<string, Tag[]> = Object.fromEntries(
      articleIds.map((articleId) => [articleId, []]),
    );
    for (const row of tagRows) {
      const assignedTags = tagsByArticleId[row.articleId];
      if (assignedTags !== undefined) {
        assignedTags.push(mapTagRow(row.tag));
      }
    }
    const finalItem = items.at(-1);

    return {
      items,
      availableTags,
      tagsByArticleId,
      nextCursor: hasNextPage && finalItem !== undefined ? positionFor(finalItem, criteria) : null,
    };
  }

  async exportAll() {
    const [articleRows, articleUrlRows, tagRows, articleTagRows] = await this.#database.batch([
      this.#database.select().from(articles).orderBy(desc(articles.savedAt), desc(articles.id)),
      this.#database.select().from(articleUrls).orderBy(asc(articleUrls.normalizedUrl)),
      this.#database.select().from(tags).orderBy(asc(tags.normalizedName), asc(tags.id)),
      this.#database
        .select({ articleId: articleTags.articleId, tagId: articleTags.tagId })
        .from(articleTags)
        .orderBy(asc(articleTags.articleId), asc(articleTags.tagId)),
    ]);

    return {
      articles: articleRows.map(mapArticleRow),
      articleUrls: articleUrlRows.map(
        (row): ArticleUrlAlias => ({
          normalizedUrl: row.normalizedUrl as NormalizedUrl,
          articleId: row.articleId,
          kind: row.kind,
          createdAt: row.createdAt,
        }),
      ),
      tags: tagRows.map(mapTagRow),
      articleTags: articleTagRows,
    };
  }

  async findById(id: string): Promise<Article | null> {
    const [row] = await this.#database.select().from(articles).where(eq(articles.id, id)).limit(1);
    return row === undefined ? null : mapArticleRow(row);
  }

  async findByNormalizedUrl(normalizedUrl: NormalizedUrl): Promise<Article | null> {
    const [row] = await this.#database
      .select({ article: articles })
      .from(articleUrls)
      .innerJoin(articles, eq(articleUrls.articleId, articles.id))
      .where(eq(articleUrls.normalizedUrl, normalizedUrl))
      .limit(1);

    return row === undefined ? null : mapArticleRow(row.article);
  }

  async createWithOriginalAlias(input: CreateArticleInput): Promise<CreateArticleResult> {
    try {
      await this.#database.batch([
        this.#database.insert(articles).values({
          id: input.id,
          originalUrl: input.originalUrl,
          status: "unread",
          metadataStatus: "pending",
          metadataAttemptCount: 0,
          savedAt: input.savedAt,
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
        }),
        this.#database.insert(articleUrls).values({
          normalizedUrl: input.normalizedUrl,
          articleId: input.id,
          kind: "original",
          createdAt: input.createdAt,
        }),
      ]);
    } catch (error: unknown) {
      const existing = await this.findByNormalizedUrl(input.normalizedUrl);
      if (existing !== null) {
        return { outcome: "alreadyExists", article: existing };
      }

      throw error;
    }

    const article = await this.findById(input.id);
    if (article === null) {
      throw new Error("The newly created article could not be loaded.");
    }

    return { outcome: "created", article };
  }

  async update(input: UpdateArticleInput): Promise<UpdateArticleResult> {
    const existing = await this.findById(input.id);
    if (existing === null) {
      return { outcome: "notFound" };
    }

    const set = articleUpdateSet(input.changes);
    const urlChange = input.changes.urlChange;

    if (urlChange !== undefined) {
      const conflictingArticle = await this.findByNormalizedUrl(urlChange.normalizedUrl);
      if (conflictingArticle !== null && conflictingArticle.id !== input.id) {
        return { outcome: "urlConflict" };
      }

      try {
        await this.#database.batch([
          this.#database.delete(articleUrls).where(eq(articleUrls.articleId, input.id)),
          this.#database.insert(articleUrls).values({
            normalizedUrl: urlChange.normalizedUrl,
            articleId: input.id,
            kind: "original",
            createdAt: input.changes.updatedAt,
          }),
          this.#database.update(articles).set(set).where(eq(articles.id, input.id)),
        ]);
      } catch (error: unknown) {
        const conflictAfterRace = await this.findByNormalizedUrl(urlChange.normalizedUrl);
        if (conflictAfterRace !== null && conflictAfterRace.id !== input.id) {
          return { outcome: "urlConflict" };
        }
        if ((await this.findById(input.id)) === null) {
          return { outcome: "notFound" };
        }

        throw error;
      }
    } else {
      await this.#database.update(articles).set(set).where(eq(articles.id, input.id));
    }

    const article = await this.findById(input.id);
    return article === null ? { outcome: "notFound" } : { outcome: "updated", article };
  }

  async applyMetadata(input: ApplyMetadataInput): Promise<ApplyMetadataResult> {
    const existing = await this.findById(input.id);
    if (existing === null || existing.originalUrl !== input.expectedUrl) {
      return { outcome: "stale" };
    }
    const canonicalAlias = input.canonicalAlias;
    if (canonicalAlias !== null) {
      const owner = await this.findByNormalizedUrl(canonicalAlias.normalizedUrl);
      if (owner !== null && owner.id !== input.id) {
        return this.#mergeMetadata(owner, existing, input);
      }
    }
    if (existing.metadataStatus === "ready") {
      return { outcome: "updated", article: existing };
    }

    const statements: D1PreparedStatement[] = [];
    if (canonicalAlias !== null) {
      statements.push(
        this.#binding
          .prepare(
            "INSERT OR IGNORE INTO article_urls (normalized_url, article_id, kind, created_at) SELECT ?, id, 'canonical', ? FROM articles WHERE id = ? AND original_url = ?",
          )
          .bind(
            canonicalAlias.normalizedUrl,
            canonicalAlias.createdAt,
            input.id,
            input.expectedUrl,
          ),
      );
    }
    statements.push(this.#metadataUpdateStatement(input));
    await this.#binding.batch(statements);

    const updated = await this.findById(input.id);
    if (updated === null || updated.originalUrl !== input.expectedUrl) {
      return { outcome: "stale" };
    }

    if (canonicalAlias !== null) {
      const ownerAfterUpdate = await this.findByNormalizedUrl(canonicalAlias.normalizedUrl);
      if (ownerAfterUpdate !== null && ownerAfterUpdate.id !== input.id) {
        return this.#mergeMetadata(ownerAfterUpdate, updated, input);
      }
    }

    return { outcome: "updated", article: updated };
  }

  async recordMetadataFailure(
    input: RecordMetadataFailureInput,
  ): Promise<RecordMetadataFailureResult> {
    const existing = await this.findById(input.id);
    if (
      existing === null ||
      existing.originalUrl !== input.expectedUrl ||
      existing.metadataStatus === "ready"
    ) {
      return { outcome: "stale" };
    }

    await this.#binding
      .prepare(
        "UPDATE articles SET metadata_status = ?, metadata_error_code = ?, metadata_attempt_count = CASE WHEN metadata_attempt_count > ? THEN metadata_attempt_count ELSE ? END, metadata_fetched_at = ?, updated_at = ? WHERE id = ? AND original_url = ? AND metadata_status <> 'ready'",
      )
      .bind(
        input.status,
        input.errorCode,
        input.attemptCount,
        input.attemptCount,
        input.fetchedAt,
        input.updatedAt,
        input.id,
        input.expectedUrl,
      )
      .run();

    const updated = await this.findById(input.id);
    return updated === null || updated.originalUrl !== input.expectedUrl
      ? { outcome: "stale" }
      : { outcome: "updated", article: updated };
  }

  #metadataUpdateStatement(input: ApplyMetadataInput): D1PreparedStatement {
    return this.#binding
      .prepare(
        "UPDATE articles SET canonical_url = ?, title = CASE WHEN title_is_manual = 1 THEN title ELSE ? END, site_name = ?, description = ?, favicon_url = ?, image_url = ?, published_at = ?, metadata_status = 'ready', metadata_error_code = NULL, metadata_attempt_count = CASE WHEN metadata_attempt_count > ? THEN metadata_attempt_count ELSE ? END, metadata_fetched_at = ?, updated_at = ? WHERE id = ? AND original_url = ? AND metadata_status <> 'ready'",
      )
      .bind(
        input.metadata.canonicalUrl,
        input.metadata.title,
        input.metadata.siteName,
        input.metadata.description,
        input.metadata.faviconUrl,
        input.metadata.imageUrl,
        input.metadata.publishedAt,
        input.attemptCount,
        input.attemptCount,
        input.fetchedAt,
        input.updatedAt,
        input.id,
        input.expectedUrl,
      );
  }

  async #mergeMetadata(
    keeper: Article,
    duplicate: Article,
    input: ApplyMetadataInput,
  ): Promise<ApplyMetadataResult> {
    const duplicateManualTitle = duplicate.titleIsManual ? duplicate.title : null;
    const automaticTitle = input.metadata.title ?? duplicate.title;
    const mergedStatus =
      keeper.status === "unread" || duplicate.status === "unread" ? "unread" : "read";
    const mergedReadAt =
      mergedStatus === "unread" ? null : (keeper.readAt ?? duplicate.readAt ?? input.updatedAt);
    const mergedSavedAt = latestTimestamp(keeper.savedAt, duplicate.savedAt);
    const mergedUpdatedAt = latestTimestamp(keeper.updatedAt, input.updatedAt);
    const mergedAttemptCount = Math.max(
      keeper.metadataAttemptCount,
      duplicate.metadataAttemptCount,
      input.attemptCount,
    );
    const [keeperTagRows, duplicateTagRows] = await this.#database.batch([
      this.#database
        .select({ tagId: articleTags.tagId })
        .from(articleTags)
        .where(eq(articleTags.articleId, keeper.id))
        .orderBy(asc(articleTags.createdAt), asc(articleTags.tagId)),
      this.#database
        .select({ tagId: articleTags.tagId })
        .from(articleTags)
        .where(eq(articleTags.articleId, duplicate.id))
        .orderBy(asc(articleTags.createdAt), asc(articleTags.tagId)),
    ]);
    const keeperTagIds = new Set(keeperTagRows.map(({ tagId }) => tagId));
    const transferableTagIds = duplicateTagRows
      .map(({ tagId }) => tagId)
      .filter((tagId) => !keeperTagIds.has(tagId));
    const availableTagSlots = Math.max(0, MAX_TAGS_PER_ARTICLE - keeperTagIds.size);
    const selectedTagIds = transferableTagIds.slice(0, availableTagSlots);
    const droppedTagCount = transferableTagIds.length - selectedTagIds.length;
    const tagTransferStatements = selectedTagIds.map((tagId) =>
      this.#binding
        .prepare(
          "INSERT OR IGNORE INTO article_tags (article_id, tag_id, created_at) SELECT ?, tag_id, created_at FROM article_tags WHERE article_id = ? AND tag_id = ? AND (SELECT COUNT(*) FROM article_tags WHERE article_id = ?) < ?",
        )
        .bind(keeper.id, duplicate.id, tagId, keeper.id, MAX_TAGS_PER_ARTICLE),
    );

    await this.#binding.batch([
      this.#binding
        .prepare(
          "UPDATE article_urls SET article_id = ? WHERE article_id = ? AND EXISTS (SELECT 1 FROM articles WHERE id = ? AND original_url = ?)",
        )
        .bind(keeper.id, duplicate.id, duplicate.id, input.expectedUrl),
      this.#binding
        .prepare(
          "UPDATE articles SET canonical_url = COALESCE(canonical_url, ?), title = CASE WHEN title_is_manual = 1 THEN title WHEN ? IS NOT NULL THEN ? ELSE COALESCE(title, ?) END, title_is_manual = CASE WHEN title_is_manual = 1 OR ? IS NOT NULL THEN 1 ELSE 0 END, site_name = COALESCE(site_name, ?), description = COALESCE(description, ?), favicon_url = COALESCE(favicon_url, ?), image_url = COALESCE(image_url, ?), published_at = COALESCE(published_at, ?), status = ?, read_at = ?, metadata_status = 'ready', metadata_error_code = NULL, metadata_attempt_count = CASE WHEN metadata_attempt_count > ? THEN metadata_attempt_count ELSE ? END, metadata_fetched_at = ?, saved_at = ?, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM articles WHERE id = ? AND original_url = ?)",
        )
        .bind(
          input.metadata.canonicalUrl ?? duplicate.canonicalUrl,
          duplicateManualTitle,
          duplicateManualTitle,
          automaticTitle,
          duplicateManualTitle,
          input.metadata.siteName ?? duplicate.siteName,
          input.metadata.description ?? duplicate.description,
          input.metadata.faviconUrl ?? duplicate.faviconUrl,
          input.metadata.imageUrl ?? duplicate.imageUrl,
          input.metadata.publishedAt ?? duplicate.publishedAt,
          mergedStatus,
          mergedReadAt,
          mergedAttemptCount,
          mergedAttemptCount,
          latestTimestamp(keeper.metadataFetchedAt ?? "", input.fetchedAt),
          mergedSavedAt,
          mergedUpdatedAt,
          keeper.id,
          duplicate.id,
          input.expectedUrl,
        ),
      ...tagTransferStatements,
      this.#binding
        .prepare("DELETE FROM articles WHERE id = ? AND original_url = ?")
        .bind(duplicate.id, input.expectedUrl),
    ]);

    const duplicateAfterMerge = await this.findById(duplicate.id);
    const keeperAfterMerge = await this.findById(keeper.id);
    if (duplicateAfterMerge !== null || keeperAfterMerge === null) {
      return { outcome: "stale" };
    }

    return {
      outcome: "merged",
      article: keeperAfterMerge,
      removedArticleId: duplicate.id,
      droppedTagCount,
    };
  }

  async deleteById(id: string): Promise<DeleteArticleResult> {
    const result = await this.#binding.prepare("DELETE FROM articles WHERE id = ?").bind(id).run();
    return result.meta.changes === 0 ? { outcome: "notFound" } : { outcome: "deleted" };
  }
}

export function createD1ArticleRepository(binding: D1Database): ArticleRepository {
  return new D1ArticleRepository(binding);
}
