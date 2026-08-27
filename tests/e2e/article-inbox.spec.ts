import { readFile } from "node:fs/promises";
import type { ArticleDto } from "@tech-inbox/contracts";
import { expect, type Page, test } from "@playwright/test";

type MetadataTransition = "ready" | "failed";

const now = "2026-08-27T01:02:03.000Z";
const unsafeTitle = '<img src=x onerror="window.pwned=true">';

function fixture(overrides: Partial<ArticleDto> = {}): ArticleDto {
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
  const metadataTransitions = new Map<string, MetadataTransition>();

  await page.route("**/api/v1/export", async (route) => {
    const exportedAt = now;
    await route.fulfill({
      body: JSON.stringify({
        schemaVersion: 1,
        exportedAt,
        articles,
        articleUrls: articles.map((article) => ({
          normalizedUrl: article.originalUrl,
          articleId: article.id,
          kind: "original",
          createdAt: article.createdAt,
        })),
      }),
      headers: {
        "Content-Disposition": 'attachment; filename="tech-inbox-export-2026-08-27.json"',
        "Content-Type": "application/json",
      },
      status: 200,
    });
  });

  await page.route("**/api/v1/articles**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const detailMatch = url.pathname.match(/^\/api\/v1\/articles\/([^/]+)$/);

    if (url.pathname === "/api/v1/articles" && method === "GET") {
      articles = articles.map((article) => {
        const transition = metadataTransitions.get(article.id);
        if (article.metadataStatus !== "pending" || transition === undefined) return article;

        metadataTransitions.delete(article.id);
        return transition === "ready"
          ? {
              ...article,
              title: `取得済み: ${new URL(article.originalUrl).hostname}`,
              metadataStatus: "ready",
              metadataAttemptCount: 1,
              metadataFetchedAt: now,
              updatedAt: now,
            }
          : {
              ...article,
              metadataStatus: "failed",
              metadataErrorCode: "NETWORK_ERROR",
              metadataAttemptCount: 3,
              metadataFetchedAt: now,
              updatedAt: now,
            };
      });
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
      const existing = articles.find((article) => article.originalUrl === body.url);
      if (existing !== undefined) {
        await route.fulfill({ json: { result: "alreadyExists", article: existing }, status: 200 });
        return;
      }
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
      if (body.url.includes("metadata-ready")) metadataTransitions.set(article.id, "ready");
      if (body.url.includes("metadata-failed")) metadataTransitions.set(article.id, "failed");
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
      if (
        body.url !== undefined &&
        articles.some((article) => article.id !== id && article.originalUrl === body.url)
      ) {
        await route.fulfill({
          json: {
            error: {
              code: "URL_CONFLICT",
              message: "このURLは別の記事として登録されています。",
              requestId: "123e4567-e89b-42d3-a456-426614174000",
            },
          },
          status: 409,
        });
        return;
      }
      const article: ArticleDto = {
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

async function addArticle(page: Page, mobile: boolean, url: string) {
  if (mobile) {
    await page.getByRole("button", { name: "追加" }).click();
    const addDialog = page.getByRole("dialog", { name: "記事を追加" });
    await addDialog.getByLabel("記事URL").fill(url);
    await addDialog.getByRole("button", { name: "保存" }).click();
    return;
  }

  await page.getByLabel("保存する記事のURL").fill(url);
  await page.getByRole("button", { name: "保存" }).click();
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

  const unauthorizedResponse = await page.request.get("/api/v1/articles");
  expect(unauthorizedResponse.status()).toBe(403);
  await expect(unauthorizedResponse.json()).resolves.toMatchObject({
    error: { code: "FORBIDDEN" },
  });
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
  await addArticle(page, testInfo.project.name === "mobile-chrome-320", newUrl);
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
  await expect(page.getByText("保存記事数").locator("..").getByText("1件")).toBeVisible();
  await expect(page.getByText("未読記事数").locator("..").getByText("1件")).toBeVisible();
  await expect(page.getByText("JSON schema v1")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tech-inbox-export-2026-08-27.json");
  const downloadPath = await download.path();
  if (downloadPath === null) throw new Error("The export download did not produce a local file.");
  const exported = JSON.parse(await readFile(downloadPath, "utf8")) as Record<string, unknown>;
  expect(Object.keys(exported).sort()).toEqual([
    "articleUrls",
    "articles",
    "exportedAt",
    "schemaVersion",
  ]);
  expect(exported.schemaVersion).toBe(1);
  expect(exported.articles).toHaveLength(1);
  expect(exported.articleUrls).toHaveLength(1);
  expect(JSON.stringify(exported)).not.toContain("TEAM_DOMAIN");
  expect(JSON.stringify(exported)).not.toContain("ALLOWED_EMAIL");
  expect(JSON.stringify(exported)).not.toContain("POLICY_AUD");
});

test("duplicate registration, read filter, and returning an article to unread work", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await addArticle(
    page,
    testInfo.project.name === "mobile-chrome-320",
    "https://example.com/articles/one",
  );
  await expect(page.getByText("この記事はすでに登録されています。")).toBeVisible();
  await expect(page.getByRole("link", { name: "記事を見る" })).toHaveAttribute(
    "href",
    "https://example.com/articles/one",
  );

  await page.getByRole("button", { name: "既読にする" }).click();
  await page.getByRole("link", { name: "すべて" }).click();
  await page.getByRole("group", { name: "記事の状態" }).getByText("既読", { exact: true }).click();
  await expect(page.getByRole("link", { name: unsafeTitle })).toBeVisible();

  await page.getByRole("button", { name: "未読に戻す" }).click();
  await expect(page.getByText("記事を未読に戻しました。")).toBeVisible();
  await expect(page.getByRole("link", { name: unsafeTitle })).toHaveCount(0);
});

test("metadata polling reaches both ready and failed terminal states", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const mobile = testInfo.project.name === "mobile-chrome-320";

  const readyUrl = "https://metadata-ready.example.org/article";
  await addArticle(page, mobile, readyUrl);
  await expect(page.getByText("記事情報を取得しています……")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "取得済み: metadata-ready.example.org" }),
  ).toBeVisible({ timeout: 7_000 });

  const failedUrl = "https://metadata-failed.example.org/article";
  await addArticle(page, mobile, failedUrl);
  await expect(page.getByText("記事情報を取得しています……")).toBeVisible();
  await expect(page.getByText("タイトルを取得できませんでした")).toBeVisible({
    timeout: 7_000,
  });
});

test("editing an article URL reports a conflict without losing the original", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const conflictingUrl = "https://conflict.example.org/article";
  await addArticle(page, testInfo.project.name === "mobile-chrome-320", conflictingUrl);

  const originalCard = page.locator("article").filter({ hasText: unsafeTitle });
  await originalCard.locator("summary").click();
  await originalCard.getByRole("button", { name: "編集" }).click();
  const dialog = page.getByRole("dialog", { name: "記事を編集" });
  await dialog.getByLabel("記事URL").fill(conflictingUrl);
  await dialog.getByRole("button", { name: "変更を保存" }).click();

  await expect(dialog.getByText("このURLは別の記事として登録されています。")).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("link", { name: unsafeTitle })).toHaveAttribute(
    "href",
    "https://example.com/articles/one",
  );
});
