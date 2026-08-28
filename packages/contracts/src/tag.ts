import { MAX_TAG_NAME_LENGTH, normalizeTagName } from "@tech-inbox/core/tag";
import { z } from "zod";
import { utcDateTimeSchema } from "./primitives";

export const tagIdSchema = z.string().trim().min(1).max(128);

export const tagNameSchema = z.string().transform((value, context) => {
  const normalized = normalizeTagName(value);
  if (!normalized.ok) {
    context.addIssue({
      code: "custom",
      message:
        normalized.reason === "EMPTY"
          ? "Tag name must not be empty"
          : `Tag name must not exceed ${MAX_TAG_NAME_LENGTH} characters`,
    });
    return z.NEVER;
  }

  return normalized.name;
});

export const tagDtoSchema = z.strictObject({
  id: tagIdSchema,
  name: tagNameSchema,
  colorHue: z.number().int().min(0).max(359),
  createdAt: utcDateTimeSchema,
  updatedAt: utcDateTimeSchema,
});

export type TagDto = z.output<typeof tagDtoSchema>;
