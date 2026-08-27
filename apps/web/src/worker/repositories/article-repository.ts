import type {
  Article,
  ArticleListCriteria,
  ArticlePage,
  ArticleUrlAlias,
  CreateArticleInput,
  UpdateArticleInput,
} from "@tech-inbox/core/article";
import type { ArticleMetadata, MetadataErrorCode } from "@tech-inbox/core/metadata";
import type { NormalizedUrl } from "@tech-inbox/core/url-normalization";

export type CreateArticleResult =
  | {
      readonly outcome: "created";
      readonly article: Article;
    }
  | {
      readonly outcome: "alreadyExists";
      readonly article: Article;
    };

export type UpdateArticleResult =
  | {
      readonly outcome: "updated";
      readonly article: Article;
    }
  | {
      readonly outcome: "notFound";
    }
  | {
      readonly outcome: "urlConflict";
    };

export type DeleteArticleResult =
  | {
      readonly outcome: "deleted";
    }
  | {
      readonly outcome: "notFound";
    };

export type ArticleExportSnapshot = {
  readonly articles: readonly Article[];
  readonly articleUrls: readonly ArticleUrlAlias[];
};

export type CanonicalAliasInput = {
  readonly normalizedUrl: NormalizedUrl;
  readonly createdAt: string;
};

export type ApplyMetadataInput = {
  readonly id: string;
  readonly expectedUrl: string;
  readonly metadata: ArticleMetadata;
  readonly canonicalAlias: CanonicalAliasInput | null;
  readonly attemptCount: number;
  readonly fetchedAt: string;
  readonly updatedAt: string;
};

export type ApplyMetadataResult =
  | { readonly outcome: "updated"; readonly article: Article }
  | { readonly outcome: "merged"; readonly article: Article; readonly removedArticleId: string }
  | { readonly outcome: "stale" };

export type RecordMetadataFailureInput = {
  readonly id: string;
  readonly expectedUrl: string;
  readonly status: "pending" | "failed";
  readonly errorCode: MetadataErrorCode;
  readonly attemptCount: number;
  readonly fetchedAt: string;
  readonly updatedAt: string;
};

export type RecordMetadataFailureResult =
  | { readonly outcome: "updated"; readonly article: Article }
  | { readonly outcome: "stale" };

export interface ArticleRepository {
  list(criteria: ArticleListCriteria): Promise<ArticlePage>;
  exportAll(): Promise<ArticleExportSnapshot>;
  findById(id: string): Promise<Article | null>;
  findByNormalizedUrl(normalizedUrl: NormalizedUrl): Promise<Article | null>;
  createWithOriginalAlias(input: CreateArticleInput): Promise<CreateArticleResult>;
  update(input: UpdateArticleInput): Promise<UpdateArticleResult>;
  applyMetadata(input: ApplyMetadataInput): Promise<ApplyMetadataResult>;
  recordMetadataFailure(input: RecordMetadataFailureInput): Promise<RecordMetadataFailureResult>;
  deleteById(id: string): Promise<DeleteArticleResult>;
}
