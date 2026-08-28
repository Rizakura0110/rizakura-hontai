import type {
  ArticleTagsResponse,
  CreateTagRequest,
  CreateTagResponse,
  ListTagsResponse,
  ReplaceArticleTagsRequest,
  TagResponse,
  UpdateTagRequest,
} from "@tech-inbox/contracts";
import { allocateTagColorHue, MAX_TAGS, normalizeTagName } from "@tech-inbox/core/tag";
import { ApiError, validationError } from "./errors";
import type { Clock, IdGenerator } from "./article-service";
import type { TagRepository } from "./repositories/tag-repository";
import { toTagDto } from "./tag-dto";

const MAX_COLOR_ALLOCATION_ATTEMPTS = 3;

export class TagService {
  readonly #repository: TagRepository;
  readonly #clock: Clock;
  readonly #idGenerator: IdGenerator;

  constructor(repository: TagRepository, clock: Clock, idGenerator: IdGenerator) {
    this.#repository = repository;
    this.#clock = clock;
    this.#idGenerator = idGenerator;
  }

  async list(): Promise<ListTagsResponse> {
    return { tags: (await this.#repository.list()).map(toTagDto) };
  }

  async create(request: CreateTagRequest): Promise<CreateTagResponse> {
    const normalized = normalizeTagName(request.name);
    if (!normalized.ok) throw validationError("タグ名が無効です。");

    const existing = await this.#repository.findByNormalizedName(normalized.normalizedName);
    if (existing !== null) return { result: "alreadyExists", tag: toTagDto(existing) };

    const id = this.#idGenerator();
    const now = this.#clock().toISOString();
    for (let attempt = 0; attempt < MAX_COLOR_ALLOCATION_ATTEMPTS; attempt += 1) {
      const currentTags = await this.#repository.list();
      if (currentTags.length >= MAX_TAGS) {
        throw new ApiError(409, "TAG_CONFLICT", "タグ数の上限に達しています。");
      }
      const colorHue = allocateTagColorHue(currentTags.map((tag) => tag.colorHue));
      if (colorHue === null) {
        throw new ApiError(409, "TAG_CONFLICT", "タグ色を割り当てられませんでした。");
      }

      const result = await this.#repository.create({
        id,
        name: normalized.name,
        normalizedName: normalized.normalizedName,
        colorHue,
        createdAt: now,
        updatedAt: now,
      });
      if (result.outcome === "created") return { result: "created", tag: toTagDto(result.tag) };
      if (result.outcome === "nameConflict") {
        return { result: "alreadyExists", tag: toTagDto(result.tag) };
      }
    }

    throw new ApiError(409, "TAG_CONFLICT", "タグ色の割り当てが競合しました。");
  }

  async update(id: string, request: UpdateTagRequest): Promise<TagResponse> {
    const normalized = normalizeTagName(request.name);
    if (!normalized.ok) throw validationError("タグ名が無効です。");

    const result = await this.#repository.updateName({
      id,
      name: normalized.name,
      normalizedName: normalized.normalizedName,
      updatedAt: this.#clock().toISOString(),
    });
    if (result.outcome === "notFound") {
      throw new ApiError(404, "NOT_FOUND", "タグが見つかりません。");
    }
    if (result.outcome === "nameConflict") {
      throw new ApiError(409, "TAG_CONFLICT", "同じ名前のタグが既に存在します。");
    }
    return { tag: toTagDto(result.tag) };
  }

  async delete(id: string): Promise<void> {
    const result = await this.#repository.deleteById(id);
    if (result.outcome === "notFound") {
      throw new ApiError(404, "NOT_FOUND", "タグが見つかりません。");
    }
  }

  async listForArticle(articleId: string): Promise<ArticleTagsResponse> {
    const result = await this.#repository.listForArticle(articleId);
    if (result.outcome === "articleNotFound") {
      throw new ApiError(404, "NOT_FOUND", "記事が見つかりません。");
    }
    return { tags: result.tags.map(toTagDto) };
  }

  async replaceArticleTags(
    articleId: string,
    request: ReplaceArticleTagsRequest,
  ): Promise<ArticleTagsResponse> {
    const result = await this.#repository.replaceArticleTags({
      articleId,
      tagIds: request.tagIds,
      createdAt: this.#clock().toISOString(),
    });
    if (result.outcome === "articleNotFound") {
      throw new ApiError(404, "NOT_FOUND", "記事が見つかりません。");
    }
    if (result.outcome === "tagNotFound") {
      throw validationError("存在しないタグが指定されています。");
    }
    return { tags: result.tags.map(toTagDto) };
  }
}
