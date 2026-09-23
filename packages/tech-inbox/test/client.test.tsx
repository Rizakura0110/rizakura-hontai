// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityPage, TechInboxApp, TechInboxProvider } from "../src/app";
import type { TechInboxClient, TechInboxUi } from "../src/browser";
import { techInboxProduct } from "../src/browser";
import type { TagDto } from "../src/contracts";
import { articleActivityFixture, articleDtoFixture } from "./contracts/fixtures";

const article = articleDtoFixture();
const tag: TagDto = {
  id: "tag-one",
  name: "React",
  colorHue: 220,
  createdAt: article.createdAt,
  updatedAt: article.updatedAt,
};
const ui: TechInboxUi = {
  Modal: ({ open, title, children }) =>
    open ? (
      <dialog open aria-label={title}>
        {children}
      </dialog>
    ) : null,
  Toast: ({ toast }) => (toast === null ? null : <p role="status">{toast.message}</p>),
  ProductLayout: ({ brand, navigation, children }) => (
    <div>
      <header>{brand}</header>
      <nav>{navigation}</nav>
      <main>{children}</main>
    </div>
  ),
};

function clientFixture(overrides: Partial<TechInboxClient> = {}): TechInboxClient {
  const unexpected = async () => {
    throw new Error("Unexpected client call");
  };
  return {
    listArticles: vi.fn(async () => ({
      articles: [article],
      availableTags: [tag],
      tagsByArticleId: { [article.id]: [tag] },
      nextCursor: null,
    })),
    createArticle: unexpected,
    updateArticle: unexpected,
    deleteArticle: unexpected,
    retryArticleMetadata: unexpected,
    getArticleActivity: vi.fn(async () => articleActivityFixture()),
    exportArticles: vi.fn(async () => ({
      schemaVersion: 2 as const,
      exportedAt: article.createdAt,
      articles: [article],
      articleUrls: [],
      tags: [tag],
      articleTags: [],
    })),
    previewBackupImport: unexpected,
    applyBackupImport: unexpected,
    listTags: vi.fn(async () => ({ tags: [tag] })),
    createTag: unexpected,
    updateTag: unexpected,
    deleteTag: unexpected,
    replaceArticleTags: unexpected,
    userFacingError: vi.fn(() => "安全なエラーメッセージ"),
    ...overrides,
  };
}

beforeEach(() => {
  // Product tests must not obtain transport, credentials or foundation UI implicitly.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Product attempted HTTP");
    }),
  );
  window.history.replaceState(null, "", techInboxProduct.basePath);
});

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  cleanup();
  vi.unstubAllGlobals();
});

describe("Tech Inbox injected browser app", () => {
  it("renders the product with only an injected client and UI, then toggles a record", async () => {
    const updateArticle = vi.fn(async () => ({
      ...article,
      status: "read" as const,
      readAt: article.createdAt,
    }));
    const client = clientFixture({ updateArticle });
    render(<TechInboxApp client={client} ui={ui} />);
    expect(await screen.findByRole("link", { name: article.title ?? "" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "すべて" }).getAttribute("aria-current")).toBe("page");
    await userEvent.setup().click(screen.getByRole("button", { name: "既読にする" }));
    expect(updateArticle).toHaveBeenCalledWith(article.id, { status: "read" });
    expect(await screen.findByRole("button", { name: "未読に戻す" })).toBeTruthy();
    expect(client.listArticles).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "all",
        sort: "saved_desc",
        query: "",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("saves an article using the injected create operation", async () => {
    const createArticle = vi.fn(async () => ({ result: "created" as const, article, tags: [tag] }));
    const client = clientFixture({ createArticle });
    render(<TechInboxApp client={client} ui={ui} />);
    await screen.findByRole("link", { name: article.title ?? "" });
    fireEvent.change(screen.getByLabelText("保存する記事のURL"), {
      target: { value: article.originalUrl },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "保存" }));
    expect(createArticle).toHaveBeenCalledWith(article.originalUrl, { tagIds: [] });
  });

  it("uses injected safe error handling rather than displaying unknown errors", async () => {
    const privateError = new Error("sensitive host detail");
    const client = clientFixture({
      listArticles: vi.fn(async () => {
        throw privateError;
      }),
    });
    render(<TechInboxApp client={client} ui={ui} />);
    expect(await screen.findByText("安全なエラーメッセージ")).toBeTruthy();
    expect(client.userFacingError).toHaveBeenCalledWith(privateError);
    expect(screen.queryByText(privateError.message)).toBeNull();
  });

  it("routes to activity and settings with the same URLs", async () => {
    const client = clientFixture();
    render(<TechInboxApp client={client} ui={ui} />);
    await screen.findByRole("link", { name: article.title ?? "" });
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "活動" }));
    expect(await screen.findByRole("group", { name: "直近365日の既読活動" })).toBeTruthy();
    expect(window.location.pathname).toBe("/tech-inbox/activity");
    expect(client.getArticleActivity).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("link", { name: "設定" }));
    await waitFor(() => expect(client.exportArticles).toHaveBeenCalledOnce());
    expect(client.listTags).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/tech-inbox/settings");
    expect(await screen.findByText("タグ管理")).toBeTruthy();
  });

  it("renders a stable unknown-page link without calling the host", () => {
    window.history.replaceState(null, "", "/tech-inbox/missing");
    const client = clientFixture();
    render(<TechInboxApp client={client} ui={ui} />);
    expect(screen.getByRole("heading", { name: "ページが見つかりません" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "すべての記事へ戻る" }).getAttribute("href")).toBe(
      "/tech-inbox/",
    );
    expect(client.listArticles).not.toHaveBeenCalled();
  });

  it("aborts the host read when a product page unmounts", async () => {
    const client = clientFixture();
    const { unmount } = render(
      <TechInboxProvider client={client} ui={ui}>
        <ActivityPage />
      </TechInboxProvider>,
    );
    await screen.findByRole("group", { name: "直近365日の既読活動" });
    const options = vi.mocked(client.getArticleActivity).mock.calls[0]?.[0];
    expect(options?.signal?.aborted).toBe(false);
    unmount();
    expect(options?.signal?.aborted).toBe(true);
  });

  it("fails explicitly if a host omits the injected runtime", () => {
    expect(() => render(<ActivityPage />)).toThrow(
      "Tech Inbox requires an injected client and UI.",
    );
  });
});
