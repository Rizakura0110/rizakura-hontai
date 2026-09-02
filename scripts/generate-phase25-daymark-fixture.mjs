import { existsSync, lstatSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLongTermDaymarkBackup,
  PHASE25_DAYMARK_RECORD_COUNT,
} from "./daymark-long-term-fixture.mjs";

const projectRoot = realpathSync(dirname(dirname(fileURLToPath(import.meta.url))));
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
const relativeTemporaryRoot = relative(projectRoot, temporaryRoot);
if (
  relativeTemporaryRoot === "" ||
  relativeTemporaryRoot === ".." ||
  relativeTemporaryRoot.startsWith(`..${sep}`) ||
  isAbsolute(relativeTemporaryRoot)
) {
  throw new Error("The fixture output directory must resolve inside the project workspace.");
}

const outputPath = join(temporaryRoot, "daymark-phase25-preview-only-DO-NOT-RESTORE.json");
if (existsSync(outputPath) && lstatSync(outputPath).isSymbolicLink()) {
  throw new Error("The fixture output path must not be a symbolic link.");
}

const backup = buildLongTermDaymarkBackup({ exportedAt: new Date().toISOString() });
const contents = `${JSON.stringify(backup, null, 2)}\n`;
writeFileSync(outputPath, contents, { encoding: "utf8", mode: 0o600 });

console.info("Phase 25 preview-only Daymark fixture generated.");
console.info(`Path: ${outputPath}`);
console.info(`Habits: ${backup.habits.length}`);
console.info(`Habit versions: ${backup.habitVersions.length}`);
console.info(`Records: ${PHASE25_DAYMARK_RECORD_COUNT}`);
console.info(`Bytes: ${Buffer.byteLength(contents)}`);
console.warn("Use only '復元内容を確認'. Do not run the restore action in production.");
