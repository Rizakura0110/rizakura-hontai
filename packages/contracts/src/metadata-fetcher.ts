import { z } from "zod";
import { metadataErrorCodeSchema } from "./article";
import {
  CONTRACT_LIMITS,
  httpUrlSchema,
  nullableHttpUrlSchema,
  nullableUtcDateTimeSchema,
} from "./primitives";

export const metadataFetchRequestSchema = z.strictObject({
  url: httpUrlSchema,
});

export type MetadataFetchRequest = z.output<typeof metadataFetchRequestSchema>;

export const fetchedMetadataSchema = z.strictObject({
  title: z.string().min(1).max(CONTRACT_LIMITS.title),
  description: z.string().max(CONTRACT_LIMITS.description).nullable(),
  siteName: z.string().max(CONTRACT_LIMITS.siteName).nullable(),
  canonicalUrl: nullableHttpUrlSchema,
  faviconUrl: nullableHttpUrlSchema,
  imageUrl: nullableHttpUrlSchema,
  publishedAt: nullableUtcDateTimeSchema,
});

export type FetchedMetadata = z.output<typeof fetchedMetadataSchema>;

export const metadataFetchResponseSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    ok: z.literal(true),
    metadata: fetchedMetadataSchema,
  }),
  z.strictObject({
    ok: z.literal(false),
    error: z.strictObject({
      code: metadataErrorCodeSchema,
    }),
  }),
]);

export type MetadataFetchResponse = z.output<typeof metadataFetchResponseSchema>;
