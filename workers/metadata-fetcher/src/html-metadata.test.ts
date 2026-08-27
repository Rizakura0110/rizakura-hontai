import { describe, expect, it } from "vitest";
import { selectMetadata, type RawMetadata } from "./html-metadata";

const emptyMetadata: RawMetadata = {
  title: "",
  ogTitle: null,
  twitterTitle: null,
  description: null,
  ogDescription: null,
  siteName: null,
  canonicalUrl: null,
  faviconUrl: null,
  imageUrl: null,
  publishedAt: null,
};

describe("selectMetadata", () => {
  it("sanitizes fields, applies title priority, and resolves safe relative URLs", () => {
    expect(
      selectMetadata(
        {
          ...emptyMetadata,
          title: "Title element",
          twitterTitle: "Twitter title",
          ogTitle: "  OG\u0000   title  ",
          ogDescription: "  Useful\n article ",
          canonicalUrl: "/canonical",
          faviconUrl: "javascript:alert(1)",
          imageUrl: "/image.png",
          publishedAt: "2026-08-27T01:02:03+09:00",
        },
        "https://example.org/articles/1",
      ),
    ).toEqual({
      title: "OG title",
      description: "Useful article",
      siteName: null,
      canonicalUrl: "https://example.org/canonical",
      faviconUrl: null,
      imageUrl: "https://example.org/image.png",
      publishedAt: "2026-08-26T16:02:03.000Z",
    });
  });
});
