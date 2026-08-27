// @vitest-environment jsdom

import type { ArticleDto } from "@tech-inbox/contracts";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";

const baseArticle: ArticleDto = {
  id: "article-1",
  originalUrl: "https://example.com/articles/1",
  canonicalUrl: null,
  title: "安全なReactの記事",
  titleIsManual: false,
  siteName: "Example",
  description: "A useful article.",
  faviconUrl: null,
  imageUrl: null,
  publishedAt: null,
  status: "unread",
  metadataStatus: "ready",
  metadataErrorCode: null,
  metadataAttemptCount: 1,
  metadataFetchedAt: "2026-08-26T01:02:03.000Z",
  savedAt: "2026-08-26T01:02:03.000Z",
  readAt: null,
  createdAt: "2026-08-26T01:02:03.000Z",
  updatedAt: "2026-08-26T01:02:03.000Z",
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HomePage", () => {
  it("renders API content as text without creating executable elements", async () => {
    const unsafeTitle = '<img src=x onerror="window.pwned=true">';
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          articles: [{ ...baseArticle, title: unsafeTitle }],
          nextCursor: null,
        }),
      ),
    );

    const { container } = render(<HomePage />);

    expect(screen.getByRole("heading", { name: "未読の記事" })).toBeTruthy();
    expect(await screen.findByRole("link", { name: unsafeTitle })).toBeTruthy();
    expect(container.querySelector("article img")).toBeNull();
    expect(container.querySelector("article script")).toBeNull();
  });

  it("submits an explicit search query to the list API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        articles: [],
        nextCursor: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<HomePage />);
    await screen.findByText("未読の記事はありません");

    await user.type(screen.getByRole("searchbox", { name: "記事を検索" }), "React Query");
    await user.click(screen.getByRole("button", { name: "検索" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("q=React+Query");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("status=unread");
  });

  it("removes a read article and restores it through the undo action", async () => {
    const readArticle: ArticleDto = {
      ...baseArticle,
      status: "read",
      readAt: "2026-08-27T01:02:03.000Z",
      updatedAt: "2026-08-27T01:02:03.000Z",
    };
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (String(input).startsWith("/api/v1/articles?")) {
          return jsonResponse({ articles: [baseArticle], nextCursor: null });
        }
        const body = JSON.parse(String(init?.body)) as { status?: string };
        return jsonResponse({ article: body.status === "read" ? readArticle : baseArticle });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<HomePage />);
    await screen.findByRole("link", { name: baseArticle.title ?? "" });

    await user.click(screen.getByRole("button", { name: "既読にする" }));
    expect(await screen.findByText("記事を既読にしました。")).toBeTruthy();
    expect(screen.queryByRole("link", { name: baseArticle.title ?? "" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(await screen.findByRole("link", { name: baseArticle.title ?? "" })).toBeTruthy();
    expect(screen.getByText("変更を元に戻しました。")).toBeTruthy();
  });

  it("reports duplicate URL registration and links to the existing article", async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (init?.method === "POST") {
          return jsonResponse({ result: "alreadyExists", article: baseArticle });
        }
        return jsonResponse({ articles: [], nextCursor: null });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<HomePage />);
    await screen.findByText("未読の記事はありません");

    await user.type(screen.getByLabelText("保存する記事のURL"), baseArticle.originalUrl);
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("この記事はすでに登録されています。")).toBeTruthy();
    expect(screen.getByRole("link", { name: "記事を見る" }).getAttribute("href")).toBe(
      baseArticle.originalUrl,
    );
    const postCall = fetchMock.mock.calls.find((call) => call[1]?.method === "POST");
    const headers = new Headers(postCall?.[1]?.headers);
    expect(headers.get("X-Tech-Inbox-Client")).toBe("web");
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});
