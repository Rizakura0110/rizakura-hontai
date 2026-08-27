import { ARTICLE_LIST_STATUSES, ARTICLE_SORTS, ARTICLE_URL_KINDS } from "@tech-inbox/core/article";
import { z } from "zod";
import { articleDtoSchema, articleStatusSchema } from "./article";
import {
  articleIdSchema,
  CONTRACT_LIMITS,
  httpUrlSchema,
  opaqueCursorSchema,
  utcDateTimeSchema,
} from "./primitives";

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "URL_CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
] as const;

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);

export const apiErrorDetailsSchema = z.record(
  z.string().min(1).max(100),
  z.array(z.string().max(500)).max(20),
);

export type ApiErrorDetails = z.output<typeof apiErrorDetailsSchema>;

export const apiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: apiErrorCodeSchema,
    message: z.string().min(1).max(500),
    requestId: z.uuid(),
    details: apiErrorDetailsSchema.optional(),
  }),
});

export type ApiErrorCode = z.output<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.output<typeof apiErrorResponseSchema>;

export const healthResponseSchema = z.strictObject({
  status: z.literal("ok"),
});

export type HealthResponse = z.output<typeof healthResponseSchema>;

export const articleListStatusSchema = z.enum(ARTICLE_LIST_STATUSES);
export const articleSortSchema = z.enum(ARTICLE_SORTS);

export type ArticleListStatus = z.output<typeof articleListStatusSchema>;
export type ArticleSort = z.output<typeof articleSortSchema>;

const articleListLimitSchema = z
  .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
  .pipe(z.number().int().min(1).max(100));

export const listArticlesQuerySchema = z.strictObject({
  status: articleListStatusSchema.default("all"),
  q: z.string().trim().min(1).max(CONTRACT_LIMITS.searchQuery).optional(),
  site: z.string().trim().min(1).max(CONTRACT_LIMITS.siteName).optional(),
  sort: articleSortSchema.default("saved_desc"),
  limit: articleListLimitSchema.default(30),
  cursor: opaqueCursorSchema.optional(),
});

export type ListArticlesQueryInput = z.input<typeof listArticlesQuerySchema>;
export type ListArticlesQuery = z.output<typeof listArticlesQuerySchema>;

export const listArticlesResponseSchema = z.strictObject({
  articles: z.array(articleDtoSchema),
  nextCursor: opaqueCursorSchema.nullable(),
});

export type ListArticlesResponse = z.output<typeof listArticlesResponseSchema>;

export const createArticleRequestSchema = z.strictObject({
  url: httpUrlSchema,
});

export type CreateArticleRequest = z.output<typeof createArticleRequestSchema>;

export const createArticleResponseSchema = z.discriminatedUnion("result", [
  z.strictObject({
    result: z.literal("created"),
    article: articleDtoSchema,
  }),
  z.strictObject({
    result: z.literal("alreadyExists"),
    article: articleDtoSchema,
  }),
]);

export type CreateArticleResponse = z.output<typeof createArticleResponseSchema>;

export const articleIdParamsSchema = z.strictObject({
  id: articleIdSchema,
});

export type ArticleIdParams = z.output<typeof articleIdParamsSchema>;

export const articleResponseSchema = z.strictObject({
  article: articleDtoSchema,
});

export type ArticleResponse = z.output<typeof articleResponseSchema>;

export const getArticleResponseSchema = articleResponseSchema;

export type GetArticleResponse = z.output<typeof getArticleResponseSchema>;

export const updateArticleResponseSchema = articleResponseSchema;

export type UpdateArticleResponse = z.output<typeof updateArticleResponseSchema>;

export const updateArticleRequestSchema = z
  .strictObject({
    title: z.string().max(CONTRACT_LIMITS.title).optional(),
    url: httpUrlSchema.optional(),
    status: articleStatusSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one updatable field is required",
  });

export type UpdateArticleRequest = z.output<typeof updateArticleRequestSchema>;

export const deleteArticleResponseSchema = z.strictObject({
  result: z.literal("deleted"),
});

export type DeleteArticleResponse = z.output<typeof deleteArticleResponseSchema>;

export const retryMetadataRequestSchema = z.strictObject({});

export type RetryMetadataRequest = z.output<typeof retryMetadataRequestSchema>;

export const retryMetadataResponseSchema = articleResponseSchema;

export type RetryMetadataResponse = z.output<typeof retryMetadataResponseSchema>;

export const articleUrlKindSchema = z.enum(ARTICLE_URL_KINDS);

export type ArticleUrlKindDto = z.output<typeof articleUrlKindSchema>;

export const articleUrlDtoSchema = z.strictObject({
  normalizedUrl: httpUrlSchema,
  articleId: articleIdSchema,
  kind: articleUrlKindSchema,
  createdAt: utcDateTimeSchema,
});

export type ArticleUrlDto = z.output<typeof articleUrlDtoSchema>;

export const exportResponseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  exportedAt: utcDateTimeSchema,
  articles: z.array(articleDtoSchema),
  articleUrls: z.array(articleUrlDtoSchema),
});

export type ExportResponse = z.output<typeof exportResponseSchema>;
