import { describe, expect, it } from "vitest";

import { MAX_URL_LENGTH, normalizeUrl } from "./url-normalization";

function expectNormalized(input: string, expected: string): void {
  const result = normalizeUrl(input);

  expect(result).toEqual({ ok: true, value: expected });

  if (result.ok) {
    expect(normalizeUrl(result.value)).toEqual(result);
  }
}

describe("normalizeUrl", () => {
  it("trims input and applies the normalizations in combination", () => {
    expectNormalized(
      "  HTTPS://EXAMPLE.COM:443/articles/42/?utm_source=newsletter&lang=ja#section  ",
      "https://example.com/articles/42?lang=ja",
    );
  });

  it.each([
    ["http://Example.COM:80/", "http://example.com/"],
    ["https://EXAMPLE.COM:443/path", "https://example.com/path"],
    ["https://example.com:8443/path/", "https://example.com:8443/path"],
  ])("normalizes default ports while retaining non-default ports: %s", (input, expected) => {
    expectNormalized(input, expected);
  });

  it.each([
    ["https://example.com/path#section", "https://example.com/path"],
    ["https://example.com/path#:~:text=selected", "https://example.com/path"],
  ])("removes fragments: %s", (input, expected) => {
    expectNormalized(input, expected);
  });

  it.each([
    ["https://example.com/", "https://example.com/"],
    ["https://example.com/docs/", "https://example.com/docs"],
    ["https://example.com/docs///", "https://example.com/docs///"],
    ["https://example.com/a//b/", "https://example.com/a//b"],
  ])(
    "normalizes an unambiguous trailing path slash without collapsing path data: %s",
    (input, expected) => {
      expectNormalized(input, expected);
    },
  );

  it("removes every specified tracking parameter without leaving a query marker", () => {
    const trackingQuery = [
      "utm_source=source",
      "utm_medium=medium",
      "utm_campaign=campaign",
      "utm_term=term",
      "utm_content=content",
      "utm_id=id",
      "fbclid=facebook",
      "gclid=google",
      "dclid=display",
      "mc_cid=campaign-id",
      "mc_eid=email-id",
      "_ga=analytics",
      "_gl=linker",
    ].join("&");

    expectNormalized(`https://example.com/article?${trackingQuery}`, "https://example.com/article");
  });

  it("removes exact tracking parameter names and keeps case-sensitive content parameters", () => {
    expectNormalized(
      "https://example.com/?UTM_SOURCE=content&utm_source=tracking&id=42&page=2&q=typescript&lang=ja&ref=home",
      "https://example.com/?UTM_SOURCE=content&id=42&lang=ja&page=2&q=typescript&ref=home",
    );
  });

  it("sorts query entries by decoded key and value while preserving duplicate pairs", () => {
    expectNormalized(
      "https://example.com/?z=2&a=3&a=1&a=1",
      "https://example.com/?a=1&a=1&a=3&z=2",
    );
  });

  it("sorts by decoded values without rewriting raw percent encoding", () => {
    const result = normalizeUrl("https://example.com/?q=a%20b&x=%7E&encoded=%2F");

    expect(result).toEqual({
      ok: true,
      value: "https://example.com/?encoded=%2F&q=a%20b&x=%7E",
    });

    if (result.ok) {
      const normalized = new URL(result.value);
      expect(normalized.searchParams.get("encoded")).toBe("/");
      expect(normalized.searchParams.get("q")).toBe("a b");
      expect(normalized.searchParams.get("x")).toBe("~");
    }
  });

  it("preserves empty keys, empty values, and duplicate entries", () => {
    expectNormalized(
      "https://example.com/?b=&a&=x&a=2&a=2",
      "https://example.com/?=x&a&a=2&a=2&b=",
    );
  });

  it.each([
    ["http://192.0.2.1/path/", "http://192.0.2.1/path"],
    ["https://[2001:0DB8:0:0:0:0:0:1]:443/path/", "https://[2001:db8::1]/path"],
  ])("normalizes IP literals without applying the separate fetch policy: %s", (input, expected) => {
    expectNormalized(input, expected);
  });

  it("uses WHATWG serialization for international hostnames, paths, and query values", () => {
    expectNormalized(
      "https://例え.テスト/資料?q=日本語",
      "https://xn--r8jz45g.xn--zckzah/%E8%B3%87%E6%96%99?q=%E6%97%A5%E6%9C%AC%E8%AA%9E",
    );
  });

  it("does not merge schemes, www hostnames, or path casing", () => {
    const inputs = [
      "http://example.com/Article",
      "https://example.com/Article",
      "https://www.example.com/Article",
      "https://example.com/article",
    ];

    const values = inputs.map((input) => {
      const result = normalizeUrl(input);
      expect(result.ok).toBe(true);
      return result.ok ? result.value : "";
    });

    expect(new Set(values).size).toBe(inputs.length);
  });

  it("accepts a trimmed URL at the maximum length", () => {
    const prefix = "https://example.com/";
    const maximumLengthUrl = `${prefix}${"a".repeat(MAX_URL_LENGTH - prefix.length)}`;

    const result = normalizeUrl(`  ${maximumLengthUrl}  `);

    expect(result).toEqual({ ok: true, value: maximumLengthUrl });
  });

  it("rejects a URL over the maximum length", () => {
    const prefix = "https://example.com/";
    const overlongUrl = `${prefix}${"a".repeat(MAX_URL_LENGTH - prefix.length + 1)}`;

    expect(normalizeUrl(overlongUrl)).toEqual({ ok: false, code: "URL_TOO_LONG" });
  });

  it.each(["", "   ", "not a url", "/relative", "https://[2001:db8::1"])(
    "rejects invalid absolute URLs: %j",
    (input) => {
      expect(normalizeUrl(input)).toEqual({ ok: false, code: "INVALID_URL" });
    },
  );

  it.each([
    "javascript:alert(1)",
    "file:///tmp/article",
    "data:text/plain,article",
    "ftp://example.com/article",
  ])("rejects unsupported protocols: %s", (input) => {
    expect(normalizeUrl(input)).toEqual({ ok: false, code: "UNSUPPORTED_PROTOCOL" });
  });

  it.each([
    "https://user@example.com/article",
    "https://:password@example.com/article",
    "https://user:password@example.com/article",
    "https://user%40example@example.com/article",
  ])("rejects credentials: %s", (input) => {
    expect(normalizeUrl(input)).toEqual({ ok: false, code: "CREDENTIALS_NOT_ALLOWED" });
  });
});
