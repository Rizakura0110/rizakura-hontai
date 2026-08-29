import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import {
  MAX_REQUEST_BODY_BYTES,
  parseQuery,
  parseWithSchema,
  readJsonBody,
} from "./request-validation";

describe("parseWithSchema", () => {
  it("returns parsed data and maps schema failures to validation errors", () => {
    expect(
      parseWithSchema(
        { safeParse: () => ({ success: true as const, data: { value: "parsed" } }) },
        "input",
      ),
    ).toEqual({ value: "parsed" });

    expect(() =>
      parseWithSchema({ safeParse: () => ({ success: false as const }) }, "input"),
    ).toThrowError(ApiError);
  });
});

describe("parseQuery", () => {
  it("collects unique parameters and rejects duplicates", () => {
    expect(parseQuery(new URLSearchParams("status=read&q=React"))).toEqual({
      status: "read",
      q: "React",
    });
    expect(() => parseQuery(new URLSearchParams("q=one&q=two"))).toThrowError(ApiError);
  });
});

describe("readJsonBody", () => {
  it("decodes a valid streamed JSON body", async () => {
    const request = new Request("https://example.org", {
      method: "POST",
      body: JSON.stringify({ title: "安全な本文" }),
    });

    await expect(readJsonBody(request)).resolves.toEqual({ title: "安全な本文" });
  });

  it.each(["invalid", "-1", "1.5"])("rejects invalid declared length %s", async (length) => {
    const request = new Request("https://example.org", {
      method: "POST",
      headers: { "Content-Length": length },
      body: "{}",
    });

    await expect(readJsonBody(request)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects declared and streamed bodies over the limit", async () => {
    const declared = new Request("https://example.org", {
      method: "POST",
      headers: { "Content-Length": String(MAX_REQUEST_BODY_BYTES + 1) },
      body: "{}",
    });
    await expect(readJsonBody(declared)).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });

    const streamed = new Request("https://example.org", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(MAX_REQUEST_BODY_BYTES) }),
    });
    await expect(readJsonBody(streamed)).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });

  it("supports a route-specific body limit", async () => {
    const request = new Request("https://example.org", {
      method: "POST",
      body: JSON.stringify({ value: "larger route body" }),
    });

    await expect(readJsonBody(request, 64)).resolves.toEqual({ value: "larger route body" });
  });

  it("rejects a missing body, malformed JSON, and invalid UTF-8", async () => {
    await expect(readJsonBody(new Request("https://example.org"))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(
      readJsonBody(new Request("https://example.org", { method: "POST", body: "{" })),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      readJsonBody(
        new Request("https://example.org", {
          method: "POST",
          body: new Uint8Array([0xff, 0xfe]),
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
