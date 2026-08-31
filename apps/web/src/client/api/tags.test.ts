import type { TagDto } from "@rizakura-me/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTag, deleteTag, listTags, replaceArticleTags, updateTag } from "./tags";

const now = "2026-08-28T00:00:00.000Z";
const tag: TagDto = {
  id: "tag/react",
  name: "React",
  colorHue: 220,
  createdAt: now,
  updatedAt: now,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tag API client", () => {
  it("validates tag CRUD and article assignment responses", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const path = String(input);
        if (path === "/api/v1/tags" && init?.method === undefined) {
          return jsonResponse({ tags: [tag] });
        }
        if (path === "/api/v1/tags" && init?.method === "POST") {
          return jsonResponse({ result: "created", tag }, 201);
        }
        if (path === "/api/v1/tags/tag%2Freact" && init?.method === "PATCH") {
          return jsonResponse({ tag: { ...tag, name: "TypeScript" } });
        }
        if (path === "/api/v1/tags/tag%2Freact" && init?.method === "DELETE") {
          return jsonResponse({ result: "deleted" });
        }
        if (path === "/api/v1/articles/article%2F1/tags" && init?.method === "PUT") {
          return jsonResponse({ tags: [tag] });
        }
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listTags()).resolves.toEqual({ tags: [tag] });
    await expect(createTag("React")).resolves.toEqual({ result: "created", tag });
    await expect(updateTag(tag.id, "TypeScript")).resolves.toMatchObject({ name: "TypeScript" });
    await expect(deleteTag(tag.id)).resolves.toBeUndefined();
    await expect(replaceArticleTags("article/1", [tag.id])).resolves.toEqual([tag]);

    const mutationCalls = fetchMock.mock.calls.filter(([, init]) => init?.body !== undefined);
    expect(mutationCalls).toHaveLength(4);
    for (const [, init] of mutationCalls) {
      const headers = new Headers(init?.headers);
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("X-Rizakura-Me-Client")).toBe("web");
      expect(init?.credentials).toBe("same-origin");
    }
  });

  it("rejects malformed successful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ tags: [{ ...tag, colorHue: 500 }] })),
    );

    await expect(listTags()).rejects.toMatchObject({ name: "ZodError" });
  });
});
