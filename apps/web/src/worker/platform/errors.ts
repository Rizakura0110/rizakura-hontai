import type { ApiErrorCode, ApiErrorDetails } from "@rizakura-hontai/contracts/http";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: ContentfulStatusCode;
  readonly details: ApiErrorDetails | undefined;

  constructor(
    status: ContentfulStatusCode,
    code: ApiErrorCode,
    message: string,
    details?: ApiErrorDetails,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function validationError(message = "入力内容を確認してください。"): ApiError {
  return new ApiError(400, "VALIDATION_ERROR", message);
}
