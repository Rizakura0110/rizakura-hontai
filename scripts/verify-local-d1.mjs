import { existsSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
  const temporaryRootStatus = lstatSync(temporaryRootCandidate);
  if (temporaryRootStatus.isSymbolicLink() || !temporaryRootStatus.isDirectory()) {
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

const persistenceDirectory = realpathSync(mkdtempSync(join(temporaryRoot, "d1-phase2-")));
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

const runWrangler = (arguments_, { expectFailure = false } = {}) => {
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

  if (result.error) {
    throw result.error;
  }

  if (expectFailure ? result.status === 0 : result.status !== 0) {
    const expectation = expectFailure ? "failure" : "success";
    throw new Error(`Expected Wrangler ${expectation}, received exit ${result.status}.\n${output}`);
  }

  return output;
};

const d1Arguments = ["tech-inbox", "--local", "--persist-to", persistenceDirectory];

const execute = (sql, options) =>
  runWrangler(["d1", "execute", ...d1Arguments, "--yes", "--command", sql], options);

const expectSqlFailure = (sql, expectedError) => {
  const output = execute(sql, { expectFailure: true });
  if (!expectedError.test(output)) {
    throw new Error(`SQL failed for an unexpected reason.\n${output}`);
  }
};

let verificationError;

try {
  const firstApplication = runWrangler(["d1", "migrations", "apply", ...d1Arguments]);
  if (!firstApplication.includes("0000_")) {
    throw new Error("The initial migration was not reported as applied.");
  }

  runWrangler(["d1", "migrations", "list", ...d1Arguments]);
  const appliedMigrations = execute("SELECT name FROM d1_migrations ORDER BY id;");
  if (!appliedMigrations.includes("0000_")) {
    throw new Error("The initial migration is missing from the local D1 migration history.");
  }

  const databaseObjects = execute(
    "SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name;",
  );
  for (const name of [
    "articles",
    "article_urls",
    "articles_status_saved_at_id_idx",
    "articles_status_read_at_id_idx",
    "articles_site_name_idx",
    "article_urls_article_id_idx",
  ]) {
    if (!databaseObjects.includes(name)) {
      throw new Error(`Expected local D1 object ${name} was not created.`);
    }
  }

  const timestamps = ["saved_at", "created_at", "updated_at"];
  const requiredArticleColumns = [
    "id",
    "original_url",
    "status",
    "metadata_status",
    ...timestamps,
  ].join(", ");
  const articleValues = (id, status, metadataStatus, readAt = undefined) => {
    const columns =
      readAt === undefined ? requiredArticleColumns : `${requiredArticleColumns}, read_at`;
    const values = [
      `'${id}'`,
      `'https://example.com/${id}'`,
      `'${status}'`,
      `'${metadataStatus}'`,
      ...timestamps.map(() => "'2026-08-26T00:00:00.000Z'"),
      ...(readAt === undefined ? [] : [readAt === null ? "NULL" : `'${readAt}'`]),
    ].join(", ");
    return `INSERT INTO articles (${columns}) VALUES (${values});`;
  };

  expectSqlFailure(
    articleValues("invalid-status", "archived", "pending"),
    /articles_status_check/u,
  );
  expectSqlFailure(
    articleValues("invalid-unread-time", "unread", "pending", "2026-08-26T00:00:00.000Z"),
    /articles_status_read_at_check/u,
  );
  expectSqlFailure(
    articleValues("invalid-read-time", "read", "pending", null),
    /articles_status_read_at_check/u,
  );
  expectSqlFailure(
    articleValues("invalid-metadata", "unread", "unknown"),
    /articles_metadata_status_check/u,
  );
  expectSqlFailure(
    "INSERT INTO articles (id, original_url, status, metadata_status, metadata_attempt_count, saved_at, created_at, updated_at) VALUES ('invalid-attempt', 'https://example.com/invalid-attempt', 'unread', 'pending', -1, '2026-08-26T00:00:00.000Z', '2026-08-26T00:00:00.000Z', '2026-08-26T00:00:00.000Z');",
    /articles_metadata_attempt_count_check/u,
  );
  expectSqlFailure(
    "INSERT INTO articles (id, original_url, title_is_manual, status, metadata_status, saved_at, created_at, updated_at) VALUES ('invalid-manual', 'https://example.com/invalid-manual', 2, 'unread', 'pending', '2026-08-26T00:00:00.000Z', '2026-08-26T00:00:00.000Z', '2026-08-26T00:00:00.000Z');",
    /articles_title_is_manual_check/u,
  );

  execute(articleValues("valid-article", "unread", "pending"));
  expectSqlFailure(
    "INSERT INTO article_urls (normalized_url, article_id, kind, created_at) VALUES ('https://example.com/missing', 'missing', 'original', '2026-08-26T00:00:00.000Z');",
    /FOREIGN KEY constraint failed/iu,
  );
  execute(
    "INSERT INTO article_urls (normalized_url, article_id, kind, created_at) VALUES ('https://example.com/valid-article', 'valid-article', 'original', '2026-08-26T00:00:00.000Z');",
  );
  expectSqlFailure(
    "INSERT INTO article_urls (normalized_url, article_id, kind, created_at) VALUES ('https://example.com/valid-article', 'valid-article', 'canonical', '2026-08-26T00:00:00.000Z');",
    /UNIQUE constraint failed: article_urls\.normalized_url/iu,
  );
  expectSqlFailure(
    "INSERT INTO article_urls (normalized_url, article_id, kind, created_at) VALUES ('https://example.com/invalid-kind', 'valid-article', 'alternate', '2026-08-26T00:00:00.000Z');",
    /article_urls_kind_check/u,
  );

  execute(
    "INSERT INTO articles (id, original_url, title_is_manual, status, metadata_status, metadata_attempt_count, metadata_fetched_at, saved_at, read_at, created_at, updated_at) VALUES ('valid-read-article', 'https://example.com/valid-read-article', 1, 'read', 'ready', 2, '2026-08-26T00:00:00.000Z', '2026-08-26T00:00:00.000Z', '2026-08-26T00:00:00.000Z', '2026-08-26T00:00:00.000Z', '2026-08-26T00:00:00.000Z');",
  );
  execute(
    "INSERT INTO article_urls (normalized_url, article_id, kind, created_at) VALUES ('https://example.com/valid-read-article', 'valid-read-article', 'canonical', '2026-08-26T00:00:00.000Z');",
  );

  execute("DELETE FROM articles WHERE id IN ('valid-article', 'valid-read-article');");
  const aliasesAfterDelete = execute(
    "SELECT CASE WHEN COUNT(*) = 0 THEN 'CASCADE_OK' ELSE 'CASCADE_FAILED' END AS cascade_result FROM article_urls WHERE article_id IN ('valid-article', 'valid-read-article');",
  );
  if (!aliasesAfterDelete.includes("CASCADE_OK") || aliasesAfterDelete.includes("CASCADE_FAILED")) {
    throw new Error("Deleting an article did not cascade to its URL aliases.");
  }

  const secondApplication = runWrangler(["d1", "migrations", "apply", ...d1Arguments]);
  if (!/No migrations to apply|already up to date/iu.test(secondApplication)) {
    throw new Error("Reapplying migrations did not report an up-to-date local D1 database.");
  }
} catch (error) {
  verificationError = error;
}

let cleanupError;

try {
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
    "Local D1 verification and secure cleanup both failed.",
  );
}

if (verificationError) {
  throw verificationError;
}

if (cleanupError) {
  throw cleanupError;
}

console.log("Local D1 migration and constraint verification passed.");
