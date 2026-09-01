import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDirectory = fileURLToPath(new URL("../migrations", import.meta.url));
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((fileName) => /^\d{4}_.+\.sql$/u.test(fileName))
  .sort();
const migrationSql = migrationFiles
  .map((fileName) => readFileSync(new URL(`../migrations/${fileName}`, import.meta.url), "utf8"))
  .join("\n");

describe("database migrations", () => {
  it("contains a generated initial migration", () => {
    expect(migrationFiles.filter((fileName) => /^0000_.+\.sql$/u.test(fileName))).toHaveLength(1);
    expect(migrationFiles.filter((fileName) => /^0001_.+\.sql$/u.test(fileName))).toHaveLength(1);
    expect(migrationFiles.filter((fileName) => /^0002_.+\.sql$/u.test(fileName))).toHaveLength(1);
  });

  it("persists all table invariants as SQLite constraints", () => {
    for (const expectedSql of [
      "CREATE TABLE `articles`",
      "CREATE TABLE `article_urls`",
      "CREATE TABLE `tags`",
      "CREATE TABLE `article_tags`",
      "ON DELETE cascade",
      'CONSTRAINT "article_urls_kind_check"',
      'CONSTRAINT "articles_title_is_manual_check"',
      'CONSTRAINT "articles_status_check"',
      'CONSTRAINT "articles_metadata_status_check"',
      'CONSTRAINT "articles_metadata_attempt_count_check"',
      'CONSTRAINT "articles_status_read_at_check"',
      'CONSTRAINT "tags_name_length_check"',
      'CONSTRAINT "tags_color_hue_check"',
      "CREATE TABLE `daymark_habits`",
      "CREATE TABLE `daymark_habit_versions`",
      "CREATE TABLE `daymark_records`",
      'CONSTRAINT "daymark_habits_kind_check"',
      'CONSTRAINT "daymark_habit_versions_shape_check"',
      'CONSTRAINT "daymark_records_shape_check"',
    ]) {
      expect(migrationSql).toContain(expectedSql);
    }
  });

  it("creates the required indexes with stable names and ordering", () => {
    expect(migrationSql).toContain(
      'CREATE INDEX `articles_status_saved_at_id_idx` ON `articles` (`status`,"saved_at" desc,"id" desc)',
    );
    expect(migrationSql).toContain(
      'CREATE INDEX `articles_status_read_at_id_idx` ON `articles` (`status`,"read_at" desc,"id" desc)',
    );
    expect(migrationSql).toContain(
      "CREATE INDEX `articles_site_name_idx` ON `articles` (`site_name`)",
    );
    expect(migrationSql).toContain(
      "CREATE INDEX `article_urls_article_id_idx` ON `article_urls` (`article_id`)",
    );
    expect(migrationSql).toContain(
      "CREATE UNIQUE INDEX `tags_normalized_name_uidx` ON `tags` (`normalized_name`)",
    );
    expect(migrationSql).toContain(
      "CREATE UNIQUE INDEX `tags_color_hue_uidx` ON `tags` (`color_hue`)",
    );
    expect(migrationSql).toContain(
      "CREATE INDEX `article_tags_tag_id_idx` ON `article_tags` (`tag_id`)",
    );
    expect(migrationSql).toContain(
      "CREATE UNIQUE INDEX `daymark_habit_versions_habit_effective_uidx` ON `daymark_habit_versions` (`habit_id`,`effective_from`)",
    );
    expect(migrationSql).toContain(
      "CREATE UNIQUE INDEX `daymark_records_habit_date_uidx` ON `daymark_records` (`habit_id`,`record_date`)",
    );
  });
});
