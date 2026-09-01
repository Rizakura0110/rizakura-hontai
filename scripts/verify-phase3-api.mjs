import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const projectRoot = realpathSync(dirname(dirname(fileURLToPath(import.meta.url))));

const assertDescendant = (parent, target, label) => {
  const relativePath = relative(parent, target);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`${label} must resolve inside the project workspace.`);
  }
};

const temporaryRootCandidate = join(projectRoot, ".tmp");
if (existsSync(temporaryRootCandidate)) {
  const status = lstatSync(temporaryRootCandidate);
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error("The project .tmp path must be a real directory.");
  }
} else {
  mkdirSync(temporaryRootCandidate, { mode: 0o700 });
}

const temporaryRoot = realpathSync(temporaryRootCandidate);
assertDescendant(projectRoot, temporaryRoot, "The project .tmp directory");

const pnpmCliCandidate = join(projectRoot, ".tools", "pnpm", "bin", "pnpm.cjs");
if (lstatSync(pnpmCliCandidate).isSymbolicLink()) {
  throw new Error("The project pnpm entrypoint must not be a symbolic link.");
}
const pnpmCli = realpathSync(pnpmCliCandidate);
assertDescendant(projectRoot, pnpmCli, "The pnpm entrypoint");

const persistenceDirectory = realpathSync(mkdtempSync(join(temporaryRoot, "d1-phase3-")));
assertDescendant(temporaryRoot, persistenceDirectory, "The D1 verification directory");

const childEnvironment = {
  PATH: [
    join(projectRoot, ".tools", "node", "bin"),
    join(projectRoot, ".tools", "pnpm", "bin"),
    join(projectRoot, "node_modules", ".bin"),
    join(projectRoot, "apps", "web", "node_modules", ".bin"),
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ].join(":"),
  XDG_CONFIG_HOME: join(projectRoot, ".config"),
  XDG_CACHE_HOME: join(projectRoot, ".cache"),
  XDG_DATA_HOME: join(projectRoot, ".local", "share"),
  TMPDIR: temporaryRoot,
  PNPM_HOME: join(projectRoot, ".tools", "pnpm"),
  COREPACK_HOME: join(projectRoot, ".tools", "corepack"),
  PLAYWRIGHT_BROWSERS_PATH: join(projectRoot, ".cache", "ms-playwright"),
  PNPM_CONFIG_NPMRC_AUTH_FILE: join(projectRoot, ".config", "pnpm-auth-empty"),
  CI: "1",
  NO_COLOR: "1",
  WRANGLER_SEND_METRICS: "false",
};

const runWrangler = (arguments_) => {
  const result = spawnSync(
    process.execPath,
    [pnpmCli, "--dir", "apps/web", "exec", "wrangler", ...arguments_],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: childEnvironment,
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Wrangler exited with ${result.status}.\n${output}`);
  }

  return output;
};

const port = 10_000 + (process.pid % 40_000);
const baseUrl = `http://127.0.0.1:${port}`;
const mutationHeaders = {
  "Content-Type": "application/json",
  Origin: baseUrl,
  "X-Tech-Inbox-Client": "web",
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

let workerProcess;
let workerOutput = "";

const appendWorkerOutput = (chunk) => {
  workerOutput = `${workerOutput}${chunk.toString()}`.slice(-2_000_000);
};

const waitForWorker = async () => {
  let lastResponse = "No HTTP response received.";

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (workerProcess.exitCode !== null) {
      throw new Error(`Wrangler dev exited before becoming ready.\n${workerOutput}`);
    }

    try {
      const healthResponse = await fetch(`${baseUrl}/api/v1/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      const articlesResponse = await fetch(`${baseUrl}/api/v1/articles`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (healthResponse.ok && articlesResponse.ok) return;
      lastResponse = `health=${healthResponse.status}, articles=${articlesResponse.status} ${await articlesResponse.text()}`;
    } catch {
      // The local listener is still starting.
    }

    await delay(100);
  }

  throw new Error(`Timed out waiting for Wrangler dev.\n${lastResponse}\n${workerOutput}`);
};

const stopWorker = async () => {
  if (workerProcess === undefined || workerProcess.exitCode !== null) return;

  workerProcess.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => workerProcess.once("exit", () => resolve(true))),
    delay(5_000).then(() => false),
  ]);

  if (!exited && workerProcess.exitCode === null) {
    workerProcess.kill("SIGKILL");
    await new Promise((resolve) => workerProcess.once("exit", resolve));
  }
};

const requestJson = async (path, init) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(5_000),
  });
  const responseText = await response.text();
  let body;

  try {
    body = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Expected a JSON response for ${init?.method ?? "GET"} ${path}, received ${response.status}: ${responseText}\n${workerOutput}`,
    );
  }
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/u);
  return { response, body };
};

const createArticle = async (url, tagIds = []) =>
  requestJson("/api/v1/articles", {
    method: "POST",
    headers: mutationHeaders,
    body: JSON.stringify({ url, tagIds }),
  });

const createTag = async (name) =>
  requestJson("/api/v1/tags", {
    method: "POST",
    headers: mutationHeaders,
    body: JSON.stringify({ name }),
  });

const assertApiError = ({ response, body }, status, code) => {
  assert.equal(response.status, status);
  assert.equal(body.error.code, code);
  assert.equal(body.error.requestId, response.headers.get("x-request-id"));
  assert.equal(typeof body.error.message, "string");
  assert.equal("stack" in body.error, false);
};

let verificationError;

try {
  const workerConfigPath = join(persistenceDirectory, "wrangler.phase3.json");
  writeFileSync(
    workerConfigPath,
    `${JSON.stringify(
      {
        name: `tech-inbox-api-integration-${process.pid}`,
        main: relative(
          persistenceDirectory,
          join(
            projectRoot,
            "apps",
            "web",
            "src",
            "worker",
            "d1-article-repository.integration-fixture.ts",
          ),
        ),
        compatibility_date: "2026-08-15",
        d1_databases: [
          {
            binding: "DB",
            database_name: "tech-inbox",
            migrations_dir: relative(
              persistenceDirectory,
              join(projectRoot, "packages", "db", "migrations"),
            ),
            remote: false,
          },
        ],
        queues: {
          producers: [
            {
              binding: "METADATA_QUEUE",
              queue: `tech-inbox-metadata-integration-${process.pid}`,
            },
          ],
        },
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );

  runWrangler([
    "d1",
    "migrations",
    "apply",
    "tech-inbox",
    "--local",
    "--persist-to",
    persistenceDirectory,
    "--config",
    workerConfigPath,
  ]);
  runWrangler([
    "d1",
    "execute",
    "tech-inbox",
    "--local",
    "--persist-to",
    persistenceDirectory,
    "--config",
    workerConfigPath,
    "--yes",
    "--command",
    "INSERT INTO articles (id, original_url, site_name, status, metadata_status, saved_at, created_at, updated_at) VALUES ('site-filter-article', 'https://site-filter.example/article', 'Example Site', 'unread', 'pending', '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z'); INSERT INTO article_urls (normalized_url, article_id, kind, created_at) VALUES ('https://site-filter.example/article', 'site-filter-article', 'original', '2026-08-20T00:00:00.000Z'), ('https://site-filter.example/canonical', 'site-filter-article', 'canonical', '2026-08-20T00:00:00.000Z');",
  ]);

  workerProcess = spawn(
    process.execPath,
    [
      pnpmCli,
      "--dir",
      "apps/web",
      "exec",
      "wrangler",
      "dev",
      "--config",
      workerConfigPath,
      "--local",
      "--persist-to",
      persistenceDirectory,
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--var",
      "ENVIRONMENT:local",
      "--var",
      `APP_ORIGIN:${baseUrl}`,
      "--log-level",
      "error",
      "--show-interactive-dev-session",
      "false",
    ],
    { cwd: projectRoot, env: childEnvironment, stdio: ["ignore", "pipe", "pipe"] },
  );
  workerProcess.stdout.on("data", appendWorkerOutput);
  workerProcess.stderr.on("data", appendWorkerOutput);

  await waitForWorker();

  const daymark = await requestJson("/api/v1/daymark/status");
  assert.equal(daymark.response.status, 200);
  assert.deepEqual(daymark.body, {
    product: "daymark",
    status: "ready",
    timeZone: "Asia/Tokyo",
  });

  const today = new Date(Date.now() + 9 * 60 * 60 * 1_000).toISOString().slice(0, 10);
  const todayInstant = new Date(`${today}T00:00:00.000Z`);
  const mondayInstant = new Date(todayInstant);
  mondayInstant.setUTCDate(todayInstant.getUTCDate() - ((todayInstant.getUTCDay() + 6) % 7));
  const monday = mondayInstant.toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const daymarkHabit = await requestJson("/api/v1/daymark/habits", {
    method: "POST",
    headers: mutationHeaders,
    body: JSON.stringify({ name: "API smoke", kind: "check" }),
  });
  assert.equal(daymarkHabit.response.status, 201);
  assert.equal(daymarkHabit.body.habit.configuration.kind, "check");
  const daymarkHabitId = daymarkHabit.body.habit.id;
  const daymarkListed = await requestJson("/api/v1/daymark/habits");
  assert.equal(daymarkListed.response.status, 200);
  assert.deepEqual(
    daymarkListed.body.habits.map(({ id }) => id),
    [daymarkHabitId],
  );
  const daymarkRecorded = await requestJson(
    `/api/v1/daymark/habits/${daymarkHabitId}/records/${today}`,
    {
      method: "PUT",
      headers: mutationHeaders,
      body: JSON.stringify({ kind: "check", checked: true }),
    },
  );
  assert.equal(daymarkRecorded.response.status, 200);
  assert.equal(daymarkRecorded.body.summary.rate, 100);
  const daymarkWeek = await requestJson(`/api/v1/daymark/history/week?start=${monday}`);
  assert.equal(daymarkWeek.response.status, 200);
  assert.equal(daymarkWeek.body.days.length, 7);
  const daymarkMonth = await requestJson(`/api/v1/daymark/history/month?month=${month}`);
  assert.equal(daymarkMonth.response.status, 200);
  assert.ok(daymarkMonth.body.days.length >= 28 && daymarkMonth.body.days.length <= 31);
  const daymarkCleared = await requestJson(
    `/api/v1/daymark/habits/${daymarkHabitId}/records/${today}`,
    { method: "DELETE", headers: mutationHeaders },
  );
  assert.equal(daymarkCleared.response.status, 200);
  assert.deepEqual(daymarkCleared.body, { result: "deleted" });

  const first = await createArticle("https://Example.com/first/?utm_source=test");
  assert.equal(
    first.response.status,
    201,
    `${JSON.stringify(first.body)}\nWorker output:\n${workerOutput}`,
  );
  assert.equal(first.body.result, "created");
  assert.equal(first.body.article.status, "unread");
  assert.equal(first.body.article.metadataStatus, "pending");

  const duplicate = await createArticle("https://example.com/first");
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.body.result, "alreadyExists");
  assert.equal(duplicate.body.article.id, first.body.article.id);

  const concurrent = await Promise.all([
    createArticle("https://example.com/concurrent?a=1&utm_source=one"),
    createArticle("https://EXAMPLE.com/concurrent?utm_medium=two&a=1"),
  ]);
  assert.deepEqual(concurrent.map(({ response }) => response.status).sort(), [200, 201]);
  assert.equal(concurrent[0].body.article.id, concurrent[1].body.article.id);

  const emptyTags = await requestJson("/api/v1/tags");
  assert.equal(emptyTags.response.status, 200);
  assert.deepEqual(emptyTags.body, { tags: [] });

  const reactTag = await createTag("  Ｒｅａｃｔ  ");
  assert.equal(reactTag.response.status, 201);
  assert.equal(reactTag.body.result, "created");
  assert.equal(reactTag.body.tag.name, "React");
  assert.equal(reactTag.body.tag.colorHue, 220);
  assert.equal("normalizedName" in reactTag.body.tag, false);

  const duplicateTag = await createTag("REACT");
  assert.equal(duplicateTag.response.status, 200);
  assert.equal(duplicateTag.body.result, "alreadyExists");
  assert.equal(duplicateTag.body.tag.id, reactTag.body.tag.id);

  const cloudflareTag = await createTag("Cloudflare");
  assert.equal(cloudflareTag.response.status, 201);
  assert.notEqual(cloudflareTag.body.tag.colorHue, reactTag.body.tag.colorHue);

  assertApiError(
    await createArticle("https://example.com/missing-tag-create", ["missing-tag"]),
    400,
    "VALIDATION_ERROR",
  );

  const third = await createArticle("https://example.com/third", [reactTag.body.tag.id]);
  assert.equal(third.response.status, 201);
  assert.deepEqual(
    third.body.tags.map(({ id }) => id),
    [reactTag.body.tag.id],
  );
  const taggedDuplicate = await createArticle("https://example.com/third", [
    cloudflareTag.body.tag.id,
  ]);
  assert.equal(taggedDuplicate.response.status, 200);
  assert.equal(taggedDuplicate.body.article.id, third.body.article.id);
  assert.deepEqual(
    new Set(taggedDuplicate.body.tags.map(({ id }) => id)),
    new Set([reactTag.body.tag.id, cloudflareTag.body.tag.id]),
  );

  const assignedTags = await requestJson(`/api/v1/articles/${first.body.article.id}/tags`, {
    method: "PUT",
    headers: mutationHeaders,
    body: JSON.stringify({ tagIds: [reactTag.body.tag.id, cloudflareTag.body.tag.id] }),
  });
  assert.equal(assignedTags.response.status, 200);
  assert.deepEqual(
    new Set(assignedTags.body.tags.map(({ id }) => id)),
    new Set([reactTag.body.tag.id, cloudflareTag.body.tag.id]),
  );
  const fetchedTags = await requestJson(`/api/v1/articles/${first.body.article.id}/tags`);
  assert.deepEqual(fetchedTags.body, assignedTags.body);
  const tagFilteredArticles = await requestJson(
    `/api/v1/articles?tagId=${encodeURIComponent(reactTag.body.tag.id)}`,
  );
  assert.equal(tagFilteredArticles.response.status, 200);
  assert.deepEqual(
    tagFilteredArticles.body.articles.map(({ id }) => id),
    [third.body.article.id, first.body.article.id],
  );
  assert.deepEqual(
    new Set(tagFilteredArticles.body.availableTags.map(({ id }) => id)),
    new Set([reactTag.body.tag.id, cloudflareTag.body.tag.id]),
  );
  assert.deepEqual(
    new Set(tagFilteredArticles.body.tagsByArticleId[first.body.article.id].map(({ id }) => id)),
    new Set([reactTag.body.tag.id, cloudflareTag.body.tag.id]),
  );

  const renamedTag = await requestJson(`/api/v1/tags/${reactTag.body.tag.id}`, {
    method: "PATCH",
    headers: mutationHeaders,
    body: JSON.stringify({ name: "TypeScript" }),
  });
  assert.equal(renamedTag.response.status, 200);
  assert.equal(renamedTag.body.tag.name, "TypeScript");
  assert.equal(renamedTag.body.tag.colorHue, reactTag.body.tag.colorHue);
  assertApiError(
    await requestJson(`/api/v1/tags/${cloudflareTag.body.tag.id}`, {
      method: "PATCH",
      headers: mutationHeaders,
      body: JSON.stringify({ name: "ＴＹＰＥＳＣＲＩＰＴ" }),
    }),
    409,
    "TAG_CONFLICT",
  );
  assertApiError(
    await requestJson(`/api/v1/articles/${first.body.article.id}/tags`, {
      method: "PUT",
      headers: mutationHeaders,
      body: JSON.stringify({ tagIds: ["missing-tag"] }),
    }),
    400,
    "VALIDATION_ERROR",
  );

  const deletedTag = await requestJson(`/api/v1/tags/${cloudflareTag.body.tag.id}`, {
    method: "DELETE",
    headers: mutationHeaders,
  });
  assert.equal(deletedTag.response.status, 200);
  assert.equal(deletedTag.body.result, "deleted");
  const tagsAfterDelete = await requestJson(`/api/v1/articles/${first.body.article.id}/tags`);
  assert.deepEqual(
    tagsAfterDelete.body.tags.map(({ id }) => id),
    [reactTag.body.tag.id],
  );
  assert.equal(
    (await requestJson(`/api/v1/articles/${first.body.article.id}`)).body.article.id,
    first.body.article.id,
  );

  const exported = await requestJson("/api/v1/export");
  assert.equal(exported.response.status, 200);
  assert.match(
    exported.response.headers.get("content-disposition") ?? "",
    /^attachment; filename="tech-inbox-export-\d{4}-\d{2}-\d{2}\.json"$/u,
  );
  assert.deepEqual(Object.keys(exported.body).sort(), [
    "articleTags",
    "articleUrls",
    "articles",
    "exportedAt",
    "schemaVersion",
    "tags",
  ]);
  assert.equal(exported.body.schemaVersion, 2);
  assert.equal(exported.body.articles.length, 4);
  assert.equal(exported.body.articleUrls.length, 5);
  assert.deepEqual(
    exported.body.tags.map(({ id, name }) => ({ id, name })),
    [{ id: reactTag.body.tag.id, name: "TypeScript" }],
  );
  assert.deepEqual(
    new Set(exported.body.articleTags.map(({ articleId, tagId }) => `${articleId}:${tagId}`)),
    new Set([
      `${first.body.article.id}:${reactTag.body.tag.id}`,
      `${third.body.article.id}:${reactTag.body.tag.id}`,
    ]),
  );
  const exportedArticleIds = new Set(exported.body.articles.map(({ id }) => id));
  const exportedTagIds = new Set(exported.body.tags.map(({ id }) => id));
  assert.equal(exportedArticleIds.size, 4);
  assert.ok(exportedArticleIds.has("site-filter-article"));
  assert.ok(exported.body.articleUrls.every(({ articleId }) => exportedArticleIds.has(articleId)));
  assert.ok(
    exported.body.articleTags.every(
      ({ articleId, tagId }) => exportedArticleIds.has(articleId) && exportedTagIds.has(tagId),
    ),
  );
  assert.equal(JSON.stringify(exported.body).includes("TEAM_DOMAIN"), false);
  assert.equal(JSON.stringify(exported.body).includes("ALLOWED_EMAIL"), false);

  const firstPage = await requestJson("/api/v1/articles?sort=saved_desc&limit=2");
  assert.equal(firstPage.response.status, 200);
  assert.equal(firstPage.body.articles.length, 2);
  assert.equal(typeof firstPage.body.nextCursor, "string");
  const secondPage = await requestJson(
    `/api/v1/articles?sort=saved_desc&limit=2&cursor=${firstPage.body.nextCursor}`,
  );
  assert.equal(secondPage.response.status, 200);
  assert.equal(secondPage.body.articles.length, 2);
  assert.equal(secondPage.body.nextCursor, null);
  const pageIds = [...firstPage.body.articles, ...secondPage.body.articles].map(({ id }) => id);
  assert.equal(new Set(pageIds).size, 4);
  assert.ok(pageIds.includes("site-filter-article"));

  const mismatchedCursor = await requestJson(
    `/api/v1/articles?sort=saved_asc&limit=2&cursor=${firstPage.body.nextCursor}`,
  );
  assertApiError(mismatchedCursor, 400, "VALIDATION_ERROR");
  assertApiError(
    await requestJson(
      `/api/v1/articles?sort=saved_desc&limit=2&tagId=${encodeURIComponent(reactTag.body.tag.id)}&cursor=${firstPage.body.nextCursor}`,
    ),
    400,
    "VALIDATION_ERROR",
  );
  assertApiError(
    await requestJson("/api/v1/articles?cursor=not-a-cursor"),
    400,
    "VALIDATION_ERROR",
  );
  assertApiError(await requestJson("/api/v1/articles?unexpected=true"), 400, "VALIDATION_ERROR");
  assertApiError(await requestJson("/api/v1/articles?limit=2&limit=3"), 400, "VALIDATION_ERROR");

  const updated = await requestJson(`/api/v1/articles/${first.body.article.id}`, {
    method: "PATCH",
    headers: mutationHeaders,
    body: JSON.stringify({ title: "100%_safe", status: "read" }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.article.title, "100%_safe");
  assert.equal(updated.body.article.titleIsManual, true);
  assert.equal(updated.body.article.status, "read");
  assert.match(updated.body.article.readAt, /^\d{4}-\d{2}-\d{2}T/u);

  const search = await requestJson(`/api/v1/articles?q=${encodeURIComponent("%_")}`);
  assert.deepEqual(
    search.body.articles.map(({ id }) => id),
    [first.body.article.id],
  );
  const injection = await requestJson(`/api/v1/articles?q=${encodeURIComponent("%' OR 1=1 --")}`);
  assert.equal(injection.body.articles.length, 0);
  const readOnly = await requestJson("/api/v1/articles?status=read&sort=read_desc");
  assert.deepEqual(
    readOnly.body.articles.map(({ id }) => id),
    [first.body.article.id],
  );
  const siteOnly = await requestJson(`/api/v1/articles?site=${encodeURIComponent("Example Site")}`);
  assert.deepEqual(
    siteOnly.body.articles.map(({ id }) => id),
    ["site-filter-article"],
  );

  const fetched = await requestJson(`/api/v1/articles/${first.body.article.id}`);
  assert.equal(fetched.response.status, 200);
  assert.equal(fetched.body.article.id, first.body.article.id);

  const conflict = await requestJson(`/api/v1/articles/${third.body.article.id}`, {
    method: "PATCH",
    headers: mutationHeaders,
    body: JSON.stringify({ url: "https://example.com/first?utm_campaign=again" }),
  });
  assertApiError(conflict, 409, "URL_CONFLICT");

  const changedUrl = await requestJson(`/api/v1/articles/${third.body.article.id}`, {
    method: "PATCH",
    headers: mutationHeaders,
    body: JSON.stringify({ url: "https://example.com/changed" }),
  });
  assert.equal(changedUrl.response.status, 200);
  assert.equal(changedUrl.body.article.metadataStatus, "pending");
  assert.equal(changedUrl.body.article.canonicalUrl, null);
  assert.equal((await createArticle("https://example.com/third")).response.status, 201);

  assertApiError(
    await requestJson(`/api/v1/articles/${first.body.article.id}`, {
      method: "PATCH",
      headers: mutationHeaders,
      body: JSON.stringify({ metadataStatus: "ready" }),
    }),
    400,
    "VALIDATION_ERROR",
  );
  assertApiError(
    await requestJson("/api/v1/articles", {
      method: "POST",
      headers: { "Content-Type": "text/plain", Origin: baseUrl, "X-Tech-Inbox-Client": "web" },
      body: "{}",
    }),
    415,
    "UNSUPPORTED_MEDIA_TYPE",
  );
  assertApiError(
    await requestJson("/api/v1/articles", {
      method: "POST",
      headers: { ...mutationHeaders, Origin: "https://attacker.example" },
      body: JSON.stringify({ url: "https://example.com/blocked" }),
    }),
    403,
    "FORBIDDEN",
  );
  assertApiError(
    await requestJson("/api/v1/articles", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({ url: "https://example.com/large", padding: "x".repeat(17_000) }),
    }),
    413,
    "PAYLOAD_TOO_LARGE",
  );

  assertApiError(
    await requestJson("/api/v1/articles/missing-before-delete", {
      method: "DELETE",
      headers: mutationHeaders,
      body: "{}",
    }),
    404,
    "NOT_FOUND",
  );

  const deleted = await requestJson(`/api/v1/articles/${first.body.article.id}`, {
    method: "DELETE",
    headers: mutationHeaders,
    body: "{}",
  });
  assert.equal(deleted.response.status, 200);
  assert.equal(deleted.body.result, "deleted");
  assertApiError(await requestJson(`/api/v1/articles/${first.body.article.id}`), 404, "NOT_FOUND");
  assert.equal((await createArticle("https://example.com/first")).response.status, 201);
  assertApiError(
    await requestJson(`/api/v1/articles/${first.body.article.id}`, {
      method: "DELETE",
      headers: mutationHeaders,
      body: "{}",
    }),
    404,
    "NOT_FOUND",
  );

  const mergeKeeper = await createArticle("https://merge.example/canonical");
  const mergeDuplicate = await createArticle("https://merge.example/duplicate");
  assert.equal(mergeKeeper.response.status, 201);
  assert.equal(mergeDuplicate.response.status, 201);
  const mergeTags = [];
  for (let index = 0; index < 12; index += 1) {
    const createdTag = await createTag(`Merge ${index}`);
    assert.equal(createdTag.response.status, 201);
    mergeTags.push(createdTag.body.tag);
  }
  const keeperTagIds = mergeTags.slice(0, 9).map(({ id }) => id);
  const duplicateTagIds = mergeTags.slice(9).map(({ id }) => id);
  await requestJson(`/api/v1/articles/${mergeKeeper.body.article.id}/tags`, {
    method: "PUT",
    headers: mutationHeaders,
    body: JSON.stringify({ tagIds: keeperTagIds }),
  });
  await requestJson(`/api/v1/articles/${mergeDuplicate.body.article.id}/tags`, {
    method: "PUT",
    headers: mutationHeaders,
    body: JSON.stringify({ tagIds: duplicateTagIds }),
  });

  const mergeResponse = await requestJson("/__integration/apply-metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: mergeDuplicate.body.article.id,
      expectedUrl: mergeDuplicate.body.article.originalUrl,
      metadata: {
        canonicalUrl: mergeKeeper.body.article.originalUrl,
        title: "Merged article",
        siteName: "Merge Example",
        description: null,
        faviconUrl: null,
        imageUrl: null,
        publishedAt: null,
      },
      canonicalAlias: {
        normalizedUrl: mergeKeeper.body.article.originalUrl,
        createdAt: "2026-08-28T02:00:00.000Z",
      },
      attemptCount: 1,
      fetchedAt: "2026-08-28T02:00:00.000Z",
      updatedAt: "2026-08-28T02:00:00.000Z",
    }),
  });
  assert.equal(mergeResponse.body.outcome, "merged");
  assert.equal(mergeResponse.body.removedArticleId, mergeDuplicate.body.article.id);
  assert.equal(mergeResponse.body.droppedTagCount, 2);
  const tagsAfterMerge = await requestJson(`/api/v1/articles/${mergeKeeper.body.article.id}/tags`);
  const expectedTransferredTagId = [...duplicateTagIds].sort()[0];
  assert.equal(tagsAfterMerge.body.tags.length, 10);
  assert.deepEqual(
    new Set(tagsAfterMerge.body.tags.map(({ id }) => id)),
    new Set([...keeperTagIds, expectedTransferredTagId]),
  );
  assertApiError(
    await requestJson(`/api/v1/articles/${mergeDuplicate.body.article.id}`),
    404,
    "NOT_FOUND",
  );
  const tagsAfterMergeList = await requestJson("/api/v1/tags");
  assert.ok(
    duplicateTagIds.every((id) => tagsAfterMergeList.body.tags.some((tag) => tag.id === id)),
  );

  const beforeImport = await requestJson("/api/v1/export");
  const sourceArticle = beforeImport.body.articles[0];
  const sourceTag = beforeImport.body.tags[0];
  const restoredArticleId = sourceArticle.id;
  const restoredTagSourceId = sourceTag.id;
  const importBackup = {
    schemaVersion: 2,
    exportedAt: "2026-08-29T00:00:00.000Z",
    articles: [
      {
        ...sourceArticle,
        id: restoredArticleId,
        originalUrl: "https://backup-restore.example/article",
        canonicalUrl: null,
        title: "Restored through D1 batch",
        status: "unread",
        metadataStatus: "pending",
        metadataErrorCode: null,
        metadataAttemptCount: 0,
        metadataFetchedAt: null,
        readAt: null,
      },
    ],
    articleUrls: [
      {
        normalizedUrl: "https://backup-restore.example/article",
        articleId: restoredArticleId,
        kind: "original",
        createdAt: "2026-08-29T00:00:00.000Z",
      },
    ],
    tags: [
      {
        ...sourceTag,
        id: restoredTagSourceId,
        name: "Restored tag",
      },
    ],
    articleTags: [{ articleId: restoredArticleId, tagId: restoredTagSourceId }],
  };
  const importRequest = (path) =>
    requestJson(path, {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({ backup: importBackup }),
    });
  const importPreview = await importRequest("/api/v1/import/preview");
  assert.equal(importPreview.response.status, 200);
  assert.equal(importPreview.body.result, "preview");
  assert.equal(importPreview.body.summary.changes.articlesCreated, 1);
  assert.equal(importPreview.body.summary.changes.articleIdsRemapped, 1);
  assert.equal(importPreview.body.summary.changes.tagsCreated, 1);
  assert.equal(importPreview.body.summary.changes.tagIdsRemapped, 1);
  assert.equal(importPreview.body.summary.changes.tagColorsReassigned, 1);
  assert.equal(importPreview.body.summary.changes.pendingArticlesReset, 1);

  const imported = await importRequest("/api/v1/import");
  assert.equal(imported.response.status, 200);
  assert.equal(imported.body.result, "imported");
  assert.deepEqual(imported.body.summary, importPreview.body.summary);
  const afterImport = await requestJson("/api/v1/export");
  const restoredArticle = afterImport.body.articles.find(
    ({ originalUrl }) => originalUrl === "https://backup-restore.example/article",
  );
  const restoredTag = afterImport.body.tags.find(({ name }) => name === "Restored tag");
  assert.notEqual(restoredArticle, undefined);
  assert.notEqual(restoredTag, undefined);
  assert.notEqual(restoredArticle.id, restoredArticleId);
  assert.equal(restoredArticle.metadataStatus, "failed");
  assert.equal(restoredArticle.metadataErrorCode, "NETWORK_ERROR");
  assert.notEqual(restoredTag.id, restoredTagSourceId);
  assert.notEqual(restoredTag.colorHue, sourceTag.colorHue);
  assert.ok(
    afterImport.body.articleTags.some(
      ({ articleId, tagId }) => articleId === restoredArticle.id && tagId === restoredTag.id,
    ),
  );

  const repeatedImport = await importRequest("/api/v1/import");
  assert.equal(repeatedImport.response.status, 200);
  assert.equal(repeatedImport.body.summary.hasChanges, false);
  assert.equal(repeatedImport.body.summary.changes.articlesMatched, 1);
  assert.equal(repeatedImport.body.summary.changes.tagsMatched, 1);
} catch (error) {
  verificationError = error;
}

let cleanupError;

try {
  await stopWorker();
  if (lstatSync(persistenceDirectory).isSymbolicLink()) {
    throw new Error("Refusing to remove a symlinked D1 verification directory.");
  }
  const cleanupTarget = realpathSync(persistenceDirectory);
  assertDescendant(temporaryRoot, cleanupTarget, "The D1 cleanup target");
  rmSync(cleanupTarget, { recursive: true, force: true });
} catch (error) {
  cleanupError = error;
}

if (verificationError && cleanupError) {
  throw new AggregateError(
    [verificationError, cleanupError],
    "Phase 3 API verification and secure cleanup both failed.",
  );
}
if (verificationError) throw verificationError;
if (cleanupError) throw cleanupError;

console.log("Phase 3 API verification passed against a temporary local D1 database.");
