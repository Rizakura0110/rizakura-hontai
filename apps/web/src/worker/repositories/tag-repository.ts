import type { Tag } from "@tech-inbox/core/tag";

export type CreateTagInput = Tag;

export type CreateTagResult =
  | { readonly outcome: "created"; readonly tag: Tag }
  | { readonly outcome: "nameConflict"; readonly tag: Tag }
  | { readonly outcome: "colorConflict" };

export type UpdateTagNameInput = {
  readonly id: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly updatedAt: string;
};

export type UpdateTagNameResult =
  | { readonly outcome: "updated"; readonly tag: Tag }
  | { readonly outcome: "notFound" }
  | { readonly outcome: "nameConflict"; readonly tag: Tag };

export type DeleteTagResult = { readonly outcome: "deleted" } | { readonly outcome: "notFound" };

export type ArticleTagsResult =
  | { readonly outcome: "found"; readonly tags: readonly Tag[] }
  | { readonly outcome: "articleNotFound" };

export type ReplaceArticleTagsInput = {
  readonly articleId: string;
  readonly tagIds: readonly string[];
  readonly createdAt: string;
};

export type ReplaceArticleTagsResult =
  | { readonly outcome: "updated"; readonly tags: readonly Tag[] }
  | { readonly outcome: "articleNotFound" }
  | { readonly outcome: "tagNotFound" };

export interface TagRepository {
  list(): Promise<readonly Tag[]>;
  findById(id: string): Promise<Tag | null>;
  findByNormalizedName(normalizedName: string): Promise<Tag | null>;
  create(input: CreateTagInput): Promise<CreateTagResult>;
  updateName(input: UpdateTagNameInput): Promise<UpdateTagNameResult>;
  deleteById(id: string): Promise<DeleteTagResult>;
  listForArticle(articleId: string): Promise<ArticleTagsResult>;
  replaceArticleTags(input: ReplaceArticleTagsInput): Promise<ReplaceArticleTagsResult>;
}
