import { describe, expect, it } from "vitest";
import { apiErrorResponseSchema } from "./http";

describe("shared HTTP contracts", () => {
  it("accepts only the safe API error envelope", () => {
    const safeError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "入力内容を確認してください。",
        requestId: "123e4567-e89b-42d3-a456-426614174000",
        details: { url: ["URLが不正です。"] },
      },
    };

    expect(apiErrorResponseSchema.safeParse(safeError).success).toBe(true);
    expect(
      apiErrorResponseSchema.safeParse({
        ...safeError,
        error: { ...safeError.error, stack: "secret stack" },
      }).success,
    ).toBe(false);
    expect(
      apiErrorResponseSchema.safeParse({
        ...safeError,
        error: { ...safeError.error, code: "SQLITE_ERROR" },
      }).success,
    ).toBe(false);
  });
});
