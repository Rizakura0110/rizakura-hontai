import { z } from "zod";

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "URL_CONFLICT",
  "TAG_CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
] as const;

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);

export const apiErrorDetailsSchema = z.record(
  z.string().min(1).max(100),
  z.array(z.string().max(500)).max(20),
);

export type ApiErrorDetails = z.output<typeof apiErrorDetailsSchema>;

export const apiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: apiErrorCodeSchema,
    message: z.string().min(1).max(500),
    requestId: z.uuid(),
    details: apiErrorDetailsSchema.optional(),
  }),
});

export type ApiErrorCode = z.output<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.output<typeof apiErrorResponseSchema>;

export const healthResponseSchema = z.strictObject({
  status: z.literal("ok"),
});

export type HealthResponse = z.output<typeof healthResponseSchema>;
