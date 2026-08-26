import { sql } from "drizzle-orm/sql";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core/dialect";
import type { IndexColumn } from "drizzle-orm/sqlite-core/indexes";
import { getTableConfig } from "drizzle-orm/sqlite-core/utils";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { MetadataErrorCode } from "@tech-inbox/core/metadata";

import {
  type ArticleInsert,
  type ArticleRow,
  type ArticleUrlInsert,
  type ArticleUrlRow,
  articles,
  articleUrls,
} from "./schema";

const dialect = new SQLiteSyncDialect();

const renderIndexColumn = (column: IndexColumn) => dialect.sqlToQuery(sql`${column}`).sql;

const renderChecks = (table: Parameters<typeof getTableConfig>[0]) =>
  Object.fromEntries(
    getTableConfig(table).checks.map((constraint) => [
      constraint.name,
      dialect.sqlToQuery(constraint.value).sql,
    ]),
  );

describe("articles schema", () => {
  it("defines the complete article record and defaults", () => {
    const config = getTableConfig(articles);

    expect(config.name).toBe("articles");
    expect(config.columns.map(({ name }) => name)).toEqual([
      "id",
      "original_url",
      "canonical_url",
      "title",
      "title_is_manual",
      "site_name",
      "description",
      "favicon_url",
      "image_url",
      "published_at",
      "status",
      "metadata_status",
      "metadata_error_code",
      "metadata_attempt_count",
      "metadata_fetched_at",
      "saved_at",
      "read_at",
      "created_at",
      "updated_at",
    ]);

    expect(articles.id.primary).toBe(true);
    expect(articles.titleIsManual.notNull).toBe(true);
    expect(articles.titleIsManual.hasDefault).toBe(true);
    expect(articles.metadataAttemptCount.default).toBe(0);
  });

  it("keeps all article invariants as explicit checks", () => {
    expect(renderChecks(articles)).toEqual({
      articles_title_is_manual_check: '"articles"."title_is_manual" IN (0, 1)',
      articles_status_check: "\"articles\".\"status\" IN ('unread', 'read')",
      articles_metadata_status_check:
        "\"articles\".\"metadata_status\" IN ('pending', 'ready', 'failed')",
      articles_metadata_attempt_count_check: '"articles"."metadata_attempt_count" >= 0',
      articles_status_read_at_check:
        '(("articles"."status" = \'unread\' AND "articles"."read_at" IS NULL) OR ("articles"."status" = \'read\' AND "articles"."read_at" IS NOT NULL))',
    });
  });

  it("defines the three required article indexes with stable ordering", () => {
    const indexes = getTableConfig(articles).indexes;

    expect(indexes.map(({ config }) => config.name)).toEqual([
      "articles_status_saved_at_id_idx",
      "articles_status_read_at_id_idx",
      "articles_site_name_idx",
    ]);
    expect(indexes.map(({ config }) => config.columns.map(renderIndexColumn))).toEqual([
      ['"articles"."status"', '"articles"."saved_at" desc', '"articles"."id" desc'],
      ['"articles"."status"', '"articles"."read_at" desc', '"articles"."id" desc'],
      ['"articles"."site_name"'],
    ]);
  });
});

describe("article_urls schema", () => {
  it("defines the normalized URL primary key, alias check, and lookup index", () => {
    const config = getTableConfig(articleUrls);

    expect(config.name).toBe("article_urls");
    expect(config.columns.map(({ name }) => name)).toEqual([
      "normalized_url",
      "article_id",
      "kind",
      "created_at",
    ]);
    expect(articleUrls.normalizedUrl.primary).toBe(true);
    expect(renderChecks(articleUrls)).toEqual({
      article_urls_kind_check: "\"article_urls\".\"kind\" IN ('original', 'canonical')",
    });

    const [articleIdIndex] = config.indexes;
    expect(articleIdIndex?.config.name).toBe("article_urls_article_id_idx");
    expect(articleIdIndex?.config.columns.map(renderIndexColumn)).toEqual([
      '"article_urls"."article_id"',
    ]);
  });

  it("cascades aliases when their article is deleted", () => {
    const [articleForeignKey] = getTableConfig(articleUrls).foreignKeys;
    const reference = articleForeignKey?.reference();

    expect(articleForeignKey?.onDelete).toBe("cascade");
    expect(reference?.columns).toEqual([articleUrls.articleId]);
    expect(reference?.foreignColumns).toEqual([articles.id]);
    expect(reference?.foreignTable).toBe(articles);
  });
});

describe("database record types", () => {
  it("keeps database records distinct from API DTOs", () => {
    expectTypeOf<ArticleRow["status"]>().toEqualTypeOf<"unread" | "read">();
    expectTypeOf<ArticleRow["metadataErrorCode"]>().toEqualTypeOf<MetadataErrorCode | null>();
    expectTypeOf<ArticleInsert["titleIsManual"]>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ArticleUrlRow["kind"]>().toEqualTypeOf<"original" | "canonical">();
    expectTypeOf<ArticleUrlInsert["normalizedUrl"]>().toEqualTypeOf<string>();
  });
});
