CREATE TABLE `daymark_habit_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`effective_from` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`target_milli` integer,
	`unit` text,
	`comparison` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `daymark_habits`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "daymark_habit_versions_effective_from_check" CHECK(length("daymark_habit_versions"."effective_from") = 10),
	CONSTRAINT "daymark_habit_versions_kind_check" CHECK("daymark_habit_versions"."kind" IN ('check', 'number')),
	CONSTRAINT "daymark_habit_versions_status_check" CHECK("daymark_habit_versions"."status" IN ('active', 'paused', 'archived')),
	CONSTRAINT "daymark_habit_versions_shape_check" CHECK((("daymark_habit_versions"."kind" = 'check' AND "daymark_habit_versions"."target_milli" IS NULL AND "daymark_habit_versions"."unit" IS NULL AND "daymark_habit_versions"."comparison" IS NULL) OR ("daymark_habit_versions"."kind" = 'number' AND "daymark_habit_versions"."target_milli" IS NOT NULL AND "daymark_habit_versions"."target_milli" BETWEEN 0 AND 1000000000000 AND "daymark_habit_versions"."unit" IS NOT NULL AND length("daymark_habit_versions"."unit") BETWEEN 1 AND 20 AND "daymark_habit_versions"."comparison" IN ('at_least', 'at_most'))))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daymark_habit_versions_habit_effective_uidx` ON `daymark_habit_versions` (`habit_id`,`effective_from`);--> statement-breakpoint
CREATE INDEX `daymark_habit_versions_effective_idx` ON `daymark_habit_versions` (`effective_from`,`habit_id`);--> statement-breakpoint
CREATE TABLE `daymark_habits` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`created_on` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "daymark_habits_name_length_check" CHECK(length("daymark_habits"."name") BETWEEN 1 AND 80),
	CONSTRAINT "daymark_habits_kind_check" CHECK("daymark_habits"."kind" IN ('check', 'number')),
	CONSTRAINT "daymark_habits_created_on_check" CHECK(length("daymark_habits"."created_on") = 10)
);
--> statement-breakpoint
CREATE INDEX `daymark_habits_created_on_id_idx` ON `daymark_habits` (`created_on`,`id`);--> statement-breakpoint
CREATE TABLE `daymark_records` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`record_date` text NOT NULL,
	`kind` text NOT NULL,
	`checked` integer,
	`value_milli` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `daymark_habits`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "daymark_records_date_check" CHECK(length("daymark_records"."record_date") = 10),
	CONSTRAINT "daymark_records_kind_check" CHECK("daymark_records"."kind" IN ('check', 'number')),
	CONSTRAINT "daymark_records_shape_check" CHECK((("daymark_records"."kind" = 'check' AND "daymark_records"."checked" IS NOT NULL AND "daymark_records"."checked" IN (0, 1) AND "daymark_records"."value_milli" IS NULL) OR ("daymark_records"."kind" = 'number' AND "daymark_records"."checked" IS NULL AND "daymark_records"."value_milli" IS NOT NULL AND "daymark_records"."value_milli" BETWEEN 0 AND 1000000000000)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daymark_records_habit_date_uidx` ON `daymark_records` (`habit_id`,`record_date`);--> statement-breakpoint
CREATE INDEX `daymark_records_date_habit_idx` ON `daymark_records` (`record_date`,`habit_id`);