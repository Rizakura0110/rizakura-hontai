import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";

function request(body = JSON.stringify({ url: "https://example.org/article" })) {
  return new Request("https://metadata-fetcher.internal/fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("metadata fetcher runtime entrypoint", () => {
  it("does not rebind the Workers runtime fetch receiver", async () => {
    const runtimeFetch = vi.fn(function (this: unknown) {
      if (this !== undefined) throw new TypeError("Illegal invocation");
      return Promise.resolve(
        new Response("{}", { headers: { "Content-Type": "application/json" } }),
      );
    });
    vi.stubGlobal("fetch", runtimeFetch);

    const response = await worker.fetch(request());
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: "UNSUPPORTED_CONTENT_TYPE" },
    });
    expect(runtimeFetch).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("provides the HTMLRewriter runtime adapter to the product parser", async () => {
    const runtimeFetch = vi.fn(
      async () =>
        new Response("<title>Example</title>", { headers: { "Content-Type": "text/html" } }),
    );
    const rewrite = vi.fn();
    class RuntimeHtmlRewriter {
      on() {
        return this;
      }
      transform(response: Response) {
        rewrite(response);
        return response;
      }
    }
    vi.stubGlobal("fetch", runtimeFetch);
    vi.stubGlobal("HTMLRewriter", RuntimeHtmlRewriter);
    const response = await worker.fetch(request());
    expect(await response.json()).toMatchObject({
      ok: true,
      metadata: { title: "https://example.org/article" },
    });
    expect(rewrite).toHaveBeenCalledOnce();
  });

  it.each([
    { request: new Request("https://metadata-fetcher.internal/fetch"), status: 404 },
    {
      request: new Request("https://metadata-fetcher.internal/other", { method: "POST" }),
      status: 404,
    },
    {
      request: new Request("https://metadata-fetcher.internal/fetch", {
        method: "POST",
        body: "text",
      }),
      status: 415,
    },
    { request: request("not json"), status: 400 },
    { request: request(JSON.stringify({ invalid: true })), status: 400 },
  ])(
    "rejects invalid transport input without network access ($status)",
    async ({ request, status }) => {
      const runtimeFetch = vi.fn();
      vi.stubGlobal("fetch", runtimeFetch);
      expect((await worker.fetch(request)).status).toBe(status);
      expect(runtimeFetch).not.toHaveBeenCalled();
    },
  );
});
