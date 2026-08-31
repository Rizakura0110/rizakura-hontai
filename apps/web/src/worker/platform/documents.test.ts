import { describe, expect, it, vi } from "vitest";
import { serveDocument } from "./documents";
import { SECURITY_HEADERS } from "./security-headers";

function assets(status = 200) {
  return {
    ASSETS: {
      fetch: vi.fn(
        async (request: Request) =>
          new Response(request.method === "HEAD" ? null : "<title>Tech Inbox</title>", {
            status,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }),
      ),
    },
  };
}

describe("product document routing", () => {
  it.each([
    ["/articles", "/tech-inbox/"],
    ["/articles/", "/tech-inbox/"],
    ["/settings", "/tech-inbox/settings"],
    ["/settings/", "/tech-inbox/settings"],
    ["/tech-inbox", "/tech-inbox/"],
    ["/tech-inbox/index.html", "/tech-inbox/"],
    ["/tech-inbox/settings/", "/tech-inbox/settings"],
  ])("redirects %s to a fixed same-origin destination", async (source, target) => {
    const bindings = assets();
    const query = "?q=a%20b&returnTo=https%3A%2F%2Fevil.invalid";
    const response = await serveDocument(
      new Request(`https://app.invalid${source}${query}`),
      bindings,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(target + query);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(bindings.ASSETS.fetch).not.toHaveBeenCalled();
  });
  it.each(["/tech-inbox/", "/tech-inbox/settings"])(
    "serves the article HTML for %s",
    async (path) => {
      const bindings = assets();
      const response = await serveDocument(
        new Request(`https://app.invalid${path}?q=private`, {
          headers: { "If-None-Match": "stale-etag" },
        }),
        bindings,
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("<title>Tech Inbox</title>");
      const forwarded = bindings.ASSETS.fetch.mock.calls[0]?.[0];
      expect(forwarded?.url).toBe("https://app.invalid/tech-inbox/");
      expect(forwarded?.headers.has("If-None-Match")).toBe(false);
      for (const [key, value] of Object.entries(SECURITY_HEADERS))
        expect(response.headers.get(key)).toBe(value);
    },
  );
  it.each([
    "/daymark/",
    "/other",
    "/api/v1/unknown",
    "/assets/missing.js",
    "/tech-inbox/missing.css",
    "/tech-inbox/unknown",
  ])("does not return HTML for %s", async (path) => {
    const bindings = assets();
    const response = await serveDocument(new Request(`https://app.invalid${path}`), bindings);
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
    expect(bindings.ASSETS.fetch).not.toHaveBeenCalled();
  });
  it("handles HEAD without a body and rejects document writes", async () => {
    const bindings = assets();
    for (const path of ["/tech-inbox/settings", "/not-found"]) {
      const response = await serveDocument(
        new Request(`https://app.invalid${path}`, { method: "HEAD" }),
        bindings,
      );
      expect(await response.text()).toBe("");
    }
    const response = await serveDocument(
      new Request("https://app.invalid/articles", { method: "POST" }),
      bindings,
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
  });
  it("fails safely if the built article entry is unavailable", async () => {
    const response = await serveDocument(
      new Request("https://app.invalid/tech-inbox/"),
      assets(404),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
  });
});
