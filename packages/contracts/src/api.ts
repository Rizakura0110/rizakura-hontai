import { ARTICLE_LIST_STATUSES, ARTICLE_SORTS, ARTICLE_URL_KINDS } from "@tech-inbox/core/article";
import { MAX_TAGS_PER_ARTICLE, normalizeTagName } from "@tech-inbox/core/tag";
import { normalizeUrl } from "@tech-inbox/core/url-normalization";
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

export * from "./http";

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

export const createArticleRequestSchema = z
  .strictObject({
    url: httpUrlSchema,
    tagIds: z.array(tagIdSchema).max(MAX_TAGS_PER_ARTICLE).default([]),
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

export type CreateArticleRequest = z.output<typeof createArticleRequestSchema>;

export const createArticleResponseSchema = z.discriminatedUnion("result", [
  z.strictObject({
    result: z.literal("created"),
    article: articleDtoSchema,
    tags: z.array(tagDtoSchema).max(MAX_TAGS_PER_ARTICLE),
  }),
  z.strictObject({
    result: z.literal("alreadyExists"),
    article: articleDtoSchema,
    tags: z.array(tagDtoSchema).max(MAX_TAGS_PER_ARTICLE),
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

export const MAX_BACKUP_IMPORT_FILE_BYTES = 1_024 * 1_024;
export const MAX_BACKUP_IMPORT_BYTES = MAX_BACKUP_IMPORT_FILE_BYTES + 1_024;

export const BACKUP_IMPORT_LIMITS = {
  articles: 1_000,
  articleUrls: 3_000,
  articleTags: 10_000,
} as const;

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

export const backupImportSnapshotSchema = exportResponseSchema.superRefine((snapshot, context) => {
  if (snapshot.articles.length > BACKUP_IMPORT_LIMITS.articles) {
    context.addIssue({
      code: "custom",
      message: `A backup must not exceed ${BACKUP_IMPORT_LIMITS.articles} articles`,
      path: ["articles"],
    });
  }
  if (snapshot.articleUrls.length > BACKUP_IMPORT_LIMITS.articleUrls) {
    context.addIssue({
      code: "custom",
      message: `A backup must not exceed ${BACKUP_IMPORT_LIMITS.articleUrls} URL aliases`,
      path: ["articleUrls"],
    });
  }

  if (hasDuplicates(snapshot.articles.map(({ id }) => id))) {
    context.addIssue({
      code: "custom",
      message: "Backup article IDs must be unique",
      path: ["articles"],
    });
  }
  if (hasDuplicates(snapshot.articleUrls.map(({ normalizedUrl }) => normalizedUrl))) {
    context.addIssue({
      code: "custom",
      message: "Backup URL aliases must be unique",
      path: ["articleUrls"],
    });
  }

  const aliasesByArticle = new Map<string, typeof snapshot.articleUrls>();
  for (const alias of snapshot.articleUrls) {
    const normalized = normalizeUrl(alias.normalizedUrl);
    if (!normalized.ok || normalized.value !== alias.normalizedUrl) {
      context.addIssue({
        code: "custom",
        message: "Backup URL aliases must already be normalized",
        path: ["articleUrls"],
      });
    }
    const aliases = aliasesByArticle.get(alias.articleId) ?? [];
    aliasesByArticle.set(alias.articleId, [...aliases, alias]);
  }

  for (const article of snapshot.articles) {
    const originalUrl = normalizeUrl(article.originalUrl);
    const aliases = aliasesByArticle.get(article.id) ?? [];
    const originalAliases = aliases.filter(({ kind }) => kind === "original");
    if (
      !originalUrl.ok ||
      originalAliases.length !== 1 ||
      originalAliases[0]?.normalizedUrl !== originalUrl.value
    ) {
      context.addIssue({
        code: "custom",
        message: "Each backup article must have one matching original URL alias",
        path: ["articleUrls"],
      });
    }
  }

  if (snapshot.schemaVersion === 1) return;
  if (snapshot.articleTags.length > BACKUP_IMPORT_LIMITS.articleTags) {
    context.addIssue({
      code: "custom",
      message: `A backup must not exceed ${BACKUP_IMPORT_LIMITS.articleTags} tag assignments`,
      path: ["articleTags"],
    });
  }
  if (hasDuplicates(snapshot.tags.map(({ id }) => id))) {
    context.addIssue({
      code: "custom",
      message: "Backup tag IDs must be unique",
      path: ["tags"],
    });
  }
  if (
    hasDuplicates(
      snapshot.tags
        .map(({ name }) => normalizeTagName(name))
        .map((tag) => (tag.ok ? tag.normalizedName : "")),
    )
  ) {
    context.addIssue({
      code: "custom",
      message: "Backup tag names must be unique",
      path: ["tags"],
    });
  }
  if (hasDuplicates(snapshot.tags.map(({ colorHue }) => String(colorHue)))) {
    context.addIssue({
      code: "custom",
      message: "Backup tag colors must be unique",
      path: ["tags"],
    });
  }
});

export type BackupImportSnapshot = z.output<typeof backupImportSnapshotSchema>;

export const backupImportRequestSchema = z.strictObject({
  backup: backupImportSnapshotSchema,
});

export type BackupImportRequest = z.output<typeof backupImportRequestSchema>;

export const backupImportSummarySchema = z.strictObject({
  source: z.strictObject({
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    exportedAt: utcDateTimeSchema,
    articles: z.number().int().nonnegative(),
    articleUrls: z.number().int().nonnegative(),
    tags: z.number().int().nonnegative(),
    articleTags: z.number().int().nonnegative(),
  }),
  changes: z.strictObject({
    articlesCreated: z.number().int().nonnegative(),
    articlesMatched: z.number().int().nonnegative(),
    articleIdsRemapped: z.number().int().nonnegative(),
    articleUrlsCreated: z.number().int().nonnegative(),
    articleUrlsMatched: z.number().int().nonnegative(),
    articleUrlsSkipped: z.number().int().nonnegative(),
    tagsCreated: z.number().int().nonnegative(),
    tagsMatched: z.number().int().nonnegative(),
    tagsSkipped: z.number().int().nonnegative(),
    tagIdsRemapped: z.number().int().nonnegative(),
    tagColorsReassigned: z.number().int().nonnegative(),
    articleTagsCreated: z.number().int().nonnegative(),
    articleTagsMatched: z.number().int().nonnegative(),
    articleTagsSkipped: z.number().int().nonnegative(),
    pendingArticlesReset: z.number().int().nonnegative(),
  }),
  hasChanges: z.boolean(),
});

export type BackupImportSummary = z.output<typeof backupImportSummarySchema>;

export const backupImportPreviewResponseSchema = z.strictObject({
  result: z.literal("preview"),
  summary: backupImportSummarySchema,
});

export type BackupImportPreviewResponse = z.output<typeof backupImportPreviewResponseSchema>;

export const backupImportResponseSchema = z.strictObject({
  result: z.literal("imported"),
  summary: backupImportSummarySchema,
});

export type BackupImportResponse = z.output<typeof backupImportResponseSchema>;
