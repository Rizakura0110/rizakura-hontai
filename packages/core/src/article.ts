import type { MetadataErrorCode, MetadataStatus } from "./metadata";
import type { NormalizedUrl } from "./url-normalization";

export const ARTICLE_STATUSES = ["unread", "read"] as const;

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const ARTICLE_LIST_STATUSES = ["all", ...ARTICLE_STATUSES] as const;

export type ArticleListStatus = (typeof ARTICLE_LIST_STATUSES)[number];

export const ARTICLE_SORTS = ["saved_desc", "saved_asc", "read_desc"] as const;

export type ArticleSort = (typeof ARTICLE_SORTS)[number];

export const ARTICLE_URL_KINDS = ["original", "canonical"] as const;

export type ArticleUrlKind = (typeof ARTICLE_URL_KINDS)[number];

export type ArticleReadState =
  | {
      readonly status: "unread";
      readonly readAt: null;
    }
  | {
      readonly status: "read";
      readonly readAt: string;
    };

type ArticleFields = {
  readonly id: string;
  readonly originalUrl: string;
  readonly canonicalUrl: string | null;
  readonly title: string | null;
  readonly titleIsManual: boolean;
  readonly siteName: string | null;
  readonly description: string | null;
  readonly faviconUrl: string | null;
  readonly imageUrl: string | null;
  readonly publishedAt: string | null;
  readonly metadataStatus: MetadataStatus;
  readonly metadataErrorCode: MetadataErrorCode | null;
  readonly metadataAttemptCount: number;
  readonly metadataFetchedAt: string | null;
  readonly savedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type Article = ArticleFields & ArticleReadState;

export type ArticleUrlAlias = {
  readonly normalizedUrl: NormalizedUrl;
  readonly articleId: string;
  readonly kind: ArticleUrlKind;
  readonly createdAt: string;
};

export type ArticleListCriteria = {
  readonly status: ArticleListStatus;
  readonly search: string | null;
  readonly site: string | null;
  readonly sort: ArticleSort;
  readonly limit: number;
  readonly cursor: string | null;
};

export type ArticlePage = {
  readonly items: readonly Article[];
  readonly nextCursor: string | null;
};

export type CreateArticleInput = {
  readonly id: string;
  readonly originalUrl: string;
  readonly normalizedUrl: NormalizedUrl;
  readonly savedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ArticleUrlChange = {
  readonly originalUrl: string;
  readonly normalizedUrl: NormalizedUrl;
};

export type ArticleChanges = {
  readonly urlChange?: ArticleUrlChange;
  readonly canonicalUrl?: string | null;
  readonly title?: string | null;
  readonly titleIsManual?: boolean;
  readonly siteName?: string | null;
  readonly description?: string | null;
  readonly faviconUrl?: string | null;
  readonly imageUrl?: string | null;
  readonly publishedAt?: string | null;
  readonly readState?: ArticleReadState;
  readonly metadataStatus?: MetadataStatus;
  readonly metadataErrorCode?: MetadataErrorCode | null;
  readonly metadataAttemptCount?: number;
  readonly metadataFetchedAt?: string | null;
  readonly savedAt?: string;
  readonly updatedAt: string;
};

export type UpdateArticleInput = {
  readonly id: string;
  readonly changes: ArticleChanges;
};
