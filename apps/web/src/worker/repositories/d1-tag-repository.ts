import { articles, articleTags, tags } from "@rizakura-me/db";
import { asc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  ArticleTagsResult,
  CreateTagInput,
  CreateTagResult,
  DeleteTagResult,
  ReplaceArticleTagsInput,
  ReplaceArticleTagsResult,
  TagRepository,
  UpdateTagNameInput,
  UpdateTagNameResult,
} from "./tag-repository";
import { mapTagRow } from "./tag-mapper";

type TagDatabase = ReturnType<typeof drizzle>;

class D1TagRepository implements TagRepository {
  readonly #binding: D1Database;
  readonly #database: TagDatabase;

  constructor(binding: D1Database) {
    this.#binding = binding;
    this.#database = drizzle(binding);
  }

  async list() {
    const rows = await this.#database
      .select()
      .from(tags)
      .orderBy(asc(tags.normalizedName), asc(tags.id));
    return rows.map(mapTagRow);
  }

  async findById(id: string) {
    const [row] = await this.#database.select().from(tags).where(eq(tags.id, id)).limit(1);
    return row === undefined ? null : mapTagRow(row);
  }

  async findByNormalizedName(normalizedName: string) {
    const [row] = await this.#database
      .select()
      .from(tags)
      .where(eq(tags.normalizedName, normalizedName))
      .limit(1);
    return row === undefined ? null : mapTagRow(row);
  }

  async #findByColorHue(colorHue: number) {
    const [row] = await this.#database
      .select()
      .from(tags)
      .where(eq(tags.colorHue, colorHue))
      .limit(1);
    return row === undefined ? null : mapTagRow(row);
  }

  async create(input: CreateTagInput): Promise<CreateTagResult> {
    try {
      await this.#database.insert(tags).values(input);
    } catch (error: unknown) {
      const existingName = await this.findByNormalizedName(input.normalizedName);
      if (existingName !== null) return { outcome: "nameConflict", tag: existingName };
      if ((await this.#findByColorHue(input.colorHue)) !== null) {
        return { outcome: "colorConflict" };
      }
      throw error;
    }

    const created = await this.findById(input.id);
    if (created === null) throw new Error("The newly created tag could not be loaded.");
    return { outcome: "created", tag: created };
  }

  async updateName(input: UpdateTagNameInput): Promise<UpdateTagNameResult> {
    const existing = await this.findById(input.id);
    if (existing === null) return { outcome: "notFound" };

    const nameOwner = await this.findByNormalizedName(input.normalizedName);
    if (nameOwner !== null && nameOwner.id !== input.id) {
      return { outcome: "nameConflict", tag: nameOwner };
    }

    try {
      await this.#database
        .update(tags)
        .set({
          name: input.name,
          normalizedName: input.normalizedName,
          updatedAt: input.updatedAt,
        })
        .where(eq(tags.id, input.id));
    } catch (error: unknown) {
      const ownerAfterRace = await this.findByNormalizedName(input.normalizedName);
      if (ownerAfterRace !== null && ownerAfterRace.id !== input.id) {
        return { outcome: "nameConflict", tag: ownerAfterRace };
      }
      throw error;
    }

    const updated = await this.findById(input.id);
    return updated === null ? { outcome: "notFound" } : { outcome: "updated", tag: updated };
  }

  async deleteById(id: string): Promise<DeleteTagResult> {
    const result = await this.#binding.prepare("DELETE FROM tags WHERE id = ?").bind(id).run();
    return result.meta.changes === 0 ? { outcome: "notFound" } : { outcome: "deleted" };
  }

  async #articleExists(articleId: string): Promise<boolean> {
    const [row] = await this.#database
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);
    return row !== undefined;
  }

  async listForArticle(articleId: string): Promise<ArticleTagsResult> {
    if (!(await this.#articleExists(articleId))) return { outcome: "articleNotFound" };

    const rows = await this.#database
      .select({ tag: tags })
      .from(articleTags)
      .innerJoin(tags, eq(articleTags.tagId, tags.id))
      .where(eq(articleTags.articleId, articleId))
      .orderBy(asc(tags.normalizedName), asc(tags.id));
    return { outcome: "found", tags: rows.map(({ tag }) => mapTagRow(tag)) };
  }

  async replaceArticleTags(input: ReplaceArticleTagsInput): Promise<ReplaceArticleTagsResult> {
    if (!(await this.#articleExists(input.articleId))) return { outcome: "articleNotFound" };

    const uniqueTagIds = Array.from(new Set(input.tagIds));
    const existingTags =
      uniqueTagIds.length === 0
        ? []
        : await this.#database.select().from(tags).where(inArray(tags.id, uniqueTagIds));
    if (existingTags.length !== uniqueTagIds.length) return { outcome: "tagNotFound" };

    const statements = [
      this.#binding.prepare("DELETE FROM article_tags WHERE article_id = ?").bind(input.articleId),
      ...uniqueTagIds.map((tagId) =>
        this.#binding
          .prepare("INSERT INTO article_tags (article_id, tag_id, created_at) VALUES (?, ?, ?)")
          .bind(input.articleId, tagId, input.createdAt),
      ),
    ];

    try {
      await this.#binding.batch(statements);
    } catch (error: unknown) {
      if (!(await this.#articleExists(input.articleId))) return { outcome: "articleNotFound" };
      const tagsAfterRace =
        uniqueTagIds.length === 0
          ? []
          : await this.#database
              .select({ id: tags.id })
              .from(tags)
              .where(inArray(tags.id, uniqueTagIds));
      if (tagsAfterRace.length !== uniqueTagIds.length) return { outcome: "tagNotFound" };
      throw error;
    }

    const updated = await this.listForArticle(input.articleId);
    return updated.outcome === "articleNotFound"
      ? updated
      : { outcome: "updated", tags: updated.tags };
  }
}

export function createD1TagRepository(binding: D1Database): TagRepository {
  return new D1TagRepository(binding);
}
