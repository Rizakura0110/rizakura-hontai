import type {
  DailyHabitDto,
  DaymarkBackupImportSummary,
  DaymarkBackupSnapshot,
  DayResponse,
  HabitDto,
  PutHabitConfigurationRequest,
  PutHabitRecordRequest,
} from "@rizakura-hontai/daymark/contracts";
import { expect, type Page, test } from "@playwright/test";

const today = new Date(Date.now() + 9 * 60 * 60 * 1_000).toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);
const timestamp = `${today}T00:00:00.000Z`;

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysInMonth(month: string): number {
  const value = new Date(`${month}-01T00:00:00.000Z`);
  value.setUTCMonth(value.getUTCMonth() + 1);
  value.setUTCDate(0);
  return value.getUTCDate();
}

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00.000Z`));
}

function checkHabit(overrides: Partial<HabitDto> = {}): HabitDto {
  return {
    id: "habit-water",
    name: "水を飲む",
    createdOn: today,
    configuration: { kind: "check", status: "active", effectiveFrom: today },
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function numberHabit(): HabitDto {
  return {
    id: "habit-walk",
    name: "歩く",
    createdOn: today,
    configuration: {
      kind: "number",
      status: "active",
      effectiveFrom: today,
      target: 8000,
      unit: "歩",
      comparison: "at_least",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function dayFor(habits: readonly HabitDto[], records: ReadonlyMap<string, PutHabitRecordRequest>) {
  const daily: DailyHabitDto[] = habits
    .filter(({ configuration }) => configuration.status === "active")
    .map((habit) => {
      const record = records.get(habit.id) ?? null;
      const complete =
        record?.kind === "check"
          ? record.checked
          : record?.kind === "number" && habit.configuration.kind === "number"
            ? habit.configuration.comparison === "at_least"
              ? record.value >= habit.configuration.target
              : record.value <= habit.configuration.target
            : false;
      return {
        habitId: habit.id,
        name: habit.name,
        date: today,
        configuration: habit.configuration,
        record,
        state: record === null ? "unentered" : complete ? "complete" : "incomplete",
      };
    });
  const complete = daily.filter(({ state }) => state === "complete").length;
  const incomplete = daily.filter(({ state }) => state === "incomplete").length;
  const unentered = daily.filter(({ state }) => state === "unentered").length;
  return {
    date: today,
    habits: daily,
    summary: {
      date: today,
      complete,
      incomplete,
      unentered,
      due: daily.length,
      rate: daily.length === 0 ? null : Math.round((complete / daily.length) * 100),
    },
  } satisfies DayResponse;
}

async function mockDaymarkApi(page: Page) {
  let habits = [checkHabit(), numberHabit()];
  const records = new Map<string, PutHabitRecordRequest>();

  const exportBackup = (): DaymarkBackupSnapshot => ({
    product: "daymark",
    schemaVersion: 1,
    exportedAt: timestamp,
    habits: habits.map((habit) => ({
      id: habit.id,
      name: habit.name,
      kind: habit.configuration.kind,
      createdOn: habit.createdOn,
      createdAt: habit.createdAt,
      updatedAt: habit.updatedAt,
    })),
    habitVersions: habits.map((habit) =>
      habit.configuration.kind === "check"
        ? {
            id: `version-${habit.id}`,
            habitId: habit.id,
            effectiveFrom: habit.configuration.effectiveFrom,
            kind: "check",
            status: habit.configuration.status,
            targetMilli: null,
            unit: null,
            comparison: null,
            createdAt: habit.createdAt,
            updatedAt: habit.updatedAt,
          }
        : {
            id: `version-${habit.id}`,
            habitId: habit.id,
            effectiveFrom: habit.configuration.effectiveFrom,
            kind: "number",
            status: habit.configuration.status,
            targetMilli: Math.round(habit.configuration.target * 1_000),
            unit: habit.configuration.unit,
            comparison: habit.configuration.comparison,
            createdAt: habit.createdAt,
            updatedAt: habit.updatedAt,
          },
    ),
    records: [...records].map(([habitId, record], index) =>
      record.kind === "check"
        ? {
            id: `record-${index}`,
            habitId,
            recordDate: today,
            kind: "check",
            checked: record.checked,
            valueMilli: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          }
        : {
            id: `record-${index}`,
            habitId,
            recordDate: today,
            kind: "number",
            checked: null,
            valueMilli: Math.round(record.value * 1_000),
            createdAt: timestamp,
            updatedAt: timestamp,
          },
    ),
  });

  const importSummary = (backup: DaymarkBackupSnapshot): DaymarkBackupImportSummary => ({
    source: {
      schemaVersion: 1,
      exportedAt: backup.exportedAt,
      habits: backup.habits.length,
      habitVersions: backup.habitVersions.length,
      records: backup.records.length,
    },
    changes: {
      habitsCreated: backup.habits.length,
      habitsMatched: 0,
      habitIdsRemapped: 0,
      habitVersionsCreated: backup.habitVersions.length,
      habitVersionsMatched: 0,
      habitVersionsSkipped: 0,
      habitVersionIdsRemapped: 0,
      recordsCreated: backup.records.length,
      recordsMatched: 0,
      recordsSkipped: 0,
      recordIdsRemapped: 0,
    },
    hasChanges:
      backup.habits.length > 0 || backup.habitVersions.length > 0 || backup.records.length > 0,
  });

  await page.route("**/api/v1/daymark/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const habitMatch = url.pathname.match(/^\/api\/v1\/daymark\/habits\/([^/]+)$/u);
    const configurationMatch = url.pathname.match(
      /^\/api\/v1\/daymark\/habits\/([^/]+)\/configurations\/([^/]+)$/u,
    );
    const recordMatch = url.pathname.match(
      /^\/api\/v1\/daymark\/habits\/([^/]+)\/records\/([^/]+)$/u,
    );

    if (url.pathname === "/api/v1/daymark/export" && method === "GET") {
      await route.fulfill({ json: exportBackup() });
      return;
    }
    if (
      ["/api/v1/daymark/import/preview", "/api/v1/daymark/import"].includes(url.pathname) &&
      method === "POST"
    ) {
      const body = request.postDataJSON() as { backup: DaymarkBackupSnapshot };
      await route.fulfill({
        json: {
          result: url.pathname.endsWith("/preview") ? "preview" : "imported",
          summary: importSummary(body.backup),
        },
      });
      return;
    }

    if (url.pathname === "/api/v1/daymark/habits" && method === "GET") {
      await route.fulfill({ json: { habits } });
      return;
    }
    if (url.pathname === "/api/v1/daymark/habits" && method === "POST") {
      const requestBody = request.postDataJSON() as {
        name: string;
        kind: "check" | "number";
        target?: number;
        unit?: string;
        comparison?: "at_least" | "at_most";
      };
      const habit: HabitDto = {
        ...checkHabit({ id: `habit-${habits.length + 1}`, name: requestBody.name }),
        configuration:
          requestBody.kind === "check"
            ? { kind: "check", status: "active", effectiveFrom: today }
            : {
                kind: "number",
                status: "active",
                effectiveFrom: today,
                target: requestBody.target ?? 1,
                unit: requestBody.unit ?? "回",
                comparison: requestBody.comparison ?? "at_least",
              },
      };
      habits = [...habits, habit];
      await route.fulfill({ json: { habit }, status: 201 });
      return;
    }
    if (habitMatch !== null && method === "PATCH") {
      const id = decodeURIComponent(habitMatch[1] ?? "");
      const body = request.postDataJSON() as { name: string };
      habits = habits.map((habit) => (habit.id === id ? { ...habit, name: body.name } : habit));
      await route.fulfill({ json: { habit: habits.find((habit) => habit.id === id) } });
      return;
    }
    if (configurationMatch !== null && method === "PUT") {
      const id = decodeURIComponent(configurationMatch[1] ?? "");
      const body = request.postDataJSON() as PutHabitConfigurationRequest;
      habits = habits.map((habit) =>
        habit.id === id ? { ...habit, configuration: { ...body, effectiveFrom: today } } : habit,
      );
      await route.fulfill({ json: { habit: habits.find((habit) => habit.id === id) } });
      return;
    }
    if (url.pathname === "/api/v1/daymark/day" && method === "GET") {
      await route.fulfill({ json: dayFor(habits, records) });
      return;
    }
    if (recordMatch !== null && method === "PUT") {
      records.set(
        decodeURIComponent(recordMatch[1] ?? ""),
        request.postDataJSON() as PutHabitRecordRequest,
      );
      await route.fulfill({ json: dayFor(habits, records) });
      return;
    }
    if (recordMatch !== null && method === "DELETE") {
      records.delete(decodeURIComponent(recordMatch[1] ?? ""));
      await route.fulfill({ json: { result: "deleted" } });
      return;
    }
    if (url.pathname === "/api/v1/daymark/history/week") {
      const start = url.searchParams.get("start") ?? today;
      const dates = Array.from({ length: 7 }, (_, index) => addDays(start, index));
      await route.fulfill({
        json: {
          start: dates[0],
          end: dates[6],
          days: dates.map((date) => ({
            date,
            complete: date === today ? 1 : 0,
            incomplete: 0,
            unentered: date === today ? 1 : 0,
            due: date === today ? 2 : 0,
            rate: date === today ? 50 : null,
          })),
          habits: [],
          summary: {
            complete: 1,
            incomplete: 0,
            unentered: 1,
            due: 2,
            rate: 50,
            perfectDays: 0,
          },
        },
      });
      return;
    }
    if (url.pathname === "/api/v1/daymark/history/month") {
      const requestedMonth = url.searchParams.get("month") ?? currentMonth;
      const monthDays = Array.from({ length: daysInMonth(requestedMonth) }, (_, index) => {
        const date = `${requestedMonth}-${String(index + 1).padStart(2, "0")}`;
        return {
          date,
          complete: date === today ? 1 : 0,
          incomplete: 0,
          unentered: date === today ? 1 : 0,
          due: date === today ? 2 : 0,
          rate: date === today ? 50 : null,
        };
      });
      await route.fulfill({
        json: {
          month: requestedMonth,
          days: monthDays,
          summary: {
            complete: 1,
            incomplete: 0,
            unentered: 1,
            due: 2,
            rate: 50,
            perfectDays: 0,
          },
        },
      });
      return;
    }
    await route.fulfill({ json: { error: "unexpected Daymark request" }, status: 500 });
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${today}T03:00:00+09:00`));
  await mockDaymarkApi(page);
});

test("Daymark records habits and switches between daily, weekly, monthly, and management views", async ({
  page,
}, testInfo) => {
  await page.goto("/daymark/");
  await expect(page).toHaveTitle("Daymark");
  await expect(page.getByRole("heading", { name: "今日の記録" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "水を飲む" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole("button", { name: "✓ 達成" }).click();
  await expect(page.getByRole("button", { name: "✓ 達成" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByLabel("記録する数値").fill("9000");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();

  const mobile = testInfo.project.name === "mobile-chrome-320";
  const navigation = page.getByRole("navigation", {
    name: mobile ? "Daymark モバイルナビゲーション" : "Daymark メインナビゲーション",
  });
  await navigation.getByRole("button", { name: "履歴" }).click();
  await expect(page.getByRole("heading", { name: "履歴" })).toBeVisible();
  await expect(page.getByRole("table", { name: "週ごとの習慣達成状況" })).toBeVisible();
  await page.getByRole("button", { name: "月", exact: true }).click();
  await expect(page.getByLabel(`${monthLabel(currentMonth)}の達成カレンダー`)).toBeVisible();

  await navigation.getByRole("button", { name: "習慣管理" }).click();
  await expect(page.getByRole("heading", { name: "習慣管理" })).toBeVisible();
  await page.getByRole("button", { name: "＋ 習慣を追加" }).click();
  const addDialog = page.getByRole("dialog", { name: "習慣を追加" });
  await addDialog.getByLabel("習慣名").fill("ストレッチ");
  await addDialog.getByRole("button", { name: "追加する" }).click();
  await expect(page.getByRole("heading", { name: "ストレッチ" })).toBeVisible();

  const waterCard = page.locator("article").filter({ hasText: "水を飲む" });
  await waterCard.getByRole("button", { name: "編集" }).click();
  const editDialog = page.getByRole("dialog", { name: "習慣を編集" });
  await editDialog.getByLabel("習慣名").fill("白湯を飲む");
  await editDialog.getByLabel("状態").selectOption("paused");
  await editDialog.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByRole("heading", { name: "白湯を飲む" })).toBeVisible();
  const renamedCard = page.locator("article").filter({ hasText: "白湯を飲む" });
  await expect(renamedCard.getByText("休止", { exact: true })).toBeVisible();

  await navigation.getByRole("button", { name: "設定" }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  await expect(page.getByText("JSONバックアップ", { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(`daymark-export-${today}.json`);

  const restoreBackup: DaymarkBackupSnapshot = {
    product: "daymark",
    schemaVersion: 1,
    exportedAt: timestamp,
    habits: [
      {
        id: "habit-restored",
        name: "復元する習慣",
        kind: "check",
        createdOn: today,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    habitVersions: [
      {
        id: "version-restored",
        habitId: "habit-restored",
        effectiveFrom: today,
        kind: "check",
        status: "active",
        targetMilli: null,
        unit: null,
        comparison: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    records: [],
  };
  await page.getByLabel("Daymarkバックアップファイル（4MB以下）").setInputFiles({
    name: "daymark-restore.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(restoreBackup)),
  });
  await page.getByRole("button", { name: "復元内容を確認" }).click();
  await expect(page.getByText("復元プレビュー")).toBeVisible();
  await page
    .getByRole("checkbox", { name: "既存データを上書きしないマージ内容を確認しました" })
    .check();
  await page.getByRole("button", { name: "安全に復元する" }).click();
  await expect(page.getByText("Daymarkバックアップを安全に復元しました。")).toBeVisible();
});

test("Daymark has an independent install document, manifest, and icons", async ({ page }) => {
  await page.goto("/daymark");
  await expect(page).toHaveURL(/\/daymark\/$/u);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/daymark/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "crossorigin",
    "use-credentials",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/daymark/icons/apple-touch-icon.png",
  );

  const manifest = await page.request.get("/daymark/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  await expect(manifest.json()).resolves.toMatchObject({
    id: "/daymark/",
    name: "Daymark",
    short_name: "Daymark",
    start_url: "/daymark/",
    scope: "/daymark/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#2563eb",
  });

  for (const icon of [
    "/daymark/icons/apple-touch-icon.png",
    "/daymark/icons/icon-192.png",
    "/daymark/icons/icon-512.png",
    "/daymark/icons/icon-maskable-512.png",
  ]) {
    const response = await page.request.get(icon);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect((await response.body()).byteLength).toBeGreaterThan(1_000);
  }

  const html = await page.request.get("/daymark/");
  const body = await html.text();
  expect(body).toContain("<title>Daymark</title>");
  expect(body).not.toContain("<title>Tech Inbox</title>");
});
