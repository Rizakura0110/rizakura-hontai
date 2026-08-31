// @vitest-environment jsdom

import type { ArticleDto, TagDto } from "@rizakura-hontai/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AppLayout } from "./AppLayout";
import { ArticleCard } from "./ArticleCard";
import { ArticleComposer } from "./ArticleComposer";
import { DeleteArticleDialog, EditArticleDialog } from "./ArticleDialogs";
import { Modal } from "../platform/Modal";

const now = "2026-08-27T01:02:03.000Z";
const article: ArticleDto = {
  id: "article-1",
  originalUrl: "https://example.org/article",
  canonicalUrl: null,
  title: "Example article",
  titleIsManual: false,
  siteName: "Example",
  description: null,
  faviconUrl: null,
  imageUrl: null,
  publishedAt: now,
  status: "unread",
  metadataStatus: "ready",
  metadataErrorCode: null,
  metadataAttemptCount: 1,
  metadataFetchedAt: now,
  savedAt: now,
  readAt: null,
  createdAt: now,
  updatedAt: now,
};

const tag: TagDto = {
  id: "tag-react",
  name: "React",
  colorHue: 220,
  createdAt: now,
  updatedAt: now,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AppLayout", () => {
  it("renders both accessible navigations and marks the current destination", () => {
    render(
      <MemoryRouter initialEntries={["/tech-inbox/"]}>
        <AppLayout>
          <p>Page content</p>
        </AppLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText("Page content")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "メインナビゲーション" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "モバイルナビゲーション" })).toBeTruthy();
    for (const link of screen.getAllByRole("link", { name: "すべて" })) {
      expect(link.getAttribute("aria-current")).toBe("page");
    }
    expect(screen.queryByRole("link", { name: "未読" })).toBeNull();
  });
});

describe("ArticleCard", () => {
  it("renders defensive fallbacks and invokes every available card action", async () => {
    const onToggleRead = vi.fn();
    const onEdit = vi.fn();
    const onEditTags = vi.fn();
    const onDelete = vi.fn();
    const onRetryMetadata = vi.fn();
    const user = userEvent.setup();
    const failedArticle: ArticleDto = {
      ...article,
      originalUrl: "not a URL",
      title: null,
      siteName: " ",
      savedAt: "invalid date",
      status: "read",
      readAt: now,
      metadataStatus: "failed",
      metadataErrorCode: "NETWORK_ERROR",
      metadataAttemptCount: 3,
    };
    render(
      <ArticleCard
        article={failedArticle}
        busy={false}
        onDelete={onDelete}
        onEdit={onEdit}
        onEditTags={onEditTags}
        onRetryMetadata={onRetryMetadata}
        onToggleRead={onToggleRead}
        tags={[tag]}
      />,
    );

    expect(screen.getByText("W")).toBeTruthy();
    expect(screen.getByText("保存 invalid date")).toBeTruthy();
    expect(screen.getByText("公開 2026年8月27日")).toBeTruthy();
    expect(screen.getByText("React")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "未読に戻す" }));
    await user.click(screen.getByRole("button", { name: "記事情報を再取得" }));
    const details = screen.getByText("not a URLのその他の操作").closest("details");
    expect(details).not.toBeNull();
    details?.setAttribute("open", "");
    await user.click(screen.getByRole("button", { name: "編集" }));
    expect(details?.hasAttribute("open")).toBe(false);
    details?.setAttribute("open", "");
    await user.click(screen.getByRole("button", { name: "タグを編集" }));
    details?.setAttribute("open", "");
    await user.click(screen.getByRole("button", { name: "削除" }));

    expect(onToggleRead).toHaveBeenCalledWith(failedArticle);
    expect(onRetryMetadata).toHaveBeenCalledWith(failedArticle);
    expect(onEdit).toHaveBeenCalledWith(failedArticle);
    expect(onEditTags).toHaveBeenCalledWith(failedArticle);
    expect(onDelete).toHaveBeenCalledWith(failedArticle);
  });

  it("disables mutations and shows pending state while busy", () => {
    render(
      <ArticleCard
        article={{ ...article, metadataStatus: "pending" }}
        busy={true}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onEditTags={vi.fn()}
        onRetryMetadata={vi.fn()}
        onToggleRead={vi.fn()}
        tags={[]}
      />,
    );

    expect(screen.getByText("記事情報を取得しています……")).toBeTruthy();
    expect((screen.getByRole("button", { name: "更新中…" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.queryByRole("button", { name: "記事情報を再取得" })).toBeNull();
  });
});

describe("ArticleComposer", () => {
  it("keeps the URL when creation declines and reports a rejected creation", async () => {
    const onCreate = vi
      .fn<(url: string, tagIds: readonly string[]) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error("保存要求を完了できません。"));
    const user = userEvent.setup();
    const { container } = render(
      <ArticleComposer
        availableTags={[tag]}
        onCreate={onCreate}
        onCreateTag={vi.fn(async () => tag)}
        variant="desktop"
      />,
    );
    const input = screen.getByLabelText("保存する記事のURL");

    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    expect(screen.getByText("URLを入力してください。")).toBeTruthy();
    await user.type(input, " https://example.org/keep ");
    await user.click(screen.getByRole("checkbox", { name: "React" }));
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(onCreate).toHaveBeenLastCalledWith("https://example.org/keep", [tag.id]);
    expect((input as HTMLInputElement).value).toBe("https://example.org/keep");

    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("保存要求を完了できません。")).toBeTruthy();
  });

  it("opens, cancels, and clears a successful mobile submission", async () => {
    const onCreate = vi.fn(async (_url: string, _tagIds: readonly string[]) => true);
    const createdTag: TagDto = { ...tag, id: "tag-created", name: "Cloudflare", colorHue: 40 };
    const onCreateTag = vi.fn(async () => createdTag);
    const user = userEvent.setup();
    render(
      <ArticleComposer
        availableTags={[tag]}
        onCreate={onCreate}
        onCreateTag={onCreateTag}
        variant="mobile"
      />,
    );

    await user.click(screen.getByRole("button", { name: "追加" }));
    const dialog = screen.getByRole("dialog", { name: "記事を追加" });
    await user.click(screen.getByRole("checkbox", { name: "React" }));
    await user.type(screen.getByLabelText("新しいタグを作成して選択"), "Cloudflare");
    await user.click(screen.getByRole("button", { name: "タグを作成" }));
    expect(onCreateTag).toHaveBeenCalledWith("Cloudflare");
    expect((screen.getByRole("checkbox", { name: "Cloudflare" }) as HTMLInputElement).checked).toBe(
      true,
    );
    await user.type(screen.getByLabelText("記事URL"), "https://example.org/mobile");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(dialog.hasAttribute("open")).toBe(false));
    expect(onCreate).toHaveBeenCalledWith("https://example.org/mobile", [tag.id, createdTag.id]);

    await user.click(screen.getByRole("button", { name: "追加" }));
    expect((screen.getByRole("checkbox", { name: "React" }) as HTMLInputElement).checked).toBe(
      false,
    );
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(dialog.hasAttribute("open")).toBe(false));
  });
});

describe("Modal and article dialogs", () => {
  it.each([true, false])(
    "delayed autofocus respects an input selected inside the dialog (%s)",
    (selectOtherInput) => {
      let focusFrame: FrameRequestCallback | undefined;
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
        focusFrame = callback;
        return 1;
      });
      render(
        <Modal onClose={vi.fn()} open title="Focus test">
          <input data-autofocus aria-label="Initial input" />
          <input aria-label="Other input" />
        </Modal>,
      );
      const initial = screen.getByLabelText("Initial input");
      const other = screen.getByLabelText("Other input");
      expect(document.activeElement).toBe(initial);
      if (selectOtherInput) other.focus();
      else initial.blur();
      expect(focusFrame).toBeTypeOf("function");
      focusFrame?.(0);
      expect(document.activeElement).toBe(selectOtherInput ? other : initial);
    },
  );

  it("handles native cancellation and restores focus on close", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal description="Description" onClose={onClose} open title="Test dialog">
        <input data-autofocus aria-label="Dialog input" />
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Test dialog" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Dialog input")));

    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
    await userEvent.setup().click(screen.getByRole("button", { name: "Test dialogを閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <Modal description="Description" onClose={onClose} open={false} title="Test dialog">
        <input data-autofocus aria-label="Dialog input" />
      </Modal>,
    );
    await waitFor(() => expect(dialog.hasAttribute("open")).toBe(false));
  });

  it("closes an unchanged edit and exposes safe edit and delete failures", async () => {
    const onClose = vi.fn();
    const onSave = vi.fn(async () => {
      throw new Error("URLが競合しています。");
    });
    const user = userEvent.setup();
    render(<EditArticleDialog article={article} onClose={onClose} onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "変更を保存" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("タイトル"));
    await user.type(screen.getByLabelText("タイトル"), "Changed");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));
    expect(await screen.findByText("URLが競合しています。")).toBeTruthy();

    cleanup();
    const onConfirm = vi.fn(async () => {
      throw new Error("削除要求に失敗しました。");
    });
    render(<DeleteArticleDialog article={article} onClose={onClose} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "削除する" }));
    expect(await screen.findByText("削除要求に失敗しました。")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
