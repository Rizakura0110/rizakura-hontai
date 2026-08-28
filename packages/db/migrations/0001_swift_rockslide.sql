CREATE TABLE `article_tags` (
	`article_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`article_id`, `tag_id`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `article_tags_tag_id_idx` ON `article_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`color_hue` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "tags_name_length_check" CHECK(length("tags"."name") BETWEEN 1 AND 30),
	CONSTRAINT "tags_color_hue_check" CHECK("tags"."color_hue" >= 0 AND "tags"."color_hue" < 360)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_normalized_name_uidx` ON `tags` (`normalized_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_color_hue_uidx` ON `tags` (`color_hue`);