import { describe, expect, it } from "vitest";

import {
  ARTICLE_LIST_STATUSES,
  ARTICLE_SORTS,
  ARTICLE_STATUSES,
  ARTICLE_URL_KINDS,
} from "./article";

describe("article domain values", () => {
  it("keeps persisted and list status values distinct", () => {
    expect(ARTICLE_STATUSES).toEqual(["unread", "read"]);
    expect(ARTICLE_LIST_STATUSES).toEqual(["all", "unread", "read"]);
  });

  it("exposes only the supported sort and URL alias values", () => {
    expect(ARTICLE_SORTS).toEqual(["saved_desc", "saved_asc", "read_desc"]);
    expect(ARTICLE_URL_KINDS).toEqual(["original", "canonical"]);
  });
});
