import { describe, expect, it, vi } from "vitest";
import type { FetchedMetadata } from "../contracts";
import type { Article } from "../core/article";
import type { ArticleRepository } from "../server/repositories/article-repository";
import { type MetadataConsumerDependencies, processMetadataQueueMessage } from "./consumer";

const now = "2026-08-27T01:00:00.000Z";
const message = { articleId: "article-1", url: "https://example.com/article", attempt: 0 };
const metadata: FetchedMetadata = {
  title: "Fetched title",
  canonicalUrl: "https://www.example.com/canonical?utm_source=feed",
  description: null,
  siteName: null,
  faviconUrl: null,
  imageUrl: null,
  publishedAt: null,
};

function article(overrides: Partial<Article> = {}): Article {
  return {
    ...metadata,
    id: message.articleId,
    originalUrl: message.url,
    title: "Manual title",
    titleIsManual: true,
    canonicalUrl: null,
    status: "unread",
    metadataStatus: "pending",
    metadataErrorCode: null,
    metadataAttemptCount: 0,
    metadataFetchedAt: null,
    savedAt: now,
    readAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Article;
}

function setup(current: Article | null = article()) {
  const findById = vi.fn(async () => current);
  const applyMetadata = vi
    .fn<ArticleRepository["applyMetadata"]>()
    .mockResolvedValue({ outcome: "updated", article: article({ metadataStatus: "ready" }) });
  const recordMetadataFailure = vi
    .fn<ArticleRepository["recordMetadataFailure"]>()
    .mockResolvedValue({ outcome: "updated", article: article({ metadataStatus: "failed" }) });
  const repository = {
    findById,
    applyMetadata,
    recordMetadataFailure,
  } as unknown as ArticleRepository;
  const repositoryFactory = vi.fn(() => repository);
  const fetchMetadata = vi
    .fn<MetadataConsumerDependencies["fetchMetadata"]>()
    .mockResolvedValue({ ok: true, metadata });
  const send = vi.fn(async () => undefined);
  const dependencies: MetadataConsumerDependencies = {
    repositoryFactory,
    fetchMetadata,
    queue: { send },
    clock: () => new Date(now),
  };
  return {
    dependencies,
    repositoryFactory,
    findById,
    applyMetadata,
    recordMetadataFailure,
    fetchMetadata,
    send,
  };
}

describe("metadata processing through product-owned ports", () => {
  it("rejects malformed payloads before opening the repository or using other ports", async () => {
    const ports = setup();
    await expect(
      processMetadataQueueMessage({ invalid: true }, ports.dependencies),
    ).resolves.toEqual({
      action: "ack",
      log: { route: "metadata.consume", result: "invalid" },
    });
    expect(ports.repositoryFactory).not.toHaveBeenCalled();
    expect(ports.fetchMetadata).not.toHaveBeenCalled();
    expect(ports.send).not.toHaveBeenCalled();
  });

  it.each([null, article({ originalUrl: "https://example.com/edited" })])(
    "ignores missing or edited articles before fetching",
    async (current) => {
      const ports = setup(current);
      await expect(processMetadataQueueMessage(message, ports.dependencies)).resolves.toMatchObject(
        {
          action: "ack",
          log: { result: "stale" },
        },
      );
      expect(ports.fetchMetadata).not.toHaveBeenCalled();
      expect(ports.applyMetadata).not.toHaveBeenCalled();
    },
  );

  it("passes fetched metadata and a same-host normalized alias into the atomic repository port", async () => {
    const ports = setup();
    await expect(processMetadataQueueMessage(message, ports.dependencies)).resolves.toMatchObject({
      action: "ack",
      log: { result: "ready", attempt: 1 },
    });
    expect(ports.fetchMetadata).toHaveBeenCalledWith(message.url);
    expect(ports.applyMetadata).toHaveBeenCalledWith({
      id: message.articleId,
      expectedUrl: message.url,
      metadata,
      canonicalAlias: { normalizedUrl: "https://www.example.com/canonical", createdAt: now },
      attemptCount: 1,
      fetchedAt: now,
      updatedAt: now,
    });
    expect(ports.send).not.toHaveBeenCalled();
  });

  it.each([null, "https://elsewhere.org/article", "not a URL", "ftp://example.com/file"])(
    "does not attach an unsafe or cross-host canonical alias: %s",
    async (canonicalUrl) => {
      const ports = setup();
      ports.fetchMetadata.mockResolvedValue({ ok: true, metadata: { ...metadata, canonicalUrl } });
      await processMetadataQueueMessage(message, ports.dependencies);
      expect(ports.applyMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ canonicalAlias: null }),
      );
    },
  );

  it.each(["updated", "stale", "merged"] as const)(
    "reconciles ready duplicate delivery without fetching, retaining timestamps and manual title (%s)",
    async (outcome) => {
      const current = article({
        metadataStatus: "ready",
        canonicalUrl: metadata.canonicalUrl,
        metadataAttemptCount: 2,
      });
      const ports = setup(current);
      ports.applyMetadata.mockResolvedValue(
        outcome === "stale"
          ? { outcome }
          : outcome === "merged"
            ? { outcome, article: current, removedArticleId: "duplicate", droppedTagCount: 2 }
            : { outcome, article: current },
      );
      const result = await processMetadataQueueMessage(message, ports.dependencies);
      expect(result).toMatchObject({
        action: "ack",
        log: { result: outcome === "stale" ? "stale" : "ready", attempt: 2 },
      });
      if (outcome === "merged") expect(result.log).toMatchObject({ droppedTagCount: 2 });
      expect(ports.fetchMetadata).not.toHaveBeenCalled();
      expect(ports.applyMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ title: "Manual title" }),
          fetchedAt: now,
          updatedAt: current.updatedAt,
        }),
      );
    },
  );

  it("acknowledges deletion during metadata fetch without leaking payloads in its log", async () => {
    const ports = setup();
    ports.applyMetadata.mockResolvedValue({ outcome: "stale" });
    const result = await processMetadataQueueMessage(message, ports.dependencies);
    expect(result).toEqual({
      action: "ack",
      log: { route: "metadata.consume", result: "stale", attempt: 1 },
    });
    expect(JSON.stringify(result.log)).not.toContain(message.url);
    expect(JSON.stringify(result.log)).not.toContain(metadata.title);
  });

  it("reports canonical merge tag loss without article IDs or URLs", async () => {
    const ports = setup();
    ports.applyMetadata.mockResolvedValue({
      outcome: "merged",
      article: article(),
      removedArticleId: "duplicate",
      droppedTagCount: 2,
    });
    await expect(processMetadataQueueMessage(message, ports.dependencies)).resolves.toEqual({
      action: "ack",
      log: { route: "metadata.consume", result: "ready", attempt: 1, droppedTagCount: 2 },
    });
  });

  it.each([false, true])(
    "reschedules retryable failure using the queue port (queue fails: %s)",
    async (queueFails) => {
      const ports = setup();
      ports.fetchMetadata.mockResolvedValue({ ok: false, error: { code: "NETWORK_ERROR" } });
      if (queueFails) ports.send.mockRejectedValue(new Error("private queue detail"));
      await expect(processMetadataQueueMessage(message, ports.dependencies)).resolves.toMatchObject(
        {
          action: queueFails ? "retry" : "ack",
          log: {
            result: queueFails ? "retry" : "rescheduled",
            attempt: 1,
            errorCode: "NETWORK_ERROR",
          },
        },
      );
      expect(ports.recordMetadataFailure).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending", attemptCount: 1 }),
      );
      expect(ports.send).toHaveBeenCalledWith({ ...message, attempt: 1 }, { delaySeconds: 5 });
    },
  );

  it("marks a capped retryable attempt failed and hands delivery to the native retry adapter", async () => {
    const ports = setup(article({ metadataAttemptCount: 2 }));
    ports.fetchMetadata.mockResolvedValue({ ok: false, error: { code: "NETWORK_ERROR" } });
    await expect(processMetadataQueueMessage(message, ports.dependencies)).resolves.toEqual({
      action: "retry",
      delaySeconds: 15,
      log: { route: "metadata.consume", result: "retry", attempt: 3, errorCode: "NETWORK_ERROR" },
    });
    expect(ports.recordMetadataFailure).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", attemptCount: 3 }),
    );
    expect(ports.send).not.toHaveBeenCalled();
  });

  it("does not refetch a temporary failure already at the attempt limit", async () => {
    const ports = setup(article({ metadataAttemptCount: 3, metadataErrorCode: "NETWORK_ERROR" }));
    await expect(processMetadataQueueMessage(message, ports.dependencies)).resolves.toMatchObject({
      action: "retry",
      delaySeconds: 15,
    });
    expect(ports.fetchMetadata).not.toHaveBeenCalled();
    expect(ports.recordMetadataFailure).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "acks a permanent failure or deletion race without rescheduling (deleted: %s)",
    async (deleted) => {
      const ports = setup();
      ports.fetchMetadata.mockResolvedValue({ ok: false, error: { code: "UNSAFE_URL" } });
      if (deleted) ports.recordMetadataFailure.mockResolvedValue({ outcome: "stale" });
      await expect(processMetadataQueueMessage(message, ports.dependencies)).resolves.toMatchObject(
        {
          action: "ack",
          log: { result: deleted ? "stale" : "failed" },
        },
      );
      expect(ports.send).not.toHaveBeenCalled();
    },
  );
});
