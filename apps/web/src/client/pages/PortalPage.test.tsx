// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortalPage } from "./PortalPage";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const tokiUrl = "https://toki.sx7k2p9q.workers.dev/";
const hondanaUrl = "https://hondana.sx7k2p9q.workers.dev/";

describe("rizakura-hontai portal", () => {
  it("keeps independent products pending until their own origins are verified", () => {
    render(<PortalPage tokiUrl="" hondanaUrl="" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("今日も、自分のペースで。");
    expect(screen.getByRole("link", { name: "Tech Inboxを開く" }).getAttribute("href")).toBe(
      "/tech-inbox/",
    );
    expect(screen.getByRole("heading", { name: "Daymark" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Daymarkを開く" }).getAttribute("href")).toBe(
      "/daymark/",
    );
    expect(screen.getByRole("heading", { name: "Toki" })).toBeTruthy();
    expect(
      within(screen.getByRole("article", { name: "Toki" })).getByText("公開準備中"),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Hondana" })).toBeTruthy();
    expect(
      within(screen.getByRole("article", { name: "Hondana" })).getByText("公開準備中"),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Tokiを開く" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Hondanaを開く" })).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("adds only a verified same-account HTTPS Toki origin as a normal link", () => {
    render(<PortalPage tokiUrl={tokiUrl} hondanaUrl="" />);
    expect(screen.getByRole("link", { name: "Tokiを開く" }).getAttribute("href")).toBe(tokiUrl);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(
      within(screen.getByRole("article", { name: "Toki" })).queryByText("公開準備中"),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: "Hondanaを開く" })).toBeNull();
  });

  it.each([
    "http://toki.sx7k2p9q.workers.dev/",
    "https://other.workers.dev/",
    "https://toki.sx7k2p9q.workers.dev:8443/",
    "https://toki.sx7k2p9q.workers.dev/?next=elsewhere",
    "https://attacker@toki.sx7k2p9q.workers.dev/",
  ])("does not publish an unsafe Toki link: %s", (url) => {
    render(<PortalPage tokiUrl={url} hondanaUrl="" />);
    expect(screen.queryByRole("link", { name: "Tokiを開く" })).toBeNull();
    expect(
      within(screen.getByRole("article", { name: "Toki" })).getByText("公開準備中"),
    ).toBeTruthy();
  });

  it.each([hondanaUrl, hondanaUrl.slice(0, -1)])(
    "enables only the exact approved Hondana origin as a separate document link: %s",
    (url) => {
      render(<PortalPage tokiUrl={tokiUrl} hondanaUrl={url} />);
      const link = screen.getByRole("link", { name: "Hondanaを開く" });
      expect(link.getAttribute("href")).toBe(hondanaUrl);
      expect(link.getAttribute("target")).toBeNull();
      expect(screen.getByRole("link", { name: "Tokiを開く" }).getAttribute("href")).toBe(tokiUrl);
      expect(screen.getAllByRole("link")).toHaveLength(4);
      expect(screen.queryByText("公開準備中")).toBeNull();
    },
  );

  it.each([
    "",
    "not a URL",
    "http://hondana.sx7k2p9q.workers.dev/",
    "//hondana.sx7k2p9q.workers.dev/",
    "https://toki.sx7k2p9q.workers.dev/",
    "https://other.sx7k2p9q.workers.dev/",
    "https://hondana.other.workers.dev/",
    "https://hondana.sx7k2p9q.workers.dev.attacker.test/",
    "https://hondana.sx7k2p9q.workers.dev:443/",
    "https://hondana.sx7k2p9q.workers.dev:8443/",
    "https://hondana.sx7k2p9q.workers.dev/works",
    "https://hondana.sx7k2p9q.workers.dev/?next=elsewhere",
    "https://hondana.sx7k2p9q.workers.dev/#fragment",
    "https://attacker@hondana.sx7k2p9q.workers.dev/",
    "https://hondana.sx7k2p9q.workers.dev@attacker.test/",
    "javascript:alert(1)",
    ` ${hondanaUrl}`,
    `${hondanaUrl}\n`,
  ])("does not publish an unapproved Hondana link: %s", (url) => {
    render(<PortalPage tokiUrl={tokiUrl} hondanaUrl={url} />);
    expect(screen.queryByRole("link", { name: "Hondanaを開く" })).toBeNull();
    expect(
      within(screen.getByRole("article", { name: "Hondana" })).getByText("公開準備中"),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tokiを開く" }).getAttribute("href")).toBe(tokiUrl);
  });

  it("fails closed when the Hondana build variable is absent", () => {
    vi.stubEnv("VITE_HONDANA_URL", undefined);
    render(<PortalPage tokiUrl={tokiUrl} />);
    expect(screen.queryByRole("link", { name: "Hondanaを開く" })).toBeNull();
    expect(
      within(screen.getByRole("article", { name: "Hondana" })).getByText("公開準備中"),
    ).toBeTruthy();
  });

  it("uses the independently configured Hondana build variable without enabling Toki", () => {
    vi.stubEnv("VITE_HONDANA_URL", hondanaUrl);
    render(<PortalPage tokiUrl="" />);
    expect(screen.getByRole("link", { name: "Hondanaを開く" }).getAttribute("href")).toBe(
      hondanaUrl,
    );
    expect(screen.queryByRole("link", { name: "Tokiを開く" })).toBeNull();
    expect(
      within(screen.getByRole("article", { name: "Toki" })).getByText("公開準備中"),
    ).toBeTruthy();
  });
});
