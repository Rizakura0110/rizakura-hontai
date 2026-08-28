import {
  type FetchedMetadata,
  type MetadataFetchResponse,
  type MetadataQueueMessage,
  metadataFetchResponseSchema,
  metadataQueueMessageSchema,
} from "@tech-inbox/contracts";
import { isRetryableMetadataErrorCode, type MetadataErrorCode } from "@tech-inbox/core/metadata";
import type { Article } from "@tech-inbox/core/article";
import { normalizeUrl } from "@tech-inbox/core/url-normalization";
import {
  MAX_METADATA_ATTEMPTS,
  METADATA_RETRY_DELAYS_SECONDS,
  createMetadataQueueProducer,
} from "./metadata-queue";
import { createD1ArticleRepository } from "./repositories/d1-article-repository";
import type { ArticleRepository, CanonicalAliasInput } from "./repositories/article-repository";

type MetadataConsumerBindings = {
  readonly DB: D1Database;
  readonly METADATA_QUEUE: Queue<MetadataQueueMessage>;
  readonly METADATA_FETCHER: Fetcher;
};

export type MetadataConsumerLogEvent = {
  readonly route: "metadata.consume";
  readonly result: "invalid" | "stale" | "ready" | "failed" | "rescheduled" | "retry";
  readonly attempt?: number;
  readonly errorCode?: MetadataErrorCode;
  readonly droppedTagCount?: number;
};

type ProcessResult =
  | { readonly action: "ack"; readonly log: MetadataConsumerLogEvent }
  | {
      readonly action: "retry";
      readonly delaySeconds: number;
      readonly log: MetadataConsumerLogEvent;
    };

export type MetadataConsumerDependencies = {
  readonly repositoryFactory: (bindings: MetadataConsumerBindings) => ArticleRepository;
  readonly fetchMetadata: (binding: Fetcher, url: string) => Promise<MetadataFetchResponse>;
  readonly clock: () => Date;
  readonly log: (event: MetadataConsumerLogEvent) => void;
};

async function fetchMetadataThroughService(
  binding: Fetcher,
  url: string,
): Promise<MetadataFetchResponse> {
  try {
    const response = await binding.fetch(
      new Request("https://metadata-fetcher.internal/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }),
    );
    if (!response.ok) return { ok: false, error: { code: "NETWORK_ERROR" } };

    const parsed = metadataFetchResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : { ok: false, error: { code: "NETWORK_ERROR" } };
  } catch {
    return { ok: false, error: { code: "NETWORK_ERROR" } };
  }
}

const defaultDependencies: MetadataConsumerDependencies = {
  repositoryFactory: (bindings) => createD1ArticleRepository(bindings.DB),
  fetchMetadata: fetchMetadataThroughService,
  clock: () => new Date(),
  log: (event) => console.info(JSON.stringify(event)),
};

function comparableHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./u, "");
  } catch {
    return null;
  }
}

function canonicalAliasFor(
  originalUrl: string,
  canonicalUrl: string | null,
  createdAt: string,
): CanonicalAliasInput | null {
  if (canonicalUrl === null) return null;
  const originalHostname = comparableHostname(originalUrl);
  const canonicalHostname = comparableHostname(canonicalUrl);
  if (
    originalHostname === null ||
    canonicalHostname === null ||
    originalHostname !== canonicalHostname
  ) {
    return null;
  }

  const normalized = normalizeUrl(canonicalUrl);
  return normalized.ok ? { normalizedUrl: normalized.value, createdAt } : null;
}

function toArticleMetadata(metadata: FetchedMetadata) {
  return {
    canonicalUrl: metadata.canonicalUrl,
    title: metadata.title,
    siteName: metadata.siteName,
    description: metadata.description,
    faviconUrl: metadata.faviconUrl,
    imageUrl: metadata.imageUrl,
    publishedAt: metadata.publishedAt,
  } as const;
}

function persistedArticleMetadata(article: Article) {
  return {
    canonicalUrl: article.canonicalUrl,
    title: article.title,
    siteName: article.siteName,
    description: article.description,
    faviconUrl: article.faviconUrl,
    imageUrl: article.imageUrl,
    publishedAt: article.publishedAt,
  } as const;
}

export async function processMetadataQueueMessage(
  rawMessage: unknown,
  bindings: MetadataConsumerBindings,
  dependencies: MetadataConsumerDependencies = defaultDependencies,
): Promise<ProcessResult> {
  const parsedMessage = metadataQueueMessageSchema.safeParse(rawMessage);
  if (!parsedMessage.success) {
    return { action: "ack", log: { route: "metadata.consume", result: "invalid" } };
  }

  const message = parsedMessage.data;
  const repository = dependencies.repositoryFactory(bindings);
  const article = await repository.findById(message.articleId);
  if (article === null || article.originalUrl !== message.url) {
    return { action: "ack", log: { route: "metadata.consume", result: "stale" } };
  }

  if (article.metadataStatus === "ready") {
    const reconciledAt = dependencies.clock().toISOString();
    const result = await repository.applyMetadata({
      id: article.id,
      expectedUrl: message.url,
      metadata: persistedArticleMetadata(article),
      canonicalAlias: canonicalAliasFor(message.url, article.canonicalUrl, reconciledAt),
      attemptCount: article.metadataAttemptCount,
      fetchedAt: article.metadataFetchedAt ?? reconciledAt,
      updatedAt: article.updatedAt,
    });
    return {
      action: "ack",
      log: {
        route: "metadata.consume",
        result: result.outcome === "stale" ? "stale" : "ready",
        attempt: article.metadataAttemptCount,
        ...(result.outcome === "merged" ? { droppedTagCount: result.droppedTagCount } : {}),
      },
    };
  }

  if (
    article.metadataAttemptCount >= MAX_METADATA_ATTEMPTS &&
    article.metadataErrorCode !== null &&
    isRetryableMetadataErrorCode(article.metadataErrorCode)
  ) {
    return {
      action: "retry",
      delaySeconds: METADATA_RETRY_DELAYS_SECONDS.at(-1) ?? 15,
      log: {
        route: "metadata.consume",
        result: "retry",
        attempt: article.metadataAttemptCount,
        errorCode: article.metadataErrorCode,
      },
    };
  }

  const fetchedAt = dependencies.clock().toISOString();
  const nextAttempt = Math.max(message.attempt + 1, article.metadataAttemptCount + 1);
  const response = await dependencies.fetchMetadata(bindings.METADATA_FETCHER, message.url);

  if (response.ok) {
    const result = await repository.applyMetadata({
      id: article.id,
      expectedUrl: message.url,
      metadata: toArticleMetadata(response.metadata),
      canonicalAlias: canonicalAliasFor(message.url, response.metadata.canonicalUrl, fetchedAt),
      attemptCount: nextAttempt,
      fetchedAt,
      updatedAt: fetchedAt,
    });
    return {
      action: "ack",
      log: {
        route: "metadata.consume",
        result: result.outcome === "stale" ? "stale" : "ready",
        attempt: nextAttempt,
        ...(result.outcome === "merged" ? { droppedTagCount: result.droppedTagCount } : {}),
      },
    };
  }

  const errorCode = response.error.code;
  const isTemporaryFailure = isRetryableMetadataErrorCode(errorCode);
  const shouldReschedule = isTemporaryFailure && nextAttempt < MAX_METADATA_ATTEMPTS;
  const recorded = await repository.recordMetadataFailure({
    id: article.id,
    expectedUrl: message.url,
    status: shouldReschedule ? "pending" : "failed",
    errorCode,
    attemptCount: nextAttempt,
    fetchedAt,
    updatedAt: fetchedAt,
  });
  if (recorded.outcome === "stale") {
    return { action: "ack", log: { route: "metadata.consume", result: "stale" } };
  }

  if (!isTemporaryFailure) {
    return {
      action: "ack",
      log: {
        route: "metadata.consume",
        result: "failed",
        attempt: nextAttempt,
        errorCode,
      },
    };
  }

  const delaySeconds =
    METADATA_RETRY_DELAYS_SECONDS[
      Math.min(nextAttempt - 1, METADATA_RETRY_DELAYS_SECONDS.length - 1)
    ] ??
    METADATA_RETRY_DELAYS_SECONDS.at(-1) ??
    15;
  if (!shouldReschedule) {
    return {
      action: "retry",
      delaySeconds,
      log: {
        route: "metadata.consume",
        result: "retry",
        attempt: nextAttempt,
        errorCode,
      },
    };
  }

  try {
    await createMetadataQueueProducer(bindings.METADATA_QUEUE).send(
      { ...message, attempt: nextAttempt },
      { delaySeconds },
    );
    return {
      action: "ack",
      log: {
        route: "metadata.consume",
        result: "rescheduled",
        attempt: nextAttempt,
        errorCode,
      },
    };
  } catch {
    return {
      action: "retry",
      delaySeconds,
      log: {
        route: "metadata.consume",
        result: "retry",
        attempt: nextAttempt,
        errorCode,
      },
    };
  }
}

export async function consumeMetadataQueue(
  batch: MessageBatch<unknown>,
  bindings: MetadataConsumerBindings,
  dependencies: MetadataConsumerDependencies = defaultDependencies,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const result = await processMetadataQueueMessage(message.body, bindings, dependencies);
      try {
        dependencies.log(result.log);
      } catch {
        // Logging must never change message handling.
      }
      if (result.action === "ack") message.ack();
      else message.retry({ delaySeconds: result.delaySeconds });
    } catch {
      message.retry({ delaySeconds: METADATA_RETRY_DELAYS_SECONDS[0] });
      try {
        dependencies.log({ route: "metadata.consume", result: "retry" });
      } catch {
        // Logging must never change message handling.
      }
    }
  }
}
