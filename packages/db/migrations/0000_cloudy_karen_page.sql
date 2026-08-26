CREATE TABLE `article_urls` (
	`normalized_url` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "article_urls_kind_check" CHECK("article_urls"."kind" IN ('original', 'canonical'))
);
--> statement-breakpoint
CREATE INDEX `article_urls_article_id_idx` ON `article_urls` (`article_id`);--> statement-breakpoint
CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`original_url` text NOT NULL,
	`canonical_url` text,
	`title` text,
	`title_is_manual` integer DEFAULT 0 NOT NULL,
	`site_name` text,
	`description` text,
	`favicon_url` text,
	`image_url` text,
	`published_at` text,
	`status` text NOT NULL,
	`metadata_status` text NOT NULL,
	`metadata_error_code` text,
	`metadata_attempt_count` integer DEFAULT 0 NOT NULL,
	`metadata_fetched_at` text,
	`saved_at` text NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "articles_title_is_manual_check" CHECK("articles"."title_is_manual" IN (0, 1)),
	CONSTRAINT "articles_status_check" CHECK("articles"."status" IN ('unread', 'read')),
	CONSTRAINT "articles_metadata_status_check" CHECK("articles"."metadata_status" IN ('pending', 'ready', 'failed')),
	CONSTRAINT "articles_metadata_attempt_count_check" CHECK("articles"."metadata_attempt_count" >= 0),
	CONSTRAINT "articles_status_read_at_check" CHECK((("articles"."status" = 'unread' AND "articles"."read_at" IS NULL) OR ("articles"."status" = 'read' AND "articles"."read_at" IS NOT NULL)))
);
--> statement-breakpoint
CREATE INDEX `articles_status_saved_at_id_idx` ON `articles` (`status`,"saved_at" desc,"id" desc);--> statement-breakpoint
CREATE INDEX `articles_status_read_at_id_idx` ON `articles` (`status`,"read_at" desc,"id" desc);--> statement-breakpoint
CREATE INDEX `articles_site_name_idx` ON `articles` (`site_name`);