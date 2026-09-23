import {
  type MetadataFetchResponse,
  type MetadataQueueMessage,
  metadataFetchResponseSchema,
} from "@rizakura-hontai/tech-inbox/contracts";
import {
  type MetadataConsumerLogEvent as ProductMetadataConsumerLogEvent,
  processMetadataQueueMessage as processProductMetadataQueueMessage,
} from "@rizakura-hontai/tech-inbox/metadata";
import {
  type ArticleRepository,
  METADATA_RETRY_DELAYS_SECONDS,
} from "@rizakura-hontai/tech-inbox/server";
import { createMetadataQueueProducer } from "./metadata-queue";
import {
  MAINTENANCE_RETRY_SECONDS,
  type MaintenanceBindings,
  maintenanceMode,
} from "./platform/maintenance";
import { createD1ArticleRepository } from "./repositories/d1-article-repository";

type MetadataConsumerBindings = MaintenanceBindings & {
  readonly DB: D1Database;
  readonly METADATA_QUEUE: Queue<MetadataQueueMessage>;
  readonly METADATA_FETCHER: Fetcher;
};

export type MetadataConsumerLogEvent =
  | ProductMetadataConsumerLogEvent
  | { readonly route: "metadata.consume"; readonly result: "paused" };

export type MetadataConsumerDependencies = {
  readonly repositoryFactory: (bindings: MetadataConsumerBindings) => ArticleRepository;
  readonly fetchMetadata: (binding: Fetcher, url: string) => Promise<MetadataFetchResponse>;
  readonly clock: () => Date;
  readonly log: (event: MetadataConsumerLogEvent) => void;
};

export async function fetchMetadataThroughService(
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

export async function processMetadataQueueMessage(
  rawMessage: unknown,
  bindings: MetadataConsumerBindings,
  dependencies: MetadataConsumerDependencies = defaultDependencies,
) {
  // A safety net, not a replacement for Cloudflare's pause-delivery: native
  // retries are bounded and message retention keeps running while paused.
  if (maintenanceMode(bindings) === "frozen") {
    return {
      action: "retry" as const,
      delaySeconds: MAINTENANCE_RETRY_SECONDS,
      log: { route: "metadata.consume", result: "paused" } as const,
    };
  }

  return processProductMetadataQueueMessage(rawMessage, {
    repositoryFactory: () => dependencies.repositoryFactory(bindings),
    fetchMetadata: (url) => dependencies.fetchMetadata(bindings.METADATA_FETCHER, url),
    queue: createMetadataQueueProducer(bindings.METADATA_QUEUE),
    clock: dependencies.clock,
  });
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
