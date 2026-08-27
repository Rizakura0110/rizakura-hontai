import type { MetadataQueueMessage } from "@tech-inbox/contracts";

export const MAX_METADATA_ATTEMPTS = 3;
export const METADATA_RETRY_DELAYS_SECONDS = [5, 15] as const;

export type MetadataQueueProducer = {
  send(message: MetadataQueueMessage, options?: { readonly delaySeconds?: number }): Promise<void>;
};

export function createMetadataQueueProducer(
  queue: Queue<MetadataQueueMessage>,
): MetadataQueueProducer {
  return {
    async send(message, options) {
      await queue.send(message, {
        contentType: "json",
        ...(options?.delaySeconds === undefined ? {} : { delaySeconds: options.delaySeconds }),
      });
    },
  };
}
