import { ARTICLE_STATUSES, ARTICLE_URL_KINDS } from "@tech-inbox/core/article";
import { METADATA_ERROR_CODES, METADATA_STATUSES } from "@tech-inbox/core/metadata";
import { MAX_TAG_NAME_LENGTH, TAG_COLOR_HUE_COUNT } from "@tech-inbox/core/tag";
export {
  type DaymarkHabitInsert,
  type DaymarkHabitRow,
  type DaymarkHabitVersionInsert,
  type DaymarkHabitVersionRow,
  type DaymarkRecordInsert,
  type DaymarkRecordRow,
  daymarkHabitVersions,
  daymarkHabits,
  daymarkRecords,
  daymarkSchema,
} from "@rizakura-hontai/daymark/schema";
import { sql } from "drizzle-orm/sql";
import { desc } from "drizzle-orm/sql/expressions/select";
import { check } from "drizzle-orm/sqlite-core/checks";
import { integer } from "drizzle-orm/sqlite-core/columns/integer";
import { text } from "drizzle-orm/sqlite-core/columns/text";
import { index, uniqueIndex } from "drizzle-orm/sqlite-core/indexes";
import { primaryKey } from "drizzle-orm/sqlite-core/primary-keys";
import { sqliteTable } from "drizzle-orm/sqlite-core/table";

export const articles = sqliteTable(
  "articles",
  {
    id: text("id").primaryKey(),
    originalUrl: text("original_url").notNull(),
    canonicalUrl: text("canonical_url"),
    title: text("title"),
    titleIsManual: integer("title_is_manual", { mode: "boolean" }).notNull().default(sql`0`),
    siteName: text("site_name"),
    description: text("description"),
    faviconUrl: text("favicon_url"),
    imageUrl: text("image_url"),
    publishedAt: text("published_at"),
    status: text("status", { enum: ARTICLE_STATUSES }).notNull(),
    metadataStatus: text("metadata_status", { enum: METADATA_STATUSES }).notNull(),
    metadataErrorCode: text("metadata_error_code", { enum: METADATA_ERROR_CODES }),
    metadataAttemptCount: integer("metadata_attempt_count").notNull().default(0),
    metadataFetchedAt: text("metadata_fetched_at"),
    savedAt: text("saved_at").notNull(),
    readAt: text("read_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check("articles_title_is_manual_check", sql`${table.titleIsManual} IN (0, 1)`),
    check("articles_status_check", sql`${table.status} IN ('unread', 'read')`),
    check(
      "articles_metadata_status_check",
      sql`${table.metadataStatus} IN ('pending', 'ready', 'failed')`,
    ),
    check("articles_metadata_attempt_count_check", sql`${table.metadataAttemptCount} >= 0`),
    check(
      "articles_status_read_at_check",
      sql`((${table.status} = 'unread' AND ${table.readAt} IS NULL) OR (${table.status} = 'read' AND ${table.readAt} IS NOT NULL))`,
    ),
    index("articles_status_saved_at_id_idx").on(table.status, desc(table.savedAt), desc(table.id)),
    index("articles_status_read_at_id_idx").on(table.status, desc(table.readAt), desc(table.id)),
    index("articles_site_name_idx").on(table.siteName),
  ],
);

export const articleUrls = sqliteTable(
  "article_urls",
  {
    normalizedUrl: text("normalized_url").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ARTICLE_URL_KINDS }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("article_urls_kind_check", sql`${table.kind} IN ('original', 'canonical')`),
    index("article_urls_article_id_idx").on(table.articleId),
  ],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    colorHue: integer("color_hue").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check(
      "tags_name_length_check",
      sql`length(${table.name}) BETWEEN 1 AND ${sql.raw(String(MAX_TAG_NAME_LENGTH))}`,
    ),
    check(
      "tags_color_hue_check",
      sql`${table.colorHue} >= 0 AND ${table.colorHue} < ${sql.raw(String(TAG_COLOR_HUE_COUNT))}`,
    ),
    uniqueIndex("tags_normalized_name_uidx").on(table.normalizedName),
    uniqueIndex("tags_color_hue_uidx").on(table.colorHue),
  ],
);

export const articleTags = sqliteTable(
  "article_tags",
  {
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({
      name: "article_tags_article_id_tag_id_pk",
      columns: [table.articleId, table.tagId],
    }),
    index("article_tags_tag_id_idx").on(table.tagId),
  ],
);

export type ArticleRow = typeof articles.$inferSelect;
export type ArticleInsert = typeof articles.$inferInsert;
export type ArticleUrlRow = typeof articleUrls.$inferSelect;
export type ArticleUrlInsert = typeof articleUrls.$inferInsert;
export type TagRow = typeof tags.$inferSelect;
export type TagInsert = typeof tags.$inferInsert;
export type ArticleTagRow = typeof articleTags.$inferSelect;
export type ArticleTagInsert = typeof articleTags.$inferInsert;
