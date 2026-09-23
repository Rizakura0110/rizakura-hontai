import { describe, expect, it, vi } from "vitest";
import { articleDtoFixture } from "../../test/contracts/fixtures";
import type { BackupImportRequest } from "../contracts";
import { BackupService } from "./backup-service";
import type { BackupRepository } from "./repositories/backup-repository";

const now = "2026-09-23T00:00:00.000Z";

function request(): BackupImportRequest {
  const article = articleDtoFixture({ metadataStatus: "pending", metadataFetchedAt: null });
  return {
    backup: {
      schemaVersion: 2,
      exportedAt: now,
      articles: [article],
      articleUrls: [
        {
          normalizedUrl: article.originalUrl,
          articleId: article.id,
          kind: "original",
          createdAt: article.createdAt,
        },
      ],
      tags: [],
      articleTags: [],
    },
  };
}

function repository() {
  const loadSnapshot = vi.fn<BackupRepository["loadSnapshot"]>(async () => ({
    articles: [],
    articleUrls: [],
    tags: [],
    articleTags: [],
  }));
  const apply = vi.fn<BackupRepository["apply"]>(async () => undefined);
  return { loadSnapshot, apply };
}

describe("BackupService", () => {
  it("previews the import without writing through its repository port", async () => {
    const storage = repository();
    const service = new BackupService(
      storage,
      () => new Date(now),
      () => "unused",
    );

    await expect(service.preview(request())).resolves.toMatchObject({
      result: "preview",
      summary: {
        hasChanges: true,
        changes: { articlesCreated: 1, articleUrlsCreated: 1, pendingArticlesReset: 1 },
      },
    });
    expect(storage.loadSnapshot).toHaveBeenCalledOnce();
    expect(storage.apply).not.toHaveBeenCalled();
  });

  it("reloads and applies the plan with the injected clock before reporting success", async () => {
    const storage = repository();
    const service = new BackupService(
      storage,
      () => new Date(now),
      () => "unused",
    );

    await expect(service.apply(request())).resolves.toMatchObject({
      result: "imported",
      summary: { hasChanges: true, changes: { articlesCreated: 1 } },
    });
    expect(storage.loadSnapshot).toHaveBeenCalledOnce();
    expect(storage.apply).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        articles: [
          expect.objectContaining({
            id: "article-1",
            metadataStatus: "failed",
            metadataErrorCode: "NETWORK_ERROR",
            metadataFetchedAt: now,
            updatedAt: now,
          }),
        ],
      }),
    );
  });

  it("does not report imported when its storage port rejects the plan", async () => {
    const storage = repository();
    storage.apply.mockRejectedValueOnce(new Error("storage unavailable"));
    const service = new BackupService(
      storage,
      () => new Date(now),
      () => "unused",
    );

    await expect(service.apply(request())).rejects.toThrow("storage unavailable");
  });
});
