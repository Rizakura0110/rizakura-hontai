// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PortalPage } from "./PortalPage";

afterEach(cleanup);

describe("rizakura-hontai portal", () => {
  it("links to Tech Inbox without presenting Daymark as available", () => {
    render(<PortalPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("今日も、自分のペースで。");
    expect(screen.getByRole("link", { name: "Tech Inboxを開く" }).getAttribute("href")).toBe(
      "/tech-inbox/",
    );
    expect(screen.getByRole("heading", { name: "Daymark" })).toBeTruthy();
    expect(screen.getByText("準備中")).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
