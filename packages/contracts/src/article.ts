import { ARTICLE_STATUSES } from "@tech-inbox/core/article";
import { METADATA_ERROR_CODES, METADATA_STATUSES } from "@tech-inbox/core/metadata";
import { z } from "zod";
import {
  articleIdSchema,
  CONTRACT_LIMITS,
  httpUrlSchema,
  nullableHttpUrlSchema,
  nullableUtcDateTimeSchema,
  utcDateTimeSchema,
} from "./primitives";

export const articleStatusSchema = z.enum(ARTICLE_STATUSES);
export const metadataStatusSchema = z.enum(METADATA_STATUSES);
export const metadataErrorCodeSchema = z.enum(METADATA_ERROR_CODES);

export type ArticleStatusDto = z.output<typeof articleStatusSchema>;
export type MetadataStatusDto = z.output<typeof metadataStatusSchema>;
export type MetadataErrorCodeDto = z.output<typeof metadataErrorCodeSchema>;

export const articleDtoSchema = z
  .strictObject({
    id: articleIdSchema,
    originalUrl: httpUrlSchema,
    canonicalUrl: nullableHttpUrlSchema,
    title: z.string().max(CONTRACT_LIMITS.title).nullable(),
    titleIsManual: z.boolean(),
    siteName: z.string().max(CONTRACT_LIMITS.siteName).nullable(),
    description: z.string().max(CONTRACT_LIMITS.description).nullable(),
    faviconUrl: nullableHttpUrlSchema,
    imageUrl: nullableHttpUrlSchema,
    publishedAt: nullableUtcDateTimeSchema,
    status: articleStatusSchema,
    metadataStatus: metadataStatusSchema,
    metadataErrorCode: metadataErrorCodeSchema.nullable(),
    metadataAttemptCount: z.number().int().nonnegative(),
    metadataFetchedAt: nullableUtcDateTimeSchema,
    savedAt: utcDateTimeSchema,
    readAt: nullableUtcDateTimeSchema,
    createdAt: utcDateTimeSchema,
    updatedAt: utcDateTimeSchema,
  })
  .superRefine((article, context) => {
    if (article.status === "unread" && article.readAt !== null) {
      context.addIssue({
        code: "custom",
        message: "Unread articles must not have a readAt timestamp",
        path: ["readAt"],
      });
    }

    if (article.status === "read" && article.readAt === null) {
      context.addIssue({
        code: "custom",
        message: "Read articles must have a readAt timestamp",
        path: ["readAt"],
      });
    }
  });

export type ArticleDto = z.output<typeof articleDtoSchema>;
