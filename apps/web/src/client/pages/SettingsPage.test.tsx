// @vitest-environment jsdom

import type {
  ArticleDto,
  BackupImportSnapshot,
  BackupImportSummary,
  ExportResponse,
  TagDto,
} from "@tech-inbox/contracts";
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

const reactTag: TagDto = {
  id: "tag-react",
  name: "React",
  colorHue: 220,
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

const cloudflareTag: TagDto = {
  id: "tag-cloudflare",
  name: "Cloudflare",
  colorHue: 40,
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

const exportResponse: ExportResponse = {
  schemaVersion: 2,
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
  tags: [reactTag],
  articleTags: [{ articleId: unreadArticle.id, tagId: reactTag.id }],
};

const importBackup: BackupImportSnapshot = {
  ...exportResponse,
  articles: [unreadArticle],
};

const importSummary: BackupImportSummary = {
  source: {
    schemaVersion: 2,
    exportedAt: exportResponse.exportedAt,
    articles: 1,
    articleUrls: 1,
    tags: 1,
    articleTags: 1,
  },
  changes: {
    articlesCreated: 1,
    articlesMatched: 0,
    articleIdsRemapped: 0,
    articleUrlsCreated: 1,
    articleUrlsMatched: 0,
    articleUrlsSkipped: 0,
    tagsCreated: 1,
    tagsMatched: 0,
    tagsSkipped: 0,
    tagIdsRemapped: 0,
    tagColorsReassigned: 0,
    articleTagsCreated: 1,
    articleTagsMatched: 0,
    articleTagsSkipped: 0,
    pendingArticlesReset: 0,
  },
  hasChanges: true,
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
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) =>
      String(input) === "/api/v1/tags" ? jsonResponse({ tags: [] }) : jsonResponse(exportResponse),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SettingsPage />);

    expect(screen.getByText("件数を確認しています…")).toBeTruthy();
    await screen.findByText("JSON schema v2");

    const totalRow = screen.getByText("保存記事数").closest("div");
    const unreadRow = screen.getByText("未読記事数").closest("div");
    expect(totalRow).not.toBeNull();
    expect(unreadRow).not.toBeNull();
    expect(within(totalRow as HTMLElement).getByText("2件")).toBeTruthy();
    expect(within(unreadRow as HTMLElement).getByText("1件")).toBeTruthy();

    expect(screen.getByRole("button", { name: "JSONを書き出す" })).toBeTruthy();
    expect(screen.getByText(/認証情報やアプリ設定は含まれません/u)).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [path, init] = fetchMock.mock.calls.find(([input]) => input === "/api/v1/export") ?? [];
    expect(path).toBe("/api/v1/export");
    expect(init).toMatchObject({ credentials: "same-origin" });
    expect(new Headers(init?.headers).get("Accept")).toBe("application/json");
  });

  it("shows a safe error and can retry the summary request", async () => {
    let exportCalls = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input) === "/api/v1/tags") return jsonResponse({ tags: [] });
      exportCalls += 1;
      return exportCalls === 1
        ? jsonResponse(
            {
              error: {
                code: "SERVICE_UNAVAILABLE",
                message: "現在データを取得できません。",
                requestId: "123e4567-e89b-42d3-a456-426614174000",
              },
            },
            503,
          )
        : jsonResponse(exportResponse);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SettingsPage />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "現在データを取得できません。",
    );
    await user.click(screen.getByRole("button", { name: "再読み込み" }));

    await screen.findByText("JSON schema v2");
    await waitFor(() => expect(exportCalls).toBe(2));
  });

  it("previews and applies a validated JSON backup after explicit confirmation", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const path = String(input);
        if (path === "/api/v1/export") return jsonResponse(exportResponse);
        if (path === "/api/v1/tags") return jsonResponse({ tags: [reactTag] });
        if (path === "/api/v1/import/preview") {
          return jsonResponse({ result: "preview", summary: importSummary });
        }
        if (path === "/api/v1/import") {
          return jsonResponse({ result: "imported", summary: importSummary });
        }
        throw new Error(`Unexpected request: ${path} ${init?.method ?? "GET"}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SettingsPage />);
    await screen.findByText("JSON schema v2");

    const input = screen.getByLabelText("バックアップファイル（1MB以下）");
    await user.upload(
      input,
      new File([JSON.stringify(importBackup)], "tech-inbox-export.json", {
        type: "application/json",
      }),
    );
    expect(await screen.findByText("選択済み: tech-inbox-export.json")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "復元内容を確認" }));

    expect(await screen.findByText("復元プレビュー")).toBeTruthy();
    expect(screen.getByText("追加する記事").closest("div")?.textContent).toContain("1件");
    const applyButton = screen.getByRole("button", { name: "安全に復元する" });
    expect((applyButton as HTMLButtonElement).disabled).toBe(true);
    await user.click(
      screen.getByRole("checkbox", {
        name: "既存データを上書きしないマージ内容を確認しました",
      }),
    );
    await user.click(applyButton);

    expect(await screen.findByText("バックアップを安全に復元しました。")).toBeTruthy();
    const mutationCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(mutationCalls.map(([path]) => path)).toEqual([
      "/api/v1/import/preview",
      "/api/v1/import",
    ]);
    for (const [, init] of mutationCalls) {
      expect(new Headers(init?.headers).get("X-Tech-Inbox-Client")).toBe("web");
      expect(JSON.parse(String(init?.body))).toEqual({ backup: importBackup });
    }
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([path]) => path === "/api/v1/export")).toHaveLength(2);
      expect(fetchMock.mock.calls.filter(([path]) => path === "/api/v1/tags")).toHaveLength(2);
    });
  });

  it("creates a tag from settings and adds it to the manager", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const path = String(input);
        if (path === "/api/v1/export") return jsonResponse(exportResponse);
        if (path === "/api/v1/tags" && init?.method === undefined) {
          return jsonResponse({ tags: [] });
        }
        if (path === "/api/v1/tags" && init?.method === "POST") {
          expect(JSON.parse(String(init.body))).toEqual({ name: "Cloudflare" });
          return jsonResponse({ result: "created", tag: cloudflareTag }, 201);
        }
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SettingsPage />);

    const createForm = await screen.findByRole("form", { name: "新しいタグを追加" });
    const nameInput = within(createForm).getByRole("textbox", { name: "新しいタグ名" });
    await user.type(nameInput, "Cloudflare");
    await user.click(within(createForm).getByRole("button", { name: "追加" }));

    expect(await screen.findByLabelText("Cloudflareの新しい名前")).toBeTruthy();
    expect((nameInput as HTMLInputElement).value).toBe("");
  });

  it("reports an existing tag name without duplicating the tag", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const path = String(input);
        if (path === "/api/v1/export") return jsonResponse(exportResponse);
        if (path === "/api/v1/tags" && init?.method === undefined) {
          return jsonResponse({ tags: [reactTag] });
        }
        if (path === "/api/v1/tags" && init?.method === "POST") {
          return jsonResponse({ result: "alreadyExists", tag: reactTag });
        }
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SettingsPage />);

    const createForm = await screen.findByRole("form", { name: "新しいタグを追加" });
    await user.type(within(createForm).getByRole("textbox", { name: "新しいタグ名" }), "React");
    await user.click(within(createForm).getByRole("button", { name: "追加" }));

    expect((await within(createForm).findByRole("alert")).textContent).toContain(
      "同じ名前のタグが既に存在します。",
    );
    expect(screen.getAllByLabelText("Reactの新しい名前")).toHaveLength(1);
  });

  it("renames and deletes tags without changing article data", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const path = String(input);
        if (path === "/api/v1/export") return jsonResponse(exportResponse);
        if (path === "/api/v1/tags" && init?.method === undefined) {
          return jsonResponse({ tags: [reactTag] });
        }
        if (path.endsWith(`/${reactTag.id}`) && init?.method === "PATCH") {
          return jsonResponse({
            tag: { ...reactTag, name: "TypeScript", updatedAt: "2026-08-28T01:00:00.000Z" },
          });
        }
        if (path.endsWith(`/${reactTag.id}`) && init?.method === "DELETE") {
          return jsonResponse({ result: "deleted" });
        }
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SettingsPage />);

    const nameInput = await screen.findByLabelText("Reactの新しい名前");
    await user.clear(nameInput);
    await user.type(nameInput, "TypeScript");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("TypeScript")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "削除" }));
    const deleteDialog = screen.getByRole("dialog", { name: "タグを削除しますか？" });
    expect(within(deleteDialog).getByText(/記事自体は削除されません/u)).toBeTruthy();
    await user.click(within(deleteDialog).getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(screen.queryByLabelText("TypeScriptの新しい名前")).toBeNull());
    expect(screen.getByText("タグはまだありません。上の入力欄から追加できます。")).toBeTruthy();
  });

  it("preserves another tag draft after saving one tag", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const path = String(input);
        if (path === "/api/v1/export") return jsonResponse(exportResponse);
        if (path === "/api/v1/tags" && init?.method === undefined) {
          return jsonResponse({ tags: [cloudflareTag, reactTag] });
        }
        if (init?.method === "PATCH") {
          const body = JSON.parse(String(init.body)) as { name: string };
          const tag = path.endsWith(`/${reactTag.id}`) ? reactTag : cloudflareTag;
          return jsonResponse({
            tag: { ...tag, name: body.name, updatedAt: "2026-08-28T01:00:00.000Z" },
          });
        }
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SettingsPage />);

    const reactInput = await screen.findByLabelText("Reactの新しい名前");
    const cloudflareInput = screen.getByLabelText("Cloudflareの新しい名前");
    await user.clear(reactInput);
    await user.type(reactInput, "TypeScript");
    await user.clear(cloudflareInput);
    await user.type(cloudflareInput, "Workers");

    const reactForm = reactInput.closest("form");
    expect(reactForm).not.toBeNull();
    await user.click(within(reactForm as HTMLFormElement).getByRole("button", { name: "保存" }));
    await screen.findByText("TypeScript");

    const preservedInput = screen.getByLabelText("Cloudflareの新しい名前");
    expect((preservedInput as HTMLInputElement).value).toBe("Workers");
    const cloudflareForm = preservedInput.closest("form");
    expect(cloudflareForm).not.toBeNull();
    await user.click(
      within(cloudflareForm as HTMLFormElement).getByRole("button", { name: "保存" }),
    );
    await screen.findByText("Workers");

    const patchCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(patchCalls).toHaveLength(2);
  });
});
