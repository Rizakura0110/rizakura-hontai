import type { MetadataQueueMessage } from "../contracts";

export const MAX_METADATA_ATTEMPTS = 3;
export const METADATA_RETRY_DELAYS_SECONDS = [5, 15] as const;

export type MetadataQueueProducer = {
  send(message: MetadataQueueMessage, options?: { readonly delaySeconds?: number }): Promise<void>;
};
