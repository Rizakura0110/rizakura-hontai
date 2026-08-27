import {
  metadataFetchRequestSchema,
  metadataFetchResponseSchema,
  type MetadataFetchResponse,
} from "@tech-inbox/contracts";
import { fetchMetadata } from "./fetch-metadata";

function jsonResponse(body: MetadataFetchResponse, status = 200): Response {
  return Response.json(metadataFetchResponseSchema.parse(body), {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export default {
  async fetch(request): Promise<Response> {
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

    return jsonResponse(await fetchMetadata(parsed.data.url));
  },
} satisfies ExportedHandler;
