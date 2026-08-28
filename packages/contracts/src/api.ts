import { ARTICLE_LIST_STATUSES, ARTICLE_SORTS, ARTICLE_URL_KINDS } from "@tech-inbox/core/article";
import { MAX_TAGS_PER_ARTICLE } from "@tech-inbox/core/tag";
import { z } from "zod";
import { articleDtoSchema, articleStatusSchema } from "./article";
import { tagDtoSchema, tagIdSchema, tagNameSchema } from "./tag";
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
  "TAG_CONFLICT",
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
  tagId: tagIdSchema.optional(),
  sort: articleSortSchema.default("saved_desc"),
  limit: articleListLimitSchema.default(30),
  cursor: opaqueCursorSchema.optional(),
});

export type ListArticlesQueryInput = z.input<typeof listArticlesQuerySchema>;
export type ListArticlesQuery = z.output<typeof listArticlesQuerySchema>;

export const listArticlesResponseSchema = z
  .strictObject({
    articles: z.array(articleDtoSchema),
    availableTags: z.array(tagDtoSchema).max(CONTRACT_LIMITS.tags),
    tagsByArticleId: z.record(articleIdSchema, z.array(tagDtoSchema).max(MAX_TAGS_PER_ARTICLE)),
    nextCursor: opaqueCursorSchema.nullable(),
  })
  .superRefine(({ articles, availableTags, tagsByArticleId }, context) => {
    const articleIds = new Set(articles.map(({ id }) => id));
    if (
      articleIds.size !== Object.keys(tagsByArticleId).length ||
      Object.keys(tagsByArticleId).some((articleId) => !articleIds.has(articleId))
    ) {
      context.addIssue({
        code: "custom",
        message: "Tag assignments must match the listed articles",
        path: ["tagsByArticleId"],
      });
    }
    const availableTagIds = new Set(availableTags.map(({ id }) => id));
    if (
      Object.values(tagsByArticleId).some((assignedTags) =>
        assignedTags.some(({ id }) => !availableTagIds.has(id)),
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Assigned tags must exist in the available tag catalog",
        path: ["tagsByArticleId"],
      });
    }
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

export const listTagsResponseSchema = z.strictObject({
  tags: z.array(tagDtoSchema),
});

export type ListTagsResponse = z.output<typeof listTagsResponseSchema>;

export const createTagRequestSchema = z.strictObject({
  name: tagNameSchema,
});

export type CreateTagRequest = z.output<typeof createTagRequestSchema>;

export const createTagResponseSchema = z.discriminatedUnion("result", [
  z.strictObject({ result: z.literal("created"), tag: tagDtoSchema }),
  z.strictObject({ result: z.literal("alreadyExists"), tag: tagDtoSchema }),
]);

export type CreateTagResponse = z.output<typeof createTagResponseSchema>;

export const tagIdParamsSchema = z.strictObject({
  id: tagIdSchema,
});

export const updateTagRequestSchema = z.strictObject({
  name: tagNameSchema,
});

export type UpdateTagRequest = z.output<typeof updateTagRequestSchema>;

export const tagResponseSchema = z.strictObject({
  tag: tagDtoSchema,
});

export type TagResponse = z.output<typeof tagResponseSchema>;

export const deleteTagResponseSchema = z.strictObject({
  result: z.literal("deleted"),
});

export type DeleteTagResponse = z.output<typeof deleteTagResponseSchema>;

export const replaceArticleTagsRequestSchema = z
  .strictObject({
    tagIds: z.array(tagIdSchema).max(MAX_TAGS_PER_ARTICLE),
  })
  .superRefine(({ tagIds }, context) => {
    if (new Set(tagIds).size !== tagIds.length) {
      context.addIssue({
        code: "custom",
        message: "Tag IDs must be unique",
        path: ["tagIds"],
      });
    }
  });

export type ReplaceArticleTagsRequest = z.output<typeof replaceArticleTagsRequestSchema>;

export const articleTagsResponseSchema = z.strictObject({
  tags: z.array(tagDtoSchema),
});

export type ArticleTagsResponse = z.output<typeof articleTagsResponseSchema>;

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

export const exportArticleTagDtoSchema = z.strictObject({
  articleId: articleIdSchema,
  tagId: tagIdSchema,
});

export type ExportArticleTagDto = z.output<typeof exportArticleTagDtoSchema>;

export const exportResponseV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  exportedAt: utcDateTimeSchema,
  articles: z.array(articleDtoSchema),
  articleUrls: z.array(articleUrlDtoSchema),
});

export const exportResponseV2Schema = z.strictObject({
  schemaVersion: z.literal(2),
  exportedAt: utcDateTimeSchema,
  articles: z.array(articleDtoSchema),
  articleUrls: z.array(articleUrlDtoSchema),
  tags: z.array(tagDtoSchema).max(CONTRACT_LIMITS.tags),
  articleTags: z.array(exportArticleTagDtoSchema),
});

export const exportResponseSchema = z
  .discriminatedUnion("schemaVersion", [exportResponseV1Schema, exportResponseV2Schema])
  .superRefine((snapshot, context) => {
    const articleIds = new Set(snapshot.articles.map(({ id }) => id));
    if (snapshot.articleUrls.some(({ articleId }) => !articleIds.has(articleId))) {
      context.addIssue({
        code: "custom",
        message: "Exported URL aliases must reference exported articles",
        path: ["articleUrls"],
      });
    }

    if (snapshot.schemaVersion === 1) return;
    const tagIds = new Set(snapshot.tags.map(({ id }) => id));
    const assignments = new Set<string>();
    const assignmentCounts = new Map<string, number>();
    for (const assignment of snapshot.articleTags) {
      const key = `${assignment.articleId}\u0000${assignment.tagId}`;
      if (assignments.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Exported tag assignments must be unique",
          path: ["articleTags"],
        });
      }
      assignments.add(key);
      if (!articleIds.has(assignment.articleId) || !tagIds.has(assignment.tagId)) {
        context.addIssue({
          code: "custom",
          message: "Exported tag assignments must reference exported records",
          path: ["articleTags"],
        });
      }
      const count = (assignmentCounts.get(assignment.articleId) ?? 0) + 1;
      assignmentCounts.set(assignment.articleId, count);
      if (count > CONTRACT_LIMITS.tagsPerArticle) {
        context.addIssue({
          code: "custom",
          message: "Exported articles must not exceed the tag assignment limit",
          path: ["articleTags"],
        });
      }
    }
  });

export type ExportResponse = z.output<typeof exportResponseSchema>;
export type ExportResponseV1 = z.output<typeof exportResponseV1Schema>;
export type ExportResponseV2 = z.output<typeof exportResponseV2Schema>;
