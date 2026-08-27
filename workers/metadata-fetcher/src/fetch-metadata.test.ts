import type { FetchedMetadata } from "@tech-inbox/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchMetadata,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  type FetchMetadataDependencies,
} from "./fetch-metadata";

const metadata: FetchedMetadata = {
  title: "Example",
  description: null,
  siteName: null,
  canonicalUrl: null,
  faviconUrl: null,
  imageUrl: null,
  publishedAt: null,
};

function dependencies(fetchImplementation: typeof fetch): FetchMetadataDependencies {
  return {
    fetch: fetchImplementation,
    parse: async () => metadata,
    setTimeout,
    clearTimeout,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchMetadata", () => {
  it("returns parsed metadata for a bounded HTML response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("<title>Example</title>", {
        headers: { "Content-Type": "text/html; charset=utf-8", "Content-Length": "22" },
      }),
    );
    const parse = vi.fn(async () => metadata);

    await expect(
      fetchMetadata("https://example.org/article", { ...dependencies(fetchMock), parse }),
    ).resolves.toEqual({ ok: true, metadata });
    expect(parse).toHaveBeenCalledWith(expect.any(Response), "https://example.org/article");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.org/article",
      expect.objectContaining({ method: "GET", redirect: "manual", signal: expect.anything() }),
    );
  });

  it("rejects an unsafe initial URL without contacting the network", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(
      fetchMetadata("http://127.0.0.1/private", dependencies(fetchMock)),
    ).resolves.toEqual({ ok: false, error: { code: "UNSAFE_URL" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("revalidates a redirect target before fetching it", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "http://169.254.169.254/latest/meta-data/" },
      }),
    );

    await expect(
      fetchMetadata("https://example.org/start", dependencies(fetchMock)),
    ).resolves.toEqual({ ok: false, error: { code: "UNSAFE_URL" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops and cancels an oversized streamed response", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_RESPONSE_BYTES));
        controller.enqueue(new Uint8Array(1));
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(stream, { headers: { "Content-Type": "text/html" } }));

    await expect(
      fetchMetadata("https://example.org/large", dependencies(fetchMock)),
    ).resolves.toEqual({ ok: false, error: { code: "RESPONSE_TOO_LARGE" } });
    expect(cancelled).toBe(true);
  });

  it("cancels a response whose declared content length is too large", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(stream, {
        headers: {
          "Content-Type": "text/html",
          "Content-Length": String(MAX_RESPONSE_BYTES + 1),
        },
      }),
    );

    await expect(
      fetchMetadata("https://example.org/large", dependencies(fetchMock)),
    ).resolves.toEqual({ ok: false, error: { code: "RESPONSE_TOO_LARGE" } });
    expect(cancelled).toBe(true);
  });

  it("enforces the redirect cap", async () => {
    let count = 0;
    const fetchMock = vi.fn<typeof fetch>(async () => {
      count += 1;
      return new Response(null, {
        status: 302,
        headers: { Location: `https://example.org/redirect-${count}` },
      });
    });

    await expect(
      fetchMetadata("https://example.org/start", dependencies(fetchMock)),
    ).resolves.toEqual({ ok: false, error: { code: "TOO_MANY_REDIRECTS" } });
    expect(fetchMock).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
  });

  it("rejects a non-HTML response before parsing", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { headers: { "Content-Type": "application/json" } }));
    const parse = vi.fn(async () => metadata);

    await expect(
      fetchMetadata("https://example.org/data", { ...dependencies(fetchMock), parse }),
    ).resolves.toEqual({ ok: false, error: { code: "UNSUPPORTED_CONTENT_TYPE" } });
    expect(parse).not.toHaveBeenCalled();
  });

  it.each([
    [429, "HTTP_RATE_LIMITED"],
    [503, "HTTP_SERVER_ERROR"],
    [404, "HTTP_CLIENT_ERROR"],
    [199, "HTTP_CLIENT_ERROR"],
  ] as const)("maps HTTP %i to %s", async (status, errorCode) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      status,
      body: null,
      headers: new Headers(),
    } as Response);

    await expect(
      fetchMetadata("https://example.org/status", dependencies(fetchMock)),
    ).resolves.toEqual({ ok: false, error: { code: errorCode } });
  });

  it("handles missing, malformed, and looping redirect locations", async () => {
    const missingLocation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 302 }));
    await expect(
      fetchMetadata("https://example.org/start", dependencies(missingLocation)),
    ).resolves.toEqual({ ok: false, error: { code: "HTTP_CLIENT_ERROR" } });

    const malformedLocation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "http://[not-an-ipv6-address" },
      }),
    );
    await expect(
      fetchMetadata("https://example.org/start", dependencies(malformedLocation)),
    ).resolves.toEqual({ ok: false, error: { code: "INVALID_URL" } });

    const loop = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "/start" },
      }),
    );
    await expect(fetchMetadata("https://example.org/start", dependencies(loop))).resolves.toEqual({
      ok: false,
      error: { code: "REDIRECT_LOOP" },
    });
  });

  it("maps parser and network exceptions without exposing their details", async () => {
    const parse = vi.fn(async () => {
      throw new Error("private parser detail");
    });
    const html = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(null, { headers: { "Content-Type": "application/xhtml+xml" } }),
      );
    await expect(
      fetchMetadata("https://example.org/parse", { ...dependencies(html), parse }),
    ).resolves.toEqual({ ok: false, error: { code: "PARSE_ERROR" } });

    const network = vi.fn<typeof fetch>(async () => {
      throw new Error("private network detail");
    });
    await expect(
      fetchMetadata("https://example.org/network", dependencies(network)),
    ).resolves.toEqual({ ok: false, error: { code: "NETWORK_ERROR" } });
  });

  it("aborts an external request after the timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    const result = fetchMetadata("https://example.org/slow", dependencies(fetchMock));
    await vi.advanceTimersByTimeAsync(8_000);

    await expect(result).resolves.toEqual({ ok: false, error: { code: "FETCH_TIMEOUT" } });
  });
});
