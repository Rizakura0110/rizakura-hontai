import { z } from "zod";
import { articleIdSchema, httpUrlSchema } from "./primitives";

export const metadataQueueMessageSchema = z.strictObject({
  articleId: articleIdSchema,
  url: httpUrlSchema,
  attempt: z.number().int().nonnegative(),
});

export type MetadataQueueMessage = z.output<typeof metadataQueueMessageSchema>;
