import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertBackupImportOrder,
  backupImportOrder,
  assertMatchingSnapshots,
  snapshotDatabase,
} from "./d1-backup-snapshot.mjs";

const root = realpathSync(fileURLToPath(new URL("..", import.meta.url)));
function inside(parent, target) {
  const path = relative(parent, target);
  assert.ok(
    path && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path),
    "Backup paths must stay inside the project .tmp directory.",
  );
  return target;
}
const tmp = join(root, ".tmp");
// Invoke the installed, lockfile-pinned CLI directly. pnpm may auto-install and
// prepend progress text to --json stdout when another command refreshed metadata.
const wranglerCli = inside(
  root,
  realpathSync(join(root, "apps/web/node_modules/wrangler/bin/wrangler.js")),
);
if (!existsSync(tmp)) mkdirSync(tmp, { mode: 0o700 });
assert.ok(
  lstatSync(tmp).isDirectory() && !lstatSync(tmp).isSymbolicLink(),
  ".tmp must be a real directory.",
);
inside(root, realpathSync(tmp));
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    ((args.length === 4 || (args.length === 6 && args[4] === "--expected")) &&
      args[0] === "--schema" &&
      args[2] === "--data"),
  "Usage: node scripts/verify-d1-backup.mjs [--schema .tmp/schema.sql --data .tmp/data.sql [--expected .tmp/snapshot.json]]",
);
function inputFile(path) {
  const candidate = resolve(root, path);
  assert.ok(
    lstatSync(candidate).isFile() && !lstatSync(candidate).isSymbolicLink(),
    "Backup inputs must be regular files.",
  );
  return inside(realpathSync(tmp), realpathSync(candidate));
}
const input = args[1] ? inputFile(args[1]) : undefined;
const dataInput = args[3] ? inputFile(args[3]) : undefined;
const expected = args[5] ? JSON.parse(readFileSync(inputFile(args[5]), "utf8")) : undefined;
const work = inside(tmp, realpathSync(mkdtempSync(join(tmp, "d1-backup-rehearsal-"))));
chmodSync(work, 0o700);
// Intentionally omit credentials and the inherited process environment: this command is local-only.
const env = {
  PATH: `${join(root, ".tools/node/bin")}:${join(root, ".tools/pnpm/bin")}:${join(root, "node_modules/.bin")}:/usr/bin:/bin:/usr/sbin:/sbin`,
  XDG_CONFIG_HOME: join(root, ".config"),
  XDG_CACHE_HOME: join(root, ".cache"),
  XDG_DATA_HOME: join(root, ".local/share"),
  TMPDIR: tmp,
  PNPM_HOME: join(root, ".tools/pnpm"),
  COREPACK_HOME: join(root, ".tools/corepack"),
  PNPM_CONFIG_NPMRC_AUTH_FILE: join(root, ".config/pnpm-auth-empty"),
  CI: "1",
  NO_COLOR: "1",
  WRANGLER_SEND_METRICS: "false",
};
for (const database of ["source", "target"]) {
  mkdirSync(join(work, database), { mode: 0o700 });
  writeFileSync(
    join(work, database, "wrangler.json"),
    JSON.stringify({
      name: "local-backup-rehearsal",
      compatibility_date: "2026-08-15",
      d1_databases: [
        {
          binding: "DB",
          database_name: "local-backup-rehearsal",
          database_id: "00000000-0000-4000-8000-000000000029",
          migrations_dir: join(root, "packages/db/migrations"),
          remote: false,
        },
      ],
    }),
    { mode: 0o600 },
  );
}
function run(database, action, extra = []) {
  const result = spawnSync(
    process.execPath,
    [
      wranglerCli,
      "d1",
      ...action,
      "local-backup-rehearsal",
      "--local",
      "--config",
      join(work, database, "wrangler.json"),
      ...extra,
    ],
    { cwd: root, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 120000 },
  );
  // Wrangler errors may echo SQL values; never forward stdout/stderr for private backups.
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    console.error(
      JSON.stringify({
        missingTable: /no such table/i.test(output),
        foreignKey: /FOREIGN KEY constraint failed/i.test(output),
        authorization: /not authorized/i.test(output),
        argument: /Unknown argument/i.test(output),
        syntax: /syntax error/i.test(output),
        exit: result.status,
      }),
    );
  }
  assert.ok(
    !result.error && result.status === 0,
    `Local D1 ${action.join(" ")} failed; SQL/output was suppressed to protect private data.`,
  );
  return result.stdout;
}
function query(database, sql) {
  const result = JSON.parse(run(database, ["execute"], ["--command", sql, "--json"]));
  assert.ok(
    Array.isArray(result) &&
      result.length === 1 &&
      result[0].success === true &&
      Array.isArray(result[0].results),
    "Local D1 returned an unexpected query response.",
  );
  return result[0].results;
}
try {
  if (input) {
    run("source", ["execute"], ["--file", input, "--yes"]);
    run("source", ["execute"], ["--file", dataInput, "--yes"]);
  } else {
    run("source", ["migrations", "apply"]);
    run(
      "source",
      ["execute"],
      ["--file", join(root, "scripts/fixtures/d1-backup-rehearsal.sql"), "--yes"],
    );
  }
  const source = await snapshotDatabase((sql) => query("source", sql));
  const migrations = query("source", "SELECT name FROM d1_migrations ORDER BY name").map(
    ({ name }) => name,
  );
  assert.ok(
    JSON.stringify(migrations) ===
      JSON.stringify(
        readdirSync(join(root, "packages/db/migrations"))
          .filter((name) => name.endsWith(".sql"))
          .sort(),
      ),
    "Backup migration history differs from the repository.",
  );
  if (expected) assertMatchingSnapshots(expected, source);
  // Schema first, then native per-table exports in checked dependency order.
  await assertBackupImportOrder((sql) => query("source", sql));
  for (const [file, options] of [
    ["schema.sql", ["--no-data"]],
    ...backupImportOrder.map((table) => [`data-${table}.sql`, ["--no-schema", "--table", table]]),
  ]) {
    const dump = join(work, file);
    run("source", ["export"], ["--output", dump, ...options]);
    chmodSync(dump, 0o600);
    run("target", ["execute"], ["--file", dump, "--yes"]);
  }
  assertMatchingSnapshots(source, await snapshotDatabase((sql) => query("target", sql)));
  // A full copy must preserve migration history; running apply again must be a no-op.
  run("target", ["migrations", "apply"]);
  assertMatchingSnapshots(source, await snapshotDatabase((sql) => query("target", sql)));
  console.info(
    `D1 backup rehearsal passed (${input ? "private SQL backup" : "synthetic fixture"}; local only).`,
  );
  console.info(
    "Schema, indexes, all row values, migration history, foreign keys and integrity match. Migration reapplication is a no-op.",
  );
  console.table(Object.entries(source.tables).map(([table, { count }]) => ({ table, count })));
} finally {
  // Only the fresh, validated mkdtemp directory is removed. Supplied backups are never deleted.
  inside(tmp, realpathSync(work));
  rmSync(work, { recursive: true });
}
