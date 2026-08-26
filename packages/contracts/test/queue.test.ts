import { describe, expect, it } from "vitest";
import { metadataQueueMessageSchema } from "../src/queue";

describe("metadata queue contract", () => {
  const validMessage = {
    articleId: "article-1",
    url: "https://example.com/article",
    attempt: 0,
  };

  it("accepts the documented queue message", () => {
    expect(metadataQueueMessageSchema.parse(validMessage)).toEqual(validMessage);
  });

  it("rejects missing and unknown fields", () => {
    const { attempt: _attempt, ...withoutAttempt } = validMessage;

    expect(metadataQueueMessageSchema.safeParse(withoutAttempt).success).toBe(false);
    expect(metadataQueueMessageSchema.safeParse({ ...validMessage, trace: "secret" }).success).toBe(
      false,
    );
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid attempt %s",
    (attempt) => {
      expect(metadataQueueMessageSchema.safeParse({ ...validMessage, attempt }).success).toBe(
        false,
      );
    },
  );

  it("rejects non-HTTP and credential-bearing URLs", () => {
    expect(
      metadataQueueMessageSchema.safeParse({ ...validMessage, url: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(
      metadataQueueMessageSchema.safeParse({
        ...validMessage,
        url: "https://user:password@example.com/article",
      }).success,
    ).toBe(false);
  });
});
