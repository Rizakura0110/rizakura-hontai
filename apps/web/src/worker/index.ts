import { app, type AppBindings } from "./app";
import { consumeMetadataQueue } from "./metadata-consumer";

export default {
  fetch: (request: Request, bindings: AppBindings, context: ExecutionContext) =>
    app.fetch(request, bindings, context),
  queue: (batch: MessageBatch<unknown>, bindings: AppBindings) =>
    consumeMetadataQueue(batch, bindings),
} satisfies ExportedHandler<AppBindings>;
