import { afterEach, describe, expect, it, vi } from "vitest";
import { parseHtmlMetadata, selectMetadata, type RawMetadata } from "./html-metadata";

const now = "2026-08-27T01:02:03.000Z";

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

  it.each([
    {
      name: "twitter title and plain description",
      raw: {
        ...emptyMetadata,
        twitterTitle: "Twitter title",
        description: "Plain description",
      },
      finalUrl: "https://example.org/article",
      expected: { title: "Twitter title", description: "Plain description" },
    },
    {
      name: "title element",
      raw: { ...emptyMetadata, title: "Title element" },
      finalUrl: "https://example.org/article",
      expected: { title: "Title element", description: null },
    },
    {
      name: "final URL fallback",
      raw: emptyMetadata,
      finalUrl: "https://example.org/fallback",
      expected: { title: "https://example.org/fallback", description: null },
    },
  ])("selects the $name fallback", ({ raw, finalUrl, expected }) => {
    expect(selectMetadata(raw, finalUrl)).toMatchObject(expected);
  });

  it("drops empty, malformed, credentialed, oversized, and invalid-date metadata", () => {
    const oversizedUrl = "a".repeat(5_000);
    expect(
      selectMetadata(
        {
          ...emptyMetadata,
          ogTitle: "\u0080\t ",
          canonicalUrl: "http://[",
          faviconUrl: "https://user:password@example.org/favicon.ico",
          imageUrl: oversizedUrl,
          publishedAt: "not a date",
          siteName: "\u0000\n",
        },
        "https://example.org/article",
      ),
    ).toEqual({
      title: "https://example.org/article",
      description: null,
      siteName: null,
      canonicalUrl: null,
      faviconUrl: null,
      imageUrl: null,
      publishedAt: null,
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseHtmlMetadata", () => {
  it("collects the first matching HTML values and delegates to safe selection", async () => {
    const values = new Map<string, string[]>([
      ["title", ["Title ", "element"]],
      ['meta[property="og:title"]', ["OG title", "ignored title"]],
      ['meta[name="twitter:title"]', ["Twitter title"]],
      ['meta[property="og:description"]', ["OG description"]],
      ['meta[name="description"]', ["Description"]],
      ['meta[property="og:site_name"]', ["Example"]],
      ['meta[property="og:image"]', ["/cover.png"]],
      ['link[rel="canonical"]', ["/canonical"]],
      ['link[rel~="icon"]', ["/favicon.ico"]],
      ['meta[property="article:published_time"]', [now]],
      ['meta[name="date"]', ["2020-01-01T00:00:00.000Z"]],
    ]);

    class FakeHtmlRewriter {
      readonly handlers = new Map<string, Record<string, (value: never) => void>>();

      on(selector: string, handler: object) {
        this.handlers.set(selector, handler as Record<string, (value: never) => void>);
        return this;
      }

      transform(_response: Response): Response {
        const handlers = this.handlers;
        return {
          async text() {
            for (const [selector, entries] of values) {
              const handler = handlers.get(selector);
              if (selector === "title") {
                for (const value of entries) handler?.text?.({ text: value } as never);
                continue;
              }
              for (const value of entries) {
                handler?.element?.({
                  getAttribute(name: string) {
                    return name === "content" || name === "href" ? value : null;
                  },
                } as never);
              }
            }
            return "";
          },
        } as Response;
      }
    }
    vi.stubGlobal("HTMLRewriter", FakeHtmlRewriter);

    await expect(
      parseHtmlMetadata(new Response("<html></html>"), "https://example.org/article"),
    ).resolves.toEqual({
      title: "OG title",
      description: "OG description",
      siteName: "Example",
      canonicalUrl: "https://example.org/canonical",
      faviconUrl: "https://example.org/favicon.ico",
      imageUrl: "https://example.org/cover.png",
      publishedAt: now,
    });
  });
});
