export type TechInboxErrorCode = "VALIDATION_ERROR" | "NOT_FOUND" | "URL_CONFLICT" | "TAG_CONFLICT";

export class TechInboxError extends Error {
  readonly code: TechInboxErrorCode;

  constructor(code: TechInboxErrorCode, message: string) {
    super(message);
    this.name = "TechInboxError";
    this.code = code;
  }
}
