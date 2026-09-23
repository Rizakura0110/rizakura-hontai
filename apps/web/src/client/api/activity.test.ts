import { afterEach, describe, expect, it, vi } from "vitest";
import { articleActivityFixture } from "../../../../../modules/tech-inbox/test/contracts/fixtures";
import { getArticleActivity } from "./activity";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("activity API client", () => {
  it("loads and validates activity using the existing same-origin request policy", async () => {
    const data = articleActivityFixture();
    const fetchMock = vi.fn(async () => json(data));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await expect(getArticleActivity({ signal: controller.signal })).resolves.toEqual(data);
    const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe("/api/v1/activity");
    expect(init.credentials).toBe("same-origin");
    expect(init.signal).toBe(controller.signal);
    expect(new Headers(init.headers).get("Accept")).toBe("application/json");
    expect(init.body).toBeUndefined();
  });

  it("rejects malformed success data and preserves a safe authentication error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ days: [] }))
        .mockResolvedValueOnce(
          json(
            {
              error: {
                code: "UNAUTHORIZED",
                message: "再ログインしてください。",
                requestId: "123e4567-e89b-42d3-a456-426614174000",
              },
            },
            401,
          ),
        ),
    );
    await expect(getArticleActivity()).rejects.toThrow();
    await expect(getArticleActivity()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
      message: "再ログインしてください。",
    });
  });
});
