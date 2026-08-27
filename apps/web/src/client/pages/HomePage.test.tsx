// @vitest-environment jsdom

import type { ArticleDto } from "@tech-inbox/contracts";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArticlesPage } from "./ArticlesPage";
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HomePage", () => {
  it("polls pending metadata after two seconds and stops at a terminal state", async () => {
    vi.useFakeTimers();
    const pendingArticle = {
      ...baseArticle,
      title: null,
      metadataStatus: "pending" as const,
      metadataFetchedAt: null,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ articles: [pendingArticle], nextCursor: null }))
      .mockResolvedValue(jsonResponse({ articles: [baseArticle], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      render(<HomePage />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("記事情報を取得しています……")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(screen.getByRole("link", { name: baseArticle.title ?? "" })).toBeTruthy();
    expect(screen.queryByText("記事情報を取得しています……")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

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

  it("retries failed metadata from the article card", async () => {
    const failedArticle: ArticleDto = {
      ...baseArticle,
      metadataStatus: "failed",
      metadataErrorCode: "NETWORK_ERROR",
      metadataAttemptCount: 3,
    };
    const pendingArticle: ArticleDto = {
      ...failedArticle,
      metadataStatus: "pending",
      metadataErrorCode: null,
      metadataAttemptCount: 0,
    };
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (String(input).endsWith("/retry-metadata") && init?.method === "POST") {
          return jsonResponse({ article: pendingArticle });
        }
        return jsonResponse({ articles: [failedArticle], nextCursor: null });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<HomePage />);
    await screen.findByText("タイトルを取得できませんでした");

    await user.click(screen.getByRole("button", { name: "記事情報を再取得" }));

    expect(await screen.findByText("記事情報の再取得を開始しました。")).toBeTruthy();
    expect(screen.getByText("記事情報を取得しています……")).toBeTruthy();
    const retryCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/retry-metadata"),
    );
    expect(retryCall?.[1]).toMatchObject({ method: "POST", body: "{}" });
  });
});

describe("ArticlesPage quality flows", () => {
  it("loads another page, changes sort and status filters, and returns a read item to unread", async () => {
    const readArticle: ArticleDto = {
      ...baseArticle,
      id: "article-read",
      title: "Read article",
      originalUrl: "https://example.com/articles/read",
      status: "read",
      readAt: "2026-08-27T01:02:03.000Z",
    };
    const nextArticle: ArticleDto = {
      ...baseArticle,
      id: "article-next",
      title: "Next article",
      originalUrl: "https://example.com/articles/next",
    };
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const path = String(input);
        if (init?.method === "PATCH") {
          return jsonResponse({ article: { ...readArticle, status: "unread", readAt: null } });
        }
        const url = new URL(path, "https://local.invalid");
        if (url.searchParams.get("cursor") === "next_cursor") {
          return jsonResponse({ articles: [baseArticle, nextArticle], nextCursor: null });
        }
        if (url.searchParams.get("status") === "read") {
          return jsonResponse({ articles: [readArticle], nextCursor: null });
        }
        return jsonResponse({ articles: [baseArticle], nextCursor: "next_cursor" });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ArticlesPage view="all" />);
    await screen.findByRole("link", { name: baseArticle.title ?? "" });

    await user.click(screen.getByRole("button", { name: "さらに読み込む" }));
    expect(await screen.findByRole("link", { name: "Next article" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: baseArticle.title ?? "" })).toHaveLength(1);

    await user.selectOptions(screen.getByLabelText("並び順"), "saved_asc");
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([path]) => String(path).includes("sort=saved_asc"))).toBe(
        true,
      ),
    );
    await user.click(screen.getByLabelText("既読", { exact: true }));
    expect(await screen.findByRole("link", { name: "Read article" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "未読に戻す" }));

    expect(await screen.findByText("記事を未読に戻しました。")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Read article" })).toBeNull();
  });

  it("shows a safe initial load error and retries to an empty all-articles state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "現在記事を取得できません。",
              requestId: "123e4567-e89b-42d3-a456-426614174000",
            },
          },
          503,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ articles: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ArticlesPage view="all" />);

    expect(await screen.findByText("記事を読み込めませんでした")).toBeTruthy();
    expect(screen.getByText("現在記事を取得できません。")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "再読み込み" }));

    expect(await screen.findByText("保存した記事はありません")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("edits and deletes an article through the page dialogs", async () => {
    const updatedArticle: ArticleDto = {
      ...baseArticle,
      title: "Updated title",
      titleIsManual: true,
      updatedAt: "2026-08-27T02:00:00.000Z",
    };
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (init?.method === "PATCH") return jsonResponse({ article: updatedArticle });
        if (init?.method === "DELETE") return jsonResponse({ result: "deleted" });
        return jsonResponse({ articles: [baseArticle], nextCursor: null });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ArticlesPage view="all" />);
    await screen.findByRole("link", { name: baseArticle.title ?? "" });

    let card = screen.getByRole("link", { name: baseArticle.title ?? "" }).closest("article");
    expect(card).not.toBeNull();
    await user.click(card?.querySelector("summary") as HTMLElement);
    await user.click(screen.getByRole("button", { name: "編集" }));
    await user.clear(screen.getByLabelText("タイトル"));
    await user.type(screen.getByLabelText("タイトル"), "Updated title");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));
    expect(await screen.findByRole("link", { name: "Updated title" })).toBeTruthy();

    card = screen.getByRole("link", { name: "Updated title" }).closest("article");
    await user.click(card?.querySelector("summary") as HTMLElement);
    await user.click(screen.getByRole("button", { name: "削除" }));
    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(await screen.findByText("記事を削除しました。")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Updated title" })).toBeNull();
  });
});
