import { describe, expect, it } from "vitest";

import {
  isRetryableMetadataErrorCode,
  METADATA_ERROR_CODES,
  METADATA_STATUSES,
  type MetadataErrorCode,
  RETRYABLE_METADATA_ERROR_CODES,
} from "./metadata";

const retryableCodes = new Set<MetadataErrorCode>(RETRYABLE_METADATA_ERROR_CODES);

describe("isRetryableMetadataErrorCode", () => {
  it("exposes the persisted metadata states", () => {
    expect(METADATA_STATUSES).toEqual(["pending", "ready", "failed"]);
  });

  it.each(RETRYABLE_METADATA_ERROR_CODES)("classifies %s as retryable", (errorCode) => {
    expect(isRetryableMetadataErrorCode(errorCode)).toBe(true);
  });

  it.each(METADATA_ERROR_CODES.filter((code) => !retryableCodes.has(code)))(
    "classifies %s as permanent",
    (errorCode) => {
      expect(isRetryableMetadataErrorCode(errorCode)).toBe(false);
    },
  );
});
