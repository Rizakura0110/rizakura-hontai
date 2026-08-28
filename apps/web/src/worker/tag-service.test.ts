import type { Tag } from "@tech-inbox/core/tag";
import { MAX_TAGS } from "@tech-inbox/core/tag";
import { describe, expect, it, vi } from "vitest";
import type {
  CreateTagInput,
  TagRepository,
  UpdateTagNameInput,
} from "./repositories/tag-repository";
import { TagService } from "./tag-service";

const now = "2026-08-28T00:00:00.000Z";
const existingTag: Tag = {
  id: "tag-1",
  name: "React",
  normalizedName: "react",
  colorHue: 220,
  createdAt: now,
  updatedAt: now,
};

function repository(overrides: Partial<TagRepository> = {}): TagRepository {
  return {
    list: async () => [],
    findById: async () => existingTag,
    findByNormalizedName: async () => null,
    create: async (input) => ({ outcome: "created", tag: input }),
    updateName: async (input) => ({ outcome: "updated", tag: { ...existingTag, ...input } }),
    deleteById: async () => ({ outcome: "deleted" }),
    listForArticle: async () => ({ outcome: "found", tags: [existingTag] }),
    replaceArticleTags: async () => ({ outcome: "updated", tags: [existingTag] }),
    ...overrides,
  };
}

function service(tagRepository: TagRepository) {
  return new TagService(
    tagRepository,
    () => new Date(now),
    () => "tag-new",
  );
}

describe("TagService", () => {
  it("normalizes a new tag and assigns the first unused hue", async () => {
    let received: CreateTagInput | undefined;
    const tagService = service(
      repository({
        create: async (input) => {
          received = input;
          return { outcome: "created", tag: input };
        },
      }),
    );

    await expect(tagService.create({ name: "  Ｒｅａｃｔ  " })).resolves.toMatchObject({
      result: "created",
      tag: { id: "tag-new", name: "React", colorHue: 220 },
    });
    expect(received).toEqual({
      id: "tag-new",
      name: "React",
      normalizedName: "react",
      colorHue: 220,
      createdAt: now,
      updatedAt: now,
    });
  });

  it("returns the existing tag for a normalized-name duplicate", async () => {
    const create = vi.fn<TagRepository["create"]>();
    const tagService = service(
      repository({
        findByNormalizedName: async () => existingTag,
        create,
      }),
    );

    await expect(tagService.create({ name: "ＲＥＡＣＴ" })).resolves.toEqual({
      result: "alreadyExists",
      tag: {
        id: existingTag.id,
        name: existingTag.name,
        colorHue: existingTag.colorHue,
        createdAt: existingTag.createdAt,
        updatedAt: existingTag.updatedAt,
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("reallocates a hue after a concurrent color conflict", async () => {
    let listCalls = 0;
    let createCalls = 0;
    const tagService = service(
      repository({
        list: async () => {
          listCalls += 1;
          return listCalls === 1 ? [] : [existingTag];
        },
        create: async (input) => {
          createCalls += 1;
          return createCalls === 1
            ? { outcome: "colorConflict" }
            : { outcome: "created", tag: input };
        },
      }),
    );

    await expect(tagService.create({ name: "Cloudflare" })).resolves.toMatchObject({
      result: "created",
      tag: { colorHue: 40 },
    });
  });

  it("rejects creation after the tag limit", async () => {
    const tags = Array.from(
      { length: MAX_TAGS },
      (_, index): Tag => ({
        ...existingTag,
        id: `tag-${index}`,
        normalizedName: `tag-${index}`,
        name: `Tag ${index}`,
        colorHue: index,
      }),
    );
    const tagService = service(repository({ list: async () => tags }));

    await expect(tagService.create({ name: "Overflow" })).rejects.toMatchObject({
      status: 409,
      code: "TAG_CONFLICT",
    });
  });

  it("renames without changing the assigned color", async () => {
    let received: UpdateTagNameInput | undefined;
    const tagService = service(
      repository({
        updateName: async (input) => {
          received = input;
          return { outcome: "updated", tag: { ...existingTag, ...input } };
        },
      }),
    );

    await expect(tagService.update(existingTag.id, { name: "  TypeScript  " })).resolves.toEqual({
      tag: {
        id: existingTag.id,
        name: "TypeScript",
        colorHue: existingTag.colorHue,
        createdAt: existingTag.createdAt,
        updatedAt: now,
      },
    });
    expect(received).toEqual({
      id: existingTag.id,
      name: "TypeScript",
      normalizedName: "typescript",
      updatedAt: now,
    });
  });

  it("maps missing articles and tags to safe public errors", async () => {
    const missingArticleService = service(
      repository({
        listForArticle: async () => ({ outcome: "articleNotFound" }),
        replaceArticleTags: async () => ({ outcome: "articleNotFound" }),
      }),
    );
    await expect(missingArticleService.listForArticle("missing")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    await expect(
      missingArticleService.replaceArticleTags("missing", { tagIds: [] }),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });

    const missingTagService = service(
      repository({ replaceArticleTags: async () => ({ outcome: "tagNotFound" }) }),
    );
    await expect(
      missingTagService.replaceArticleTags("article-1", { tagIds: ["missing"] }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
  });
});
