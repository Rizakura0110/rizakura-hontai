import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const budgets = [
  {
    label: "app Worker",
    paths: [join(projectRoot, "apps/web/dist/tech_inbox_app/index.js")],
    maxRawBytes: 1_000_000,
  },
  {
    label: "metadata-fetcher Worker",
    paths: [join(projectRoot, "dist/metadata-fetcher/index.js")],
    maxRawBytes: 1_000_000,
  },
  {
    label: "client JavaScript",
    paths: filesWithExtension(join(projectRoot, "apps/web/dist/client/assets"), ".js"),
    maxRawBytes: 500_000,
  },
  {
    label: "client CSS",
    paths: filesWithExtension(join(projectRoot, "apps/web/dist/client/assets"), ".css"),
    maxRawBytes: 100_000,
  },
];

function filesWithExtension(directory, extension) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name) === extension)
    .map((entry) => join(directory, entry.name));
}

function kibibytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

for (const budget of budgets) {
  assert.ok(budget.paths.length > 0, `${budget.label} artifact is missing; run pnpm build first.`);
  const missing = budget.paths.filter((path) => !existsSync(path));
  assert.deepEqual(
    missing,
    [],
    `${budget.label} artifact is missing: ${missing.map((path) => relative(projectRoot, path)).join(", ")}`,
  );

  const contents = budget.paths.map((path) => readFileSync(path));
  const rawBytes = contents.reduce((total, content) => total + content.byteLength, 0);
  const gzipBytes = contents.reduce((total, content) => total + gzipSync(content).byteLength, 0);
  assert.ok(
    rawBytes <= budget.maxRawBytes,
    `${budget.label} is ${rawBytes} bytes, above the ${budget.maxRawBytes}-byte raw budget.`,
  );

  console.info(
    `${budget.label}: raw ${kibibytes(rawBytes)}, gzip ${kibibytes(gzipBytes)}, budget ${kibibytes(budget.maxRawBytes)}`,
  );
}
