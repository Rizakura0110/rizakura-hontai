import { MAX_URL_LENGTH } from "@tech-inbox/core/url-normalization";
import { z } from "zod";

export const CONTRACT_LIMITS = {
  url: MAX_URL_LENGTH,
  title: 500,
  description: 2_000,
  searchQuery: 200,
  siteName: 500,
  cursor: 2_048,
} as const;

const authorityWithCredentialsPattern = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*@/i;

export const httpUrlSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .url({ protocol: /^https?$/u })
      .max(CONTRACT_LIMITS.url)
      .refine((value) => !authorityWithCredentialsPattern.test(value), {
        message: "URL must not contain credentials",
      }),
  );

export const articleIdSchema = z.string().trim().min(1).max(128);

export const utcDateTimeSchema = z.iso.datetime({ offset: false, local: false });

export const opaqueCursorSchema = z
  .string()
  .min(1)
  .max(CONTRACT_LIMITS.cursor)
  .regex(/^[A-Za-z0-9_-]+$/, "Cursor must be an unpadded base64url value");

export const nullableHttpUrlSchema = httpUrlSchema.nullable();
export const nullableUtcDateTimeSchema = utcDateTimeSchema.nullable();
