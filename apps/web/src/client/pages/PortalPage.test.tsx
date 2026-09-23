// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PortalPage } from "./PortalPage";

afterEach(cleanup);

describe("rizakura-hontai portal", () => {
  it("keeps Toki visibly pending until its own origin is verified", () => {
    render(<PortalPage tokiUrl="" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("今日も、自分のペースで。");
    expect(screen.getByRole("link", { name: "Tech Inboxを開く" }).getAttribute("href")).toBe(
      "/tech-inbox/",
    );
    expect(screen.getByRole("heading", { name: "Daymark" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Daymarkを開く" }).getAttribute("href")).toBe(
      "/daymark/",
    );
    expect(screen.getByRole("heading", { name: "Toki" })).toBeTruthy();
    expect(screen.getByText("公開準備中")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Tokiを開く" })).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("adds only a verified same-account HTTPS Toki origin as a normal link", () => {
    const url = "https://toki.sx7k2p9q.workers.dev/";
    render(<PortalPage tokiUrl={url} />);
    expect(screen.getByRole("link", { name: "Tokiを開く" }).getAttribute("href")).toBe(url);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.queryByText("公開準備中")).toBeNull();
  });

  it.each([
    "http://toki.sx7k2p9q.workers.dev/",
    "https://other.workers.dev/",
    "https://toki.sx7k2p9q.workers.dev:8443/",
    "https://toki.sx7k2p9q.workers.dev/?next=elsewhere",
    "https://attacker@toki.sx7k2p9q.workers.dev/",
  ])("does not publish an unsafe Toki link: %s", (url) => {
    render(<PortalPage tokiUrl={url} />);
    expect(screen.queryByRole("link", { name: "Tokiを開く" })).toBeNull();
    expect(screen.getByText("公開準備中")).toBeTruthy();
  });
});
