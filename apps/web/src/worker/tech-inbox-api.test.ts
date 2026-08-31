import { describe, expect, it } from "vitest";
import { techInboxRoutePolicy } from "./tech-inbox-api";

describe("Tech Inbox route policies", () => {
  it.each([
    ["GET", "/articles", "articles.list", "read"],
    ["HEAD", "/articles", "articles.list", "read"],
    ["POST", "/articles", "articles.create", "create"],
    ["GET", "/articles/private-id", "articles.get", "read"],
    ["PATCH", "/articles/private-id", "articles.update", "mutate"],
    ["DELETE", "/articles/private-id", "articles.delete", "mutate"],
    ["POST", "/articles/private-id/retry-metadata", "articles.retry_metadata", "retry"],
    ["GET", "/tags", "tags.list", "read"],
    ["POST", "/tags", "tags.create", "mutate"],
    ["PATCH", "/tags/private-id", "tags.update", "mutate"],
    ["DELETE", "/tags/private-id", "tags.delete", "mutate"],
    ["GET", "/articles/private-id/tags", "article_tags.list", "read"],
    ["PUT", "/articles/private-id/tags", "article_tags.replace", "mutate"],
    ["GET", "/export", "export.get", "export"],
    ["HEAD", "/export", "export.get", "export"],
    ["POST", "/import/preview", "import.preview", "export"],
    ["POST", "/import", "import.apply", "mutate"],
  ])("preserves the policy for %s %s", (method, path, name, rateLimit) => {
    expect(techInboxRoutePolicy(method, `/api/v1${path}`)).toEqual({ name, rateLimit });
  });
  it.each([
    ["GET", "/health"],
    ["POST", "/health"],
    ["GET", "/daymark/future"],
    ["PUT", "/articles"],
    ["DELETE", "/tags"],
    ["POST", "/tags/private-id"],
    ["POST", "/articles/private-id/tags"],
    ["PUT", "/articles/private-id"],
    ["GET", "/articles/private-id/retry-metadata"],
  ])("does not classify unrelated or unsupported %s %s as an article operation", (method, path) => {
    expect(techInboxRoutePolicy(method, `/api/v1${path}`)).toBeUndefined();
  });
});
