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
