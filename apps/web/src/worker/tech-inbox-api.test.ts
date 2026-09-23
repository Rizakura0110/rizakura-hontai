import { apiErrorResponseSchema } from "@rizakura-hontai/contracts/http";
import { TechInboxError, type TechInboxErrorCode } from "@rizakura-hontai/tech-inbox/server";
import { describe, expect, it } from "vitest";
import { type AppBindings, createApp } from "./app";
import { techInboxRoutePolicy } from "./tech-inbox-api";

describe("Tech Inbox domain error adapter", () => {
  async function responseFor(error: Error) {
    const app = createApp({
      authenticateAccess: async () => ({
        subject: "test-owner",
        email: "owner@example.test",
        provider: "cloudflare-access",
      }),
      enforceRateLimit: async () => undefined,
      log: () => undefined,
      repositoryFactory: () => {
        throw error;
      },
    });
    return app.request("https://example.test/api/v1/articles", {}, {} as AppBindings);
  }

  it.each<[TechInboxErrorCode, number]>([
    ["VALIDATION_ERROR", 400],
    ["NOT_FOUND", 404],
    ["URL_CONFLICT", 409],
    ["TAG_CONFLICT", 409],
  ])("preserves %s as HTTP %i at the protected boundary", async (code, status) => {
    const response = await responseFor(new TechInboxError(code, "安全な製品エラー"));
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(apiErrorResponseSchema.parse(await response.json())).toMatchObject({
      error: { code, message: "安全な製品エラー", requestId: response.headers.get("X-Request-Id") },
    });
  });

  it("does not expose unexpected adapter failures as domain errors", async () => {
    const response = await responseFor(new Error("private database details"));
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain("private database details");
    expect(apiErrorResponseSchema.parse(JSON.parse(body)).error.code).toBe("INTERNAL_ERROR");
  });
});

describe("Tech Inbox route policies", () => {
  it.each([
    ["GET", "/activity", "activity.get", "read"],
    ["HEAD", "/activity", "activity.get", "read"],
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
    ["POST", "/activity"],
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
