import type { MetadataQueueMessage } from "@rizakura-hontai/tech-inbox/contracts";
import { describe, expect, it, vi } from "vitest";
import { createMetadataQueueProducer } from "./metadata-queue";

describe("Cloudflare metadata queue adapter", () => {
  it("uses JSON content type and only forwards an explicitly supplied delay", async () => {
    const send = vi.fn(async () => undefined);
    const queue = createMetadataQueueProducer({ send } as unknown as Queue<MetadataQueueMessage>);
    const message = { articleId: "article-1", url: "https://example.org/article", attempt: 0 };
    await queue.send(message);
    await queue.send(message, { delaySeconds: 5 });
    expect(send.mock.calls).toEqual([
      [message, { contentType: "json" }],
      [message, { contentType: "json", delaySeconds: 5 }],
    ]);
  });

  it("propagates delivery failure to the product retry decision", async () => {
    const send = vi.fn(async () => {
      throw new Error("queue unavailable");
    });
    const queue = createMetadataQueueProducer({ send } as unknown as Queue<MetadataQueueMessage>);
    await expect(
      queue.send({ articleId: "article-1", url: "https://example.org/article", attempt: 0 }),
    ).rejects.toThrow("queue unavailable");
  });
});
