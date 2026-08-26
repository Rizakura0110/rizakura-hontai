import type {
  Article,
  ArticleChanges,
  ArticleListCriteria,
  ArticlePage,
  CreateArticleInput,
  UpdateArticleInput,
} from "@tech-inbox/core/article";
import type { NormalizedUrl } from "@tech-inbox/core/url-normalization";
import { articles, articleUrls, type ArticleRow } from "@tech-inbox/db";
import { and, asc, desc, eq, gt, isNull, lt, or, type SQL, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  ArticleRepository,
  CreateArticleResult,
  DeleteArticleResult,
  UpdateArticleResult,
} from "./article-repository";
import { mapArticleRow } from "./article-mapper";

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
    const finalItem = items.at(-1);

    return {
      items,
      nextCursor: hasNextPage && finalItem !== undefined ? positionFor(finalItem, criteria) : null,
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

  async deleteById(id: string): Promise<DeleteArticleResult> {
    const result = await this.#binding.prepare("DELETE FROM articles WHERE id = ?").bind(id).run();
    return result.meta.changes === 0 ? { outcome: "notFound" } : { outcome: "deleted" };
  }
}

export function createD1ArticleRepository(binding: D1Database): ArticleRepository {
  return new D1ArticleRepository(binding);
}
