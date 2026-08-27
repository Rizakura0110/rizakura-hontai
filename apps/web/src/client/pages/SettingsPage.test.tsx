// @vitest-environment jsdom

import type { ArticleDto, ExportResponse } from "@tech-inbox/contracts";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

const unreadArticle: ArticleDto = {
  id: "article-1",
  originalUrl: "https://example.com/articles/1",
  canonicalUrl: null,
  title: "Exportable article",
  titleIsManual: false,
  siteName: "Example",
  description: null,
  faviconUrl: null,
  imageUrl: null,
  publishedAt: null,
  status: "unread",
  metadataStatus: "ready",
  metadataErrorCode: null,
  metadataAttemptCount: 1,
  metadataFetchedAt: "2026-08-27T00:00:00.000Z",
  savedAt: "2026-08-27T00:00:00.000Z",
  readAt: null,
  createdAt: "2026-08-27T00:00:00.000Z",
  updatedAt: "2026-08-27T00:00:00.000Z",
};

const exportResponse: ExportResponse = {
  schemaVersion: 1,
  exportedAt: "2026-08-27T01:02:03.000Z",
  articles: [
    unreadArticle,
    {
      ...unreadArticle,
      id: "article-2",
      originalUrl: "https://example.com/articles/2",
      status: "read",
      readAt: "2026-08-27T01:00:00.000Z",
    },
  ],
  articleUrls: [
    {
      normalizedUrl: unreadArticle.originalUrl,
      articleId: unreadArticle.id,
      kind: "original",
      createdAt: unreadArticle.createdAt,
    },
  ],
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

describe("SettingsPage", () => {
  it("shows total and unread counts and exposes the export download", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      jsonResponse(exportResponse),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SettingsPage />);

    expect(screen.getByRole("status").textContent).toContain("件数を確認しています");
    await screen.findByText("JSON schema v1");

    const totalRow = screen.getByText("保存記事数").closest("div");
    const unreadRow = screen.getByText("未読記事数").closest("div");
    expect(totalRow).not.toBeNull();
    expect(unreadRow).not.toBeNull();
    expect(within(totalRow as HTMLElement).getByText("2件")).toBeTruthy();
    expect(within(unreadRow as HTMLElement).getByText("1件")).toBeTruthy();

    expect(screen.getByRole("button", { name: "JSONを書き出す" })).toBeTruthy();
    expect(screen.getByText(/認証情報やアプリ設定は含まれません/u)).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe("/api/v1/export");
    expect(init).toMatchObject({ credentials: "same-origin" });
    expect(new Headers(init?.headers).get("Accept")).toBe("application/json");
  });

  it("shows a safe error and can retry the summary request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "現在データを取得できません。",
              requestId: "123e4567-e89b-42d3-a456-426614174000",
            },
          },
          503,
        ),
      )
      .mockResolvedValueOnce(jsonResponse(exportResponse));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SettingsPage />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "現在データを取得できません。",
    );
    await user.click(screen.getByRole("button", { name: "再読み込み" }));

    await screen.findByText("JSON schema v1");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
