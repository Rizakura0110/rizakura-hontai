import worker from "./index";
import { createD1ArticleRepository } from "./repositories/d1-article-repository";
import type { ApplyMetadataInput } from "./repositories/article-repository";

type IntegrationBindings = Parameters<typeof worker.fetch>[1];

export default {
  async fetch(request: Request, bindings: IntegrationBindings, context: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname !== "/__integration/apply-metadata") {
      return worker.fetch(request, bindings, context);
    }
    if (request.method !== "POST") return new Response(null, { status: 405 });

    const input = (await request.json()) as ApplyMetadataInput;
    const result = await createD1ArticleRepository(bindings.DB).applyMetadata(input);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store", "X-Request-ID": crypto.randomUUID() },
    });
  },
  queue: worker.queue,
} satisfies ExportedHandler<IntegrationBindings>;
