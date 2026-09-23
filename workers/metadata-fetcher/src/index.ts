import {
  type MetadataFetchResponse,
  metadataFetchRequestSchema,
  metadataFetchResponseSchema,
} from "@rizakura-hontai/tech-inbox/contracts";
import { fetchMetadata, parseHtmlMetadata } from "@rizakura-hontai/tech-inbox/metadata";

function jsonResponse(body: MetadataFetchResponse, status = 200): Response {
  return Response.json(metadataFetchResponseSchema.parse(body), {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/fetch") {
      return new Response(null, { status: 404 });
    }
    if (
      request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
      "application/json"
    ) {
      return jsonResponse({ ok: false, error: { code: "INVALID_URL" } }, 415);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: { code: "INVALID_URL" } }, 400);
    }
    const parsed = metadataFetchRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResponse({ ok: false, error: { code: "INVALID_URL" } }, 400);
    }

    return jsonResponse(
      await fetchMetadata(parsed.data.url, {
        // Workers fetch must be called without rebinding its runtime receiver.
        fetch: (input, init) => fetch(input, init),
        parse: (response, finalUrl) =>
          parseHtmlMetadata(response, finalUrl, () => new HTMLRewriter()),
        setTimeout,
        clearTimeout,
      }),
    );
  },
} satisfies ExportedHandler;
