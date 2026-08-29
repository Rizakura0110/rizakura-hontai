import { describe, expect, it } from "vitest";
import { app } from "./app";
import { SECURITY_HEADERS } from "./security-headers";

describe("health API", () => {
  it("returns an uncached JSON health response with a request ID", async () => {
    const response = await app.request("http://localhost/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
    expect(response.headers.get("content-security-policy")).toContain("manifest-src 'self'");
    expect(response.headers.get("content-security-policy")).toContain("worker-src 'none'");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns the safe JSON error shape for an unknown API route", async () => {
    const response = await app.request("http://localhost/api/v1/unknown");
    const requestId = response.headers.get("x-request-id");

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "NOT_FOUND",
        message: "指定されたAPIは存在しません。",
        requestId,
      },
    });
  });
});
