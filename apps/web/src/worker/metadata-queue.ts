import type { MetadataQueueMessage } from "@rizakura-hontai/tech-inbox/contracts";
import type { MetadataQueueProducer } from "@rizakura-hontai/tech-inbox/server";

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
