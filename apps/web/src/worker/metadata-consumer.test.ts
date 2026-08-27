import type { FetchedMetadata, MetadataQueueMessage } from "@tech-inbox/contracts";
import type { Article } from "@tech-inbox/core/article";
import { describe, expect, it, vi } from "vitest";
import {
  type MetadataConsumerDependencies,
  processMetadataQueueMessage,
} from "./metadata-consumer";
import type { ArticleRepository } from "./repositories/article-repository";

const fetchedMetadata: FetchedMetadata = {
  title: "Fetched title",
  description: "Fetched description",
  siteName: "Example",
  canonicalUrl: "https://www.example.com/canonical",
  faviconUrl: "https://example.com/favicon.ico",
  imageUrl: "https://example.com/image.png",
  publishedAt: "2026-08-26T00:00:00.000Z",
};

function article(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    originalUrl: "https://example.com/article",
    canonicalUrl: null,
    title: "Manual title",
    titleIsManual: true,
    siteName: null,
    description: null,
    faviconUrl: null,
    imageUrl: null,
    publishedAt: null,
    status: "unread",
    metadataStatus: "pending",
    metadataErrorCode: null,
    metadataAttemptCount: 0,
    metadataFetchedAt: null,
    savedAt: "2026-08-27T00:00:00.000Z",
    readAt: null,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  } as Article;
}

function bindings(queueSend = vi.fn(async () => undefined)) {
  return {
    DB: {} as D1Database,
    METADATA_QUEUE: { send: queueSend } as unknown as Queue<MetadataQueueMessage>,
    METADATA_FETCHER: {} as Fetcher,
  };
}

function repository(
  getState: () => Article | null,
  setState: (value: Article) => void,
): ArticleRepository {
  return {
    list: async () => ({ items: [], nextCursor: null }),
    exportAll: async () => ({ articles: [], articleUrls: [] }),
    findById: async () => getState(),
    findByNormalizedUrl: async () => null,
    createWithOriginalAlias: async () => {
      throw new Error("not used");
    },
    update: async () => ({ outcome: "notFound" }),
    applyMetadata: async (input) => {
      const current = getState();
      if (current === null || current.originalUrl !== input.expectedUrl)
        return { outcome: "stale" };
      const updated: Article = {
        ...current,
        canonicalUrl: input.metadata.canonicalUrl,
        title: current.titleIsManual ? current.title : input.metadata.title,
        siteName: input.metadata.siteName,
        description: input.metadata.description,
        faviconUrl: input.metadata.faviconUrl,
        imageUrl: input.metadata.imageUrl,
        publishedAt: input.metadata.publishedAt,
        metadataStatus: "ready",
        metadataErrorCode: null,
        metadataAttemptCount: input.attemptCount,
        metadataFetchedAt: input.fetchedAt,
        updatedAt: input.updatedAt,
      };
      setState(updated);
      return { outcome: "updated", article: updated };
    },
    recordMetadataFailure: async (input) => {
      const current = getState();
      if (current === null || current.originalUrl !== input.expectedUrl)
        return { outcome: "stale" };
      const updated: Article = {
        ...current,
        metadataStatus: input.status,
        metadataErrorCode: input.errorCode,
        metadataAttemptCount: input.attemptCount,
        metadataFetchedAt: input.fetchedAt,
        updatedAt: input.updatedAt,
      };
      setState(updated);
      return { outcome: "updated", article: updated };
    },
    deleteById: async () => ({ outcome: "deleted" }),
  };
}

describe("processMetadataQueueMessage", () => {
  it("is idempotent for duplicate delivery and preserves a manual title", async () => {
    let state: Article | null = article();
    const fetchMetadata = vi.fn(async () => ({ ok: true, metadata: fetchedMetadata }) as const);
    const dependencies: MetadataConsumerDependencies = {
      repositoryFactory: () =>
        repository(
          () => state,
          (value) => (state = value),
        ),
      fetchMetadata,
      clock: () => new Date("2026-08-27T01:00:00.000Z"),
      log: () => undefined,
    };
    const message = { articleId: "article-1", url: state.originalUrl, attempt: 0 };

    await expect(
      processMetadataQueueMessage(message, bindings(), dependencies),
    ).resolves.toMatchObject({
      action: "ack",
      log: { result: "ready" },
    });
    await expect(
      processMetadataQueueMessage(message, bindings(), dependencies),
    ).resolves.toMatchObject({
      action: "ack",
      log: { result: "ready" },
    });

    expect(fetchMetadata).toHaveBeenCalledTimes(1);
    expect(state).toMatchObject({
      title: "Manual title",
      titleIsManual: true,
      metadataStatus: "ready",
    });
  });

  it("acks a message for an edited URL without contacting the fetcher", async () => {
    let state: Article | null = article({ originalUrl: "https://example.com/new" });
    const fetchMetadata = vi.fn(async () => ({ ok: true, metadata: fetchedMetadata }) as const);
    const dependencies: MetadataConsumerDependencies = {
      repositoryFactory: () =>
        repository(
          () => state,
          (value) => (state = value),
        ),
      fetchMetadata,
      clock: () => new Date("2026-08-27T01:00:00.000Z"),
      log: () => undefined,
    };

    await expect(
      processMetadataQueueMessage(
        { articleId: "article-1", url: "https://example.com/old", attempt: 0 },
        bindings(),
        dependencies,
      ),
    ).resolves.toMatchObject({ action: "ack", log: { result: "stale" } });
    expect(fetchMetadata).not.toHaveBeenCalled();
  });

  it("hands a capped temporary failure to native retries for DLQ delivery", async () => {
    let state: Article | null = article({ metadataAttemptCount: 2 });
    const fetchMetadata = vi.fn(
      async () => ({ ok: false, error: { code: "NETWORK_ERROR" } }) as const,
    );
    const dependencies: MetadataConsumerDependencies = {
      repositoryFactory: () =>
        repository(
          () => state,
          (value) => (state = value),
        ),
      fetchMetadata,
      clock: () => new Date("2026-08-27T01:00:00.000Z"),
      log: () => undefined,
    };
    const message = { articleId: "article-1", url: state.originalUrl, attempt: 2 };

    await expect(
      processMetadataQueueMessage(message, bindings(), dependencies),
    ).resolves.toMatchObject({
      action: "retry",
      log: { result: "retry", attempt: 3, errorCode: "NETWORK_ERROR" },
    });
    await expect(
      processMetadataQueueMessage(message, bindings(), dependencies),
    ).resolves.toMatchObject({
      action: "retry",
      log: { result: "retry", attempt: 3, errorCode: "NETWORK_ERROR" },
    });
    expect(fetchMetadata).toHaveBeenCalledTimes(1);
    expect(state).toMatchObject({ metadataStatus: "failed", metadataAttemptCount: 3 });
  });
});
