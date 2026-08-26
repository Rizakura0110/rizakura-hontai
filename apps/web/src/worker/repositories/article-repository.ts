import type {
  Article,
  ArticleListCriteria,
  ArticlePage,
  CreateArticleInput,
  UpdateArticleInput,
} from "@tech-inbox/core/article";
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

export interface ArticleRepository {
  list(criteria: ArticleListCriteria): Promise<ArticlePage>;
  findById(id: string): Promise<Article | null>;
  findByNormalizedUrl(normalizedUrl: NormalizedUrl): Promise<Article | null>;
  createWithOriginalAlias(input: CreateArticleInput): Promise<CreateArticleResult>;
  update(input: UpdateArticleInput): Promise<UpdateArticleResult>;
  deleteById(id: string): Promise<DeleteArticleResult>;
}
