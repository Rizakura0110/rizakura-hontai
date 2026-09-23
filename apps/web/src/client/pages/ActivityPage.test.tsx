// @vitest-environment jsdom

import { ActivityPage } from "@rizakura-hontai/tech-inbox/app";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { articleActivityFixture } from "../../../../../packages/tech-inbox/test/contracts/fixtures";
import { renderTechInbox as render } from "../tech-inbox.test-support";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const populated = articleActivityFixture({
  totalReadCount: 20,
  days: [
    { date: "2026-09-08", count: 1 },
    { date: "2026-09-09", count: 3 },
    { date: "2026-09-10", count: 5 },
    { date: "2026-09-11", count: 8 },
    { date: "2026-09-12", count: 1 },
  ],
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ActivityPage", () => {
  it("shows loading, summaries, every day and all five grass levels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(populated)),
    );
    render(<ActivityPage />);
    expect(screen.getByText("活動を読み込んでいます…")).toBeTruthy();
    const calendar = await screen.findByRole("group", { name: "直近365日の既読活動" });
    expect(within(calendar).getAllByRole("button")).toHaveLength(365);
    expect(screen.getByText("既読記事").closest("div")?.textContent).toContain("20件");
    expect(screen.getByText("今月").closest("div")?.textContent).toContain("18件");
    expect(screen.getByText("連続").closest("div")?.textContent).toContain("5日");
    for (const [date, color] of [
      ["7", "slate-100"],
      ["8", "emerald-200"],
      ["9", "emerald-400"],
      ["10", "emerald-600"],
      ["11", "emerald-900"],
    ]) {
      expect(
        within(calendar).getByRole("button", { name: new RegExp(`2026年9月${date}日:`) }).className,
      ).toContain(color);
    }
    expect(screen.getByText(/未読に戻す・記事を削除すると元の日の草が減り/u)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("2026年9月12日");
  });

  it("uses one tab stop, keyboard date navigation, boundary clamping and direct date selection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(populated)),
    );
    const user = userEvent.setup();
    render(<ActivityPage />);
    const calendar = await screen.findByRole("group", { name: "直近365日の既読活動" });
    const days = within(calendar).getAllByRole("button");
    const today = days.at(-1) as HTMLButtonElement;
    expect(days.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    today.focus();
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("2026年9月11日: 8件既読");
    await user.keyboard("{ArrowLeft}{ArrowRight}{ArrowDown}");
    expect(document.activeElement).toBe(today);
    await user.keyboard("{ArrowDown}{End}");
    expect(document.activeElement).toBe(today);
    await user.keyboard("{Home}{ArrowLeft}{ArrowUp}");
    expect(document.activeElement).toBe(days[0]);
    await user.keyboard("{End}");
    await user.click(days[363] as HTMLButtonElement);
    expect(screen.getByRole("status").textContent).toContain("8件");
    fireEvent.change(screen.getByLabelText("日付を確認"), { target: { value: "2026-09-10" } });
    expect(screen.getByRole("status").textContent).toContain("5件");
    expect(days[362]?.getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(screen.getByLabelText("日付を確認"), { target: { value: "2024-01-01" } });
    expect(screen.getByRole("status").textContent).toContain("5件");
    await user.click(screen.getByRole("button", { name: "更新" }));
    await screen.findByRole("group", { name: "直近365日の既読活動" });
  });

  it("distinguishes a new library from reads older than the displayed year", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(articleActivityFixture()))
        .mockResolvedValueOnce(json(articleActivityFixture({ totalReadCount: 2, days: [] }))),
    );
    const user = userEvent.setup();
    render(<ActivityPage />);
    expect(await screen.findByText(/まだ既読の記事はありません/u)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "更新" }));
    expect(await screen.findByText("この365日間に既読にした記事はありません。")).toBeTruthy();
    expect(screen.queryByText(/まだ既読の記事はありません/u)).toBeNull();
  });

  it("shows a safe error, retries, and does not leave stale counts after a failed refresh", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json(
          {
            error: {
              code: "UNAUTHORIZED",
              message: "認証情報を確認できませんでした。",
              requestId: "123e4567-e89b-42d3-a456-426614174000",
            },
          },
          401,
        ),
      )
      .mockResolvedValueOnce(json(populated))
      .mockRejectedValueOnce(new Error("private error"));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ActivityPage />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "認証情報を確認できませんでした。",
    );
    await user.click(screen.getByRole("button", { name: "再読み込み" }));
    await screen.findByRole("group", { name: "直近365日の既読活動" });
    await user.click(screen.getByRole("button", { name: "更新" }));
    expect((await screen.findByRole("alert")).textContent).not.toContain("private error");
    expect(screen.queryByRole("group", { name: "直近365日の既読活動" })).toBeNull();
  });

  it("aborts an unfinished request when leaving the page", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_path: string, init: RequestInit) => {
        signal = init.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) =>
          signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        );
      }),
    );
    const view = render(<ActivityPage />);
    await waitFor(() => expect(signal).toBeDefined());
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
