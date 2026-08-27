import { expect, type Page, test } from "@playwright/test";

type TestArticle = {
  id: string;
  originalUrl: string;
  canonicalUrl: null;
  title: string | null;
  titleIsManual: boolean;
  siteName: string | null;
  description: string | null;
  faviconUrl: null;
  imageUrl: null;
  publishedAt: null;
  status: "unread" | "read";
  metadataStatus: "pending" | "ready" | "failed";
  metadataErrorCode: null;
  metadataAttemptCount: number;
  metadataFetchedAt: string | null;
  savedAt: string;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const now = "2026-08-27T01:02:03.000Z";
const unsafeTitle = '<img src=x onerror="window.pwned=true">';

function fixture(overrides: Partial<TestArticle> = {}): TestArticle {
  return {
    id: "article-1",
    originalUrl: "https://example.com/articles/one",
    canonicalUrl: null,
    title: unsafeTitle,
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
    metadataFetchedAt: now,
    savedAt: now,
    readAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function mockArticleApi(page: Page) {
  let articles = [fixture()];

  await page.route("**/api/v1/articles**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const detailMatch = url.pathname.match(/^\/api\/v1\/articles\/([^/]+)$/);

    if (url.pathname === "/api/v1/articles" && method === "GET") {
      const status = url.searchParams.get("status") ?? "all";
      const query = (url.searchParams.get("q") ?? "").toLocaleLowerCase("ja-JP");
      const visible = articles.filter((article) => {
        if (status !== "all" && article.status !== status) return false;
        if (query === "") return true;
        return [article.title, article.originalUrl, article.siteName].some((value) =>
          value?.toLocaleLowerCase("ja-JP").includes(query),
        );
      });
      await route.fulfill({ json: { articles: visible, nextCursor: null } });
      return;
    }

    if (url.pathname === "/api/v1/articles" && method === "POST") {
      const body = request.postDataJSON() as { url: string };
      const article = fixture({
        id: `article-${articles.length + 1}`,
        originalUrl: body.url,
        title: null,
        siteName: new URL(body.url).hostname,
        metadataStatus: "pending",
        metadataAttemptCount: 0,
        metadataFetchedAt: null,
      });
      articles = [article, ...articles];
      await route.fulfill({ json: { result: "created", article }, status: 201 });
      return;
    }

    if (detailMatch !== null && method === "PATCH") {
      const id = decodeURIComponent(detailMatch[1] ?? "");
      const body = request.postDataJSON() as {
        title?: string;
        url?: string;
        status?: "unread" | "read";
      };
      const current = articles.find((article) => article.id === id);
      if (current === undefined) {
        await route.fulfill({ json: { error: "missing" }, status: 404 });
        return;
      }
      const article: TestArticle = {
        ...current,
        originalUrl: body.url ?? current.originalUrl,
        title: body.title ?? current.title,
        titleIsManual: body.title === undefined ? current.titleIsManual : true,
        status: body.status ?? current.status,
        readAt: body.status === "read" ? now : body.status === "unread" ? null : current.readAt,
        updatedAt: now,
      };
      articles = articles.map((item) => (item.id === id ? article : item));
      await route.fulfill({ json: { article } });
      return;
    }

    if (detailMatch !== null && method === "DELETE") {
      const id = decodeURIComponent(detailMatch[1] ?? "");
      articles = articles.filter((article) => article.id !== id);
      await route.fulfill({ json: { result: "deleted" } });
      return;
    }

    await route.fallback();
  });
}

test.beforeEach(async ({ page }) => {
  await mockArticleApi(page);
});

test("static assets and API responses include the security policy", async ({ page }) => {
  const pageResponse = await page.goto("/");
  const healthResponse = await page.request.get("/api/v1/health");

  for (const response of [pageResponse, healthResponse]) {
    expect(response).not.toBeNull();
    const headers = response?.headers() ?? {};
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(headers["strict-transport-security"]).toBe("max-age=31536000");
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow, noarchive");
  }

  const robotsResponse = await page.request.get("/robots.txt");
  expect(await robotsResponse.text()).toContain("Disallow: /");
});

test("article text is safe, read state can be undone, and layout does not overflow", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "未読の記事" })).toBeVisible();
  await expect(page.getByRole("link", { name: unsafeTitle })).toBeVisible();
  await expect(page.locator("article img, article script")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  if (testInfo.project.name === "mobile-chrome-320") {
    const addButton = page.getByRole("button", { name: "追加" });
    await addButton.press("Enter");
    const addDialog = page.getByRole("dialog", { name: "記事を追加" });
    await expect(addDialog).toBeVisible();
    await expect(addDialog.getByLabel("記事URL")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(addButton).toBeFocused();
    await expect(page.getByRole("navigation", { name: "モバイルナビゲーション" })).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "メインナビゲーション" })).toBeVisible();
    await expect(page.getByLabel("保存する記事のURL")).toBeVisible();
  }

  const card = page.locator("article").filter({ hasText: unsafeTitle });
  await card.getByRole("button", { name: "既読にする" }).press("Enter");
  await expect(page.getByText("記事を既読にしました。")).toBeVisible();
  await expect(page.getByRole("link", { name: unsafeTitle })).toHaveCount(0);
  await page.getByRole("button", { name: "元に戻す" }).press("Enter");
  await expect(page.getByRole("link", { name: unsafeTitle })).toBeVisible();
});

test("add, search, edit, delete, and settings routes work", async ({ page }, testInfo) => {
  await page.goto("/");

  const newUrl = "https://playwright.dev/docs/testing";
  if (testInfo.project.name === "mobile-chrome-320") {
    await page.getByRole("button", { name: "追加" }).click();
    const addDialog = page.getByRole("dialog", { name: "記事を追加" });
    await addDialog.getByLabel("記事URL").fill(newUrl);
    await addDialog.getByRole("button", { name: "保存" }).click();
  } else {
    await page.getByLabel("保存する記事のURL").fill(newUrl);
    await page.getByRole("button", { name: "保存" }).click();
  }
  await expect(page.getByText("記事を保存しました。")).toBeVisible();
  await expect(page.getByRole("link", { name: newUrl })).toBeVisible();

  await page.getByRole("link", { name: "すべて" }).click();
  await expect(page).toHaveURL(/\/articles$/);
  await page.getByRole("searchbox", { name: "記事を検索" }).fill("playwright");
  await page.getByRole("button", { name: "検索" }).click();
  await expect(page.getByRole("link", { name: newUrl })).toBeVisible();
  await expect(page.getByRole("link", { name: unsafeTitle })).toHaveCount(0);

  const card = page.locator("article").filter({ hasText: newUrl });
  await card.locator("summary").click();
  await card.getByRole("button", { name: "編集" }).click();
  const dialog = page.getByRole("dialog", { name: "記事を編集" });
  await dialog.getByLabel("タイトル").fill("編集済みのPlaywright記事");
  await dialog.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByRole("link", { name: "編集済みのPlaywright記事" })).toBeVisible();

  const editedCard = page.locator("article").filter({ hasText: "編集済みのPlaywright記事" });
  await editedCard.locator("summary").click();
  await editedCard.getByRole("button", { name: "削除" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "記事を削除しますか？" });
  await deleteDialog.getByRole("button", { name: "削除する" }).click();
  await expect(page.getByText("記事を削除しました。")).toBeVisible();
  await expect(page.getByRole("link", { name: "編集済みのPlaywright記事" })).toHaveCount(0);

  await page.getByRole("link", { name: "設定" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
});
