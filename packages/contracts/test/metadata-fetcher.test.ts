import { METADATA_ERROR_CODES } from "@tech-inbox/core/metadata";
import { describe, expect, it } from "vitest";
import { metadataFetchRequestSchema, metadataFetchResponseSchema } from "../src/metadata-fetcher";
import { CONTRACT_LIMITS } from "../src/primitives";

const validMetadata = {
  title: "Example article",
  description: "A useful article.",
  siteName: "Example",
  canonicalUrl: "https://example.com/article",
  faviconUrl: "https://example.com/favicon.ico",
  imageUrl: "https://example.com/og.png",
  publishedAt: "2026-08-26T01:02:03.000Z",
};

describe("metadata fetcher request contract", () => {
  it("accepts only a strict HTTP URL request", () => {
    expect(
      metadataFetchRequestSchema.safeParse({ url: "https://example.com/article" }).success,
    ).toBe(true);
    expect(
      metadataFetchRequestSchema.safeParse({
        url: "https://example.com/article",
        authorization: "secret",
      }).success,
    ).toBe(false);
    expect(metadataFetchRequestSchema.safeParse({ url: "data:text/plain,test" }).success).toBe(
      false,
    );
  });
});

describe("metadata fetcher response contract", () => {
  it("accepts a strict successful response", () => {
    expect(
      metadataFetchResponseSchema.safeParse({ ok: true, metadata: validMetadata }).success,
    ).toBe(true);
    expect(
      metadataFetchResponseSchema.safeParse({
        ok: true,
        metadata: { ...validMetadata, html: "<html>secret</html>" },
      }).success,
    ).toBe(false);
  });

  it("enforces metadata length and UTC timestamp boundaries", () => {
    expect(
      metadataFetchResponseSchema.safeParse({
        ok: true,
        metadata: { ...validMetadata, title: "t".repeat(CONTRACT_LIMITS.title) },
      }).success,
    ).toBe(true);
    expect(
      metadataFetchResponseSchema.safeParse({
        ok: true,
        metadata: { ...validMetadata, title: "t".repeat(CONTRACT_LIMITS.title + 1) },
      }).success,
    ).toBe(false);
    expect(
      metadataFetchResponseSchema.safeParse({
        ok: true,
        metadata: {
          ...validMetadata,
          description: "d".repeat(CONTRACT_LIMITS.description + 1),
        },
      }).success,
    ).toBe(false);
    expect(
      metadataFetchResponseSchema.safeParse({
        ok: true,
        metadata: { ...validMetadata, publishedAt: "2026-08-26T10:02:03+09:00" },
      }).success,
    ).toBe(false);
  });

  it.each(METADATA_ERROR_CODES)("accepts the safe %s failure code", (code) => {
    expect(metadataFetchResponseSchema.safeParse({ ok: false, error: { code } }).success).toBe(
      true,
    );
  });

  it("rejects unknown error codes and leaked diagnostics", () => {
    expect(
      metadataFetchResponseSchema.safeParse({
        ok: false,
        error: { code: "UNKNOWN_INTERNAL_EXCEPTION" },
      }).success,
    ).toBe(false);
    expect(
      metadataFetchResponseSchema.safeParse({
        ok: false,
        error: { code: METADATA_ERROR_CODES[0], stack: "secret stack" },
      }).success,
    ).toBe(false);
  });
});
