import { SECURITY_HEADERS } from "./security-headers";

type DocumentBindings = {
  readonly ASSETS: { fetch(request: Request): Promise<Response> };
};

function documentResponse(
  body: BodyInit | null,
  status: number,
  headers: HeadersInit = {},
): Response {
  const responseHeaders = new Headers(headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) responseHeaders.set(name, value);
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(body, { status, headers: responseHeaders });
}

// Assets are protected by the existing host-wide Cloudflare Access application.
// Only these document paths receive HTML; API and missing asset paths never do.
export async function serveDocument(
  request: Request,
  bindings: DocumentBindings,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return documentResponse(null, 405, { Allow: "GET, HEAD" });
  }
  const url = new URL(request.url);
  const redirects: Readonly<Record<string, string>> = {
    "/articles": "/tech-inbox/",
    "/articles/": "/tech-inbox/",
    "/settings": "/tech-inbox/settings",
    "/settings/": "/tech-inbox/settings",
    "/tech-inbox": "/tech-inbox/",
    "/tech-inbox/index.html": "/tech-inbox/",
    "/tech-inbox/settings/": "/tech-inbox/settings",
  };
  const destination = redirects[url.pathname];
  if (destination !== undefined) {
    return documentResponse(null, 302, { Location: destination + url.search });
  }
  if (url.pathname === "/tech-inbox/" || url.pathname === "/tech-inbox/settings") {
    const assetUrl = new URL("/tech-inbox/", request.url);
    // Strip client conditionals so an HTML shell is never returned as an empty 304.
    const response = await bindings.ASSETS.fetch(new Request(assetUrl, { method: request.method }));
    if (!response.ok) return documentResponse(null, 503);
    return documentResponse(response.body, response.status, response.headers);
  }
  return documentResponse(request.method === "HEAD" ? null : "ページが見つかりません。", 404, {
    "Content-Type": "text/plain; charset=utf-8",
  });
}
