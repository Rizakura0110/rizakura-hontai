import { describe, expect, it } from "vitest";
import { TechInboxError, type TechInboxErrorCode } from "./errors";

describe("TechInboxError", () => {
  it.each<TechInboxErrorCode>(["VALIDATION_ERROR", "NOT_FOUND", "URL_CONFLICT", "TAG_CONFLICT"])(
    "exposes the %s domain failure without HTTP framework state",
    (code) => {
      const error = new TechInboxError(code, "safe product message");
      expect(error).toBeInstanceOf(Error);
      expect(error).toMatchObject({
        name: "TechInboxError",
        code,
        message: "safe product message",
      });
      expect(error).not.toHaveProperty("status");
      expect(error).not.toHaveProperty("details");
    },
  );
});
