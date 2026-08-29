import type {
  ArticleDto,
  BackupImportSnapshot,
  BackupImportSummary,
  TagDto,
} from "@tech-inbox/contracts";
import type { Article, ArticleUrlAlias } from "@tech-inbox/core/article";
import {
  allocateTagColorHue,
  MAX_TAGS,
  MAX_TAGS_PER_ARTICLE,
  normalizeTagName,
  type Tag,
} from "@tech-inbox/core/tag";
import { normalizeUrl, type NormalizedUrl } from "@tech-inbox/core/url-normalization";
import type { ArticleExportSnapshot } from "./repositories/article-repository";

export type BackupArticleTagInsert = {
  readonly articleId: string;
  readonly tagId: string;
  readonly createdAt: string;
};

export type BackupImportPlan = {
  readonly articles: readonly Article[];
  readonly articleUrls: readonly ArticleUrlAlias[];
  readonly tags: readonly Tag[];
  readonly articleTags: readonly BackupArticleTagInsert[];
  readonly summary: BackupImportSummary;
};

type IdGenerator = () => string;

function toArticle(dto: ArticleDto, now: string): { article: Article; pendingReset: boolean } {
  const pendingReset = dto.metadataStatus === "pending";
  const fields = {
    id: dto.id,
    originalUrl: dto.originalUrl,
    canonicalUrl: dto.canonicalUrl,
    title: dto.title,
    titleIsManual: dto.titleIsManual,
    siteName: dto.siteName,
    description: dto.description,
    faviconUrl: dto.faviconUrl,
    imageUrl: dto.imageUrl,
    publishedAt: dto.publishedAt,
    metadataStatus: pendingReset ? ("failed" as const) : dto.metadataStatus,
    metadataErrorCode: pendingReset ? ("NETWORK_ERROR" as const) : dto.metadataErrorCode,
    metadataAttemptCount: dto.metadataAttemptCount,
    metadataFetchedAt: pendingReset ? now : dto.metadataFetchedAt,
    savedAt: dto.savedAt,
    createdAt: dto.createdAt,
    updatedAt: pendingReset ? now : dto.updatedAt,
  } as const;

  return {
    article:
      dto.status === "read"
        ? { ...fields, status: "read", readAt: dto.readAt as string }
        : { ...fields, status: "unread", readAt: null },
    pendingReset,
  };
}

function toTag(dto: TagDto): Tag {
  const normalized = normalizeTagName(dto.name);
  if (!normalized.ok) throw new Error("Validated backup contains an invalid tag name.");
  return { ...dto, name: normalized.name, normalizedName: normalized.normalizedName };
}

function uniqueId(preferred: string, occupied: Set<string>, idGenerator: IdGenerator): string {
  if (!occupied.has(preferred)) {
    occupied.add(preferred);
    return preferred;
  }

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = idGenerator();
    if (!occupied.has(candidate)) {
      occupied.add(candidate);
      return candidate;
    }
  }
  throw new Error("Could not allocate a unique backup import ID.");
}

function sourceSummary(backup: BackupImportSnapshot): BackupImportSummary["source"] {
  return {
    schemaVersion: backup.schemaVersion,
    exportedAt: backup.exportedAt,
    articles: backup.articles.length,
    articleUrls: backup.articleUrls.length,
    tags: backup.schemaVersion === 2 ? backup.tags.length : 0,
    articleTags: backup.schemaVersion === 2 ? backup.articleTags.length : 0,
  };
}

export function buildBackupImportPlan(
  current: ArticleExportSnapshot,
  backup: BackupImportSnapshot,
  now: string,
  idGenerator: IdGenerator,
): BackupImportPlan {
  const changes: BackupImportSummary["changes"] = {
    articlesCreated: 0,
    articlesMatched: 0,
    articleIdsRemapped: 0,
    articleUrlsCreated: 0,
    articleUrlsMatched: 0,
    articleUrlsSkipped: 0,
    tagsCreated: 0,
    tagsMatched: 0,
    tagsSkipped: 0,
    tagIdsRemapped: 0,
    tagColorsReassigned: 0,
    articleTagsCreated: 0,
    articleTagsMatched: 0,
    articleTagsSkipped: 0,
    pendingArticlesReset: 0,
  };
  const newArticles: Article[] = [];
  const newAliases: ArticleUrlAlias[] = [];
  const newTags: Tag[] = [];
  const newAssignments: BackupArticleTagInsert[] = [];
  const articleIdMap = new Map<string, string>();
  const tagIdMap = new Map<string, string | null>();

  const existingAliasByUrl = new Map(
    current.articleUrls.map((alias) => [alias.normalizedUrl, alias] as const),
  );
  const originalAliasBySourceArticle = new Map(
    backup.articleUrls
      .filter(({ kind }) => kind === "original")
      .map((alias) => [alias.articleId, alias] as const),
  );
  const aliasUrlsBySourceArticle = new Map<string, Set<string>>();
  for (const alias of backup.articleUrls) {
    const urls = aliasUrlsBySourceArticle.get(alias.articleId) ?? new Set<string>();
    urls.add(alias.normalizedUrl);
    aliasUrlsBySourceArticle.set(alias.articleId, urls);
  }
  const occupiedArticleIds = new Set(current.articles.map(({ id }) => id));

  for (const sourceArticle of [...backup.articles].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const originalAlias = originalAliasBySourceArticle.get(sourceArticle.id);
    if (originalAlias === undefined) {
      throw new Error("Validated backup article is missing its original URL alias.");
    }
    const existingAlias = existingAliasByUrl.get(originalAlias.normalizedUrl as NormalizedUrl);
    if (existingAlias !== undefined) {
      articleIdMap.set(sourceArticle.id, existingAlias.articleId);
      changes.articlesMatched += 1;
      continue;
    }

    const targetId = uniqueId(sourceArticle.id, occupiedArticleIds, idGenerator);
    if (targetId !== sourceArticle.id) changes.articleIdsRemapped += 1;
    const canonicalUrl =
      sourceArticle.canonicalUrl === null ? null : normalizeUrl(sourceArticle.canonicalUrl);
    const canonicalAlias =
      canonicalUrl === null ||
      !canonicalUrl.ok ||
      !aliasUrlsBySourceArticle.get(sourceArticle.id)?.has(canonicalUrl.value)
        ? undefined
        : existingAliasByUrl.get(canonicalUrl.value);
    const converted = toArticle(
      {
        ...sourceArticle,
        id: targetId,
        canonicalUrl: canonicalAlias === undefined ? sourceArticle.canonicalUrl : null,
      },
      now,
    );
    newArticles.push(converted.article);
    articleIdMap.set(sourceArticle.id, targetId);
    changes.articlesCreated += 1;
    if (converted.pendingReset) changes.pendingArticlesReset += 1;
  }

  for (const sourceAlias of [...backup.articleUrls].sort((left, right) =>
    left.normalizedUrl.localeCompare(right.normalizedUrl),
  )) {
    const targetArticleId = articleIdMap.get(sourceAlias.articleId);
    if (targetArticleId === undefined) {
      throw new Error("Validated backup URL alias references a missing article.");
    }
    const normalizedUrl = sourceAlias.normalizedUrl as NormalizedUrl;
    const existingAlias = existingAliasByUrl.get(normalizedUrl);
    if (existingAlias !== undefined) {
      if (existingAlias.articleId === targetArticleId) changes.articleUrlsMatched += 1;
      else changes.articleUrlsSkipped += 1;
      continue;
    }
    newAliases.push({ ...sourceAlias, normalizedUrl, articleId: targetArticleId });
    changes.articleUrlsCreated += 1;
  }

  const occupiedTagIds = new Set(current.tags.map(({ id }) => id));
  const tagByNormalizedName = new Map(
    current.tags.map((tag) => [tag.normalizedName, tag] as const),
  );
  const usedHues = new Set(current.tags.map(({ colorHue }) => colorHue));
  const sourceTags = backup.schemaVersion === 2 ? backup.tags : [];
  for (const sourceTag of [...sourceTags].sort((left, right) => left.id.localeCompare(right.id))) {
    const converted = toTag(sourceTag);
    const existingTag = tagByNormalizedName.get(converted.normalizedName);
    if (existingTag !== undefined) {
      tagIdMap.set(sourceTag.id, existingTag.id);
      changes.tagsMatched += 1;
      continue;
    }
    if (current.tags.length + newTags.length >= MAX_TAGS) {
      tagIdMap.set(sourceTag.id, null);
      changes.tagsSkipped += 1;
      continue;
    }

    const targetId = uniqueId(sourceTag.id, occupiedTagIds, idGenerator);
    if (targetId !== sourceTag.id) changes.tagIdsRemapped += 1;
    let colorHue = converted.colorHue;
    if (usedHues.has(colorHue)) {
      const allocated = allocateTagColorHue([...usedHues]);
      if (allocated === null) {
        tagIdMap.set(sourceTag.id, null);
        changes.tagsSkipped += 1;
        continue;
      }
      colorHue = allocated;
      changes.tagColorsReassigned += 1;
    }
    usedHues.add(colorHue);
    const tag = { ...converted, id: targetId, colorHue };
    newTags.push(tag);
    tagByNormalizedName.set(tag.normalizedName, tag);
    tagIdMap.set(sourceTag.id, targetId);
    changes.tagsCreated += 1;
  }

  const assignmentKeys = new Set(
    current.articleTags.map(({ articleId, tagId }) => `${articleId}\u0000${tagId}`),
  );
  const assignmentCountByArticle = new Map<string, number>();
  for (const assignment of current.articleTags) {
    assignmentCountByArticle.set(
      assignment.articleId,
      (assignmentCountByArticle.get(assignment.articleId) ?? 0) + 1,
    );
  }
  const sourceAssignments = backup.schemaVersion === 2 ? backup.articleTags : [];
  for (const sourceAssignment of [...sourceAssignments].sort((left, right) =>
    `${left.articleId}\u0000${left.tagId}`.localeCompare(`${right.articleId}\u0000${right.tagId}`),
  )) {
    const articleId = articleIdMap.get(sourceAssignment.articleId);
    const tagId = tagIdMap.get(sourceAssignment.tagId);
    if (articleId === undefined || tagId === undefined || tagId === null) {
      changes.articleTagsSkipped += 1;
      continue;
    }
    const key = `${articleId}\u0000${tagId}`;
    if (assignmentKeys.has(key)) {
      changes.articleTagsMatched += 1;
      continue;
    }
    const assignmentCount = assignmentCountByArticle.get(articleId) ?? 0;
    if (assignmentCount >= MAX_TAGS_PER_ARTICLE) {
      changes.articleTagsSkipped += 1;
      continue;
    }
    newAssignments.push({ articleId, tagId, createdAt: now });
    assignmentKeys.add(key);
    assignmentCountByArticle.set(articleId, assignmentCount + 1);
    changes.articleTagsCreated += 1;
  }

  const hasChanges =
    changes.articlesCreated > 0 ||
    changes.articleUrlsCreated > 0 ||
    changes.tagsCreated > 0 ||
    changes.articleTagsCreated > 0;

  return {
    articles: newArticles,
    articleUrls: newAliases,
    tags: newTags,
    articleTags: newAssignments,
    summary: { source: sourceSummary(backup), changes, hasChanges },
  };
}
