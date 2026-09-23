import {
  type FetchedMetadata,
  type MetadataFetchResponse,
  metadataQueueMessageSchema,
} from "../contracts";
import type { Article } from "../core/article";
import { isRetryableMetadataErrorCode, type MetadataErrorCode } from "../core/metadata";
import { normalizeUrl } from "../core/url-normalization";
import {
  MAX_METADATA_ATTEMPTS,
  METADATA_RETRY_DELAYS_SECONDS,
  type MetadataQueueProducer,
} from "../server/metadata-queue";
import type {
  ArticleRepository,
  CanonicalAliasInput,
} from "../server/repositories/article-repository";

export type MetadataConsumerLogEvent = {
  readonly route: "metadata.consume";
  readonly result: "invalid" | "stale" | "ready" | "failed" | "rescheduled" | "retry";
  readonly attempt?: number;
  readonly errorCode?: MetadataErrorCode;
  readonly droppedTagCount?: number;
};

export type MetadataProcessResult =
  | { readonly action: "ack"; readonly log: MetadataConsumerLogEvent }
  | {
      readonly action: "retry";
      readonly delaySeconds: number;
      readonly log: MetadataConsumerLogEvent;
    };

export type MetadataConsumerDependencies = {
  readonly repositoryFactory: () => ArticleRepository;
  readonly fetchMetadata: (url: string) => Promise<MetadataFetchResponse>;
  readonly queue: MetadataQueueProducer;
  readonly clock: () => Date;
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
  dependencies: MetadataConsumerDependencies,
): Promise<MetadataProcessResult> {
  const parsedMessage = metadataQueueMessageSchema.safeParse(rawMessage);
  if (!parsedMessage.success) {
    return { action: "ack", log: { route: "metadata.consume", result: "invalid" } };
  }

  const message = parsedMessage.data;
  const repository = dependencies.repositoryFactory();
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
  const response = await dependencies.fetchMetadata(message.url);

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
    await dependencies.queue.send({ ...message, attempt: nextAttempt }, { delaySeconds });
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
