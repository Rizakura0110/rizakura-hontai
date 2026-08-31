import type { FetchedMetadata, MetadataQueueMessage } from "@rizakura-me/contracts";
import type { Article } from "@tech-inbox/core/article";
import { describe, expect, it, vi } from "vitest";
import {
  consumeMetadataQueue,
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
    list: async () => ({ items: [], availableTags: [], tagsByArticleId: {}, nextCursor: null }),
    exportAll: async () => ({ articles: [], articleUrls: [], tags: [], articleTags: [] }),
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

  it("reports tag assignments omitted by a canonical duplicate merge", async () => {
    let state: Article | null = article();
    const baseRepository = repository(
      () => state,
      (value) => (state = value),
    );
    const mergedArticle = article({
      id: "article-keeper",
      metadataStatus: "ready",
      metadataAttemptCount: 1,
    });
    const dependencies: MetadataConsumerDependencies = {
      repositoryFactory: () => ({
        ...baseRepository,
        applyMetadata: async () => ({
          outcome: "merged",
          article: mergedArticle,
          removedArticleId: "article-1",
          droppedTagCount: 2,
        }),
      }),
      fetchMetadata: async () => ({ ok: true, metadata: fetchedMetadata }),
      clock: () => new Date("2026-08-27T01:00:00.000Z"),
      log: () => undefined,
    };

    await expect(
      processMetadataQueueMessage(
        { articleId: "article-1", url: "https://example.com/article", attempt: 0 },
        bindings(),
        dependencies,
      ),
    ).resolves.toMatchObject({
      action: "ack",
      log: { result: "ready", attempt: 1, droppedTagCount: 2 },
    });
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

  it("acks malformed and missing-article messages without fetching metadata", async () => {
    const repositoryFactory = vi.fn(() => {
      throw new Error("must not create repository for malformed messages");
    });
    const fetchMetadata = vi.fn(async () => ({ ok: true, metadata: fetchedMetadata }) as const);
    await expect(
      processMetadataQueueMessage({ invalid: true }, bindings(), {
        repositoryFactory,
        fetchMetadata,
        clock: () => new Date("2026-08-27T01:00:00.000Z"),
        log: () => undefined,
      }),
    ).resolves.toMatchObject({ action: "ack", log: { result: "invalid" } });
    expect(repositoryFactory).not.toHaveBeenCalled();

    const missingRepository = repository(
      () => null,
      () => undefined,
    );
    await expect(
      processMetadataQueueMessage(
        { articleId: "article-1", url: "https://example.com/article", attempt: 0 },
        bindings(),
        {
          repositoryFactory: () => missingRepository,
          fetchMetadata,
          clock: () => new Date("2026-08-27T01:00:00.000Z"),
          log: () => undefined,
        },
      ),
    ).resolves.toMatchObject({ action: "ack", log: { result: "stale" } });
    expect(fetchMetadata).not.toHaveBeenCalled();
  });

  it("records a permanent failure without rescheduling", async () => {
    let state: Article | null = article();
    const dependencies: MetadataConsumerDependencies = {
      repositoryFactory: () =>
        repository(
          () => state,
          (value) => (state = value),
        ),
      fetchMetadata: async () => ({ ok: false, error: { code: "UNSAFE_URL" } }),
      clock: () => new Date("2026-08-27T01:00:00.000Z"),
      log: () => undefined,
    };

    await expect(
      processMetadataQueueMessage(
        { articleId: "article-1", url: "https://example.com/article", attempt: 0 },
        bindings(),
        dependencies,
      ),
    ).resolves.toMatchObject({
      action: "ack",
      log: { result: "failed", attempt: 1, errorCode: "UNSAFE_URL" },
    });
    expect(state).toMatchObject({ metadataStatus: "failed", metadataAttemptCount: 1 });
  });

  it("reschedules a temporary failure and falls back to native retry if queue send fails", async () => {
    for (const queueFails of [false, true]) {
      let state: Article | null = article();
      const queueSend = queueFails
        ? vi.fn(async () => {
            throw new Error("queue unavailable");
          })
        : vi.fn(async () => undefined);
      const dependencies: MetadataConsumerDependencies = {
        repositoryFactory: () =>
          repository(
            () => state,
            (value) => (state = value),
          ),
        fetchMetadata: async () => ({ ok: false, error: { code: "NETWORK_ERROR" } }),
        clock: () => new Date("2026-08-27T01:00:00.000Z"),
        log: () => undefined,
      };

      await expect(
        processMetadataQueueMessage(
          { articleId: "article-1", url: "https://example.com/article", attempt: 0 },
          bindings(queueSend),
          dependencies,
        ),
      ).resolves.toMatchObject({
        action: queueFails ? "retry" : "ack",
        log: { result: queueFails ? "retry" : "rescheduled", attempt: 1 },
      });
      expect(queueSend).toHaveBeenCalledWith(
        { articleId: "article-1", url: "https://example.com/article", attempt: 1 },
        { contentType: "json", delaySeconds: 5 },
      );
    }
  });

  it("drives queue ack and retry controls even when processing or logging fails", async () => {
    const ack = vi.fn();
    const retry = vi.fn();
    const invalidMessage = { body: { invalid: true }, ack, retry };
    const failingMessage = {
      body: { articleId: "article-1", url: "https://example.com/article", attempt: 0 },
      ack,
      retry,
    };
    const log = vi.fn(() => {
      throw new Error("logging unavailable");
    });

    await consumeMetadataQueue(
      { messages: [invalidMessage, failingMessage] } as unknown as MessageBatch<unknown>,
      bindings(),
      {
        repositoryFactory: () => {
          throw new Error("database unavailable");
        },
        fetchMetadata: async () => ({ ok: true, metadata: fetchedMetadata }),
        clock: () => new Date("2026-08-27T01:00:00.000Z"),
        log,
      },
    );

    expect(ack).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledWith({ delaySeconds: 5 });
    expect(log).toHaveBeenCalledTimes(2);
  });
});
