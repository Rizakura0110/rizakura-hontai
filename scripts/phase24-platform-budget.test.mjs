import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DAYMARK_BACKUP_IMPORT_RECORD_BATCH_SIZE,
  DAYMARK_BACKUP_LIMITS,
  MAX_DAYMARK_BACKUP_FILE_BYTES,
} from "../modules/daymark/src/contracts";
import { MAX_BACKUP_IMPORT_FILE_BYTES } from "../packages/contracts/src/api";
import { MAX_URL_LENGTH } from "../packages/core/src/url-normalization";
import {
  DAYMARK_BACKUP_D1_BOUND_VALUE_BYTES,
  DAYMARK_BACKUP_D1_MAX_WRITE_STATEMENTS,
} from "../apps/web/src/worker/repositories/d1-daymark-backup-repository";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

const appConfig = readJson("apps/web/wrangler.jsonc");
const fetcherConfig = readJson("workers/metadata-fetcher/wrangler.jsonc");
const techInboxManifest = readJson("apps/web/public/manifest.webmanifest");
const daymarkManifest = readJson("apps/web/public/daymark/manifest.webmanifest");

// Rechecked against the official Cloudflare Free-plan documentation on 2026-09-02.
const freePlan = {
  workers: 100,
  d1Databases: 10,
  d1QueriesPerWorkerInvocation: 50,
  d1BoundValueBytes: 2_000_000,
  d1RowsReadPerDay: 5_000_000,
  d1RowsWrittenPerDay: 100_000,
  requestBodyBytes: 100 * 1_024 * 1_024,
  queueMessageBytes: 128 * 1_024,
  queueBatchSize: 100,
  queueRetries: 100,
  queues: 10_000,
};

describe("Phase 24 Cloudflare Free-plan boundaries", () => {
  it("keeps the production topology within the selected free products", () => {
    const workerConfigs = [appConfig, fetcherConfig];
    expect(workerConfigs).toHaveLength(2);
    expect(workerConfigs.length).toBeLessThanOrEqual(freePlan.workers);
    expect(appConfig.d1_databases).toHaveLength(1);
    expect(appConfig.d1_databases.length).toBeLessThanOrEqual(freePlan.d1Databases);
    expect(appConfig.d1_databases[0].remote).toBe(false);
    expect(appConfig.workers_dev).toBe(true);
    expect(fetcherConfig.workers_dev).toBe(false);
    expect(workerConfigs.every((config) => config.preview_urls === false)).toBe(true);

    const queueNames = new Set([
      ...appConfig.queues.producers.map(({ queue }) => queue),
      ...appConfig.queues.consumers.flatMap(({ queue, dead_letter_queue: deadLetterQueue }) => [
        queue,
        deadLetterQueue,
      ]),
    ]);
    expect(queueNames.size).toBe(2);
    expect(queueNames.size).toBeLessThanOrEqual(freePlan.queues);

    for (const key of [
      "ai",
      "browser",
      "durable_objects",
      "hyperdrive",
      "kv_namespaces",
      "r2_buckets",
      "vectorize",
      "workflows",
    ]) {
      expect(appConfig, key).not.toHaveProperty(key);
      expect(fetcherConfig, key).not.toHaveProperty(key);
    }
  });

  it("keeps queue delivery below the configured Free-plan boundaries", () => {
    const consumer = appConfig.queues.consumers[0];
    expect(consumer.max_batch_size).toBeLessThanOrEqual(freePlan.queueBatchSize);
    expect(consumer.max_retries).toBeLessThanOrEqual(freePlan.queueRetries);

    const largestMessage = JSON.stringify({
      articleId: "a".repeat(128),
      url: `https://example.com/${"a".repeat(MAX_URL_LENGTH - 20)}`,
      attempt: Number.MAX_SAFE_INTEGER,
    });
    expect(new TextEncoder().encode(largestMessage).byteLength).toBeLessThan(
      freePlan.queueMessageBytes,
    );
  });

  it("keeps both installable products isolated by PWA id and scope", () => {
    expect(techInboxManifest).toMatchObject({
      id: "/",
      start_url: "/tech-inbox/",
      scope: "/tech-inbox/",
      display: "standalone",
    });
    expect(daymarkManifest).toMatchObject({
      id: "/daymark/",
      start_url: "/daymark/",
      scope: "/daymark/",
      display: "standalone",
    });
    expect(techInboxManifest.id).not.toBe(daymarkManifest.id);
    expect(techInboxManifest.icons).toHaveLength(3);
    expect(daymarkManifest.icons).toHaveLength(3);
  });

  it("keeps accepted backup bodies and D1 values below platform limits", () => {
    expect(MAX_BACKUP_IMPORT_FILE_BYTES).toBeLessThan(freePlan.requestBodyBytes);
    expect(MAX_DAYMARK_BACKUP_FILE_BYTES).toBeLessThan(freePlan.requestBodyBytes);
    expect(DAYMARK_BACKUP_D1_BOUND_VALUE_BYTES).toBeLessThan(freePlan.d1BoundValueBytes);
    expect(DAYMARK_BACKUP_D1_MAX_WRITE_STATEMENTS + 3).toBeLessThanOrEqual(
      freePlan.d1QueriesPerWorkerInvocation,
    );
  });

  it("keeps a maximum Daymark restore within per-minute request limits", () => {
    const restoreRequests =
      1 + Math.ceil(DAYMARK_BACKUP_LIMITS.records / DAYMARK_BACKUP_IMPORT_RECORD_BATCH_SIZE);
    const readLimit = appConfig.ratelimits.find(({ name }) => name === "RATE_LIMIT_READ");
    const mutateLimit = appConfig.ratelimits.find(({ name }) => name === "RATE_LIMIT_MUTATE");

    expect(restoreRequests).toBe(51);
    expect(restoreRequests).toBeLessThanOrEqual(readLimit.simple.limit);
    expect(restoreRequests).toBeLessThanOrEqual(mutateLimit.simple.limit);
  });

  it("keeps a maximum Daymark restore below the daily D1 write allowance", () => {
    // D1 counts the table row plus every index entry as rows written.
    const daymarkRowsWritten =
      DAYMARK_BACKUP_LIMITS.habits * 3 +
      DAYMARK_BACKUP_LIMITS.habitVersions * 4 +
      DAYMARK_BACKUP_LIMITS.records * 4;
    expect(daymarkRowsWritten).toBe(88_600);
    expect(daymarkRowsWritten).toBeLessThan(freePlan.d1RowsWrittenPerDay);

    const recordBatches = Math.ceil(
      DAYMARK_BACKUP_LIMITS.records / DAYMARK_BACKUP_IMPORT_RECORD_BATCH_SIZE,
    );
    const restoreRequests = 1 + recordBatches;
    const metadataRows = DAYMARK_BACKUP_LIMITS.habits + DAYMARK_BACKUP_LIMITS.habitVersions;
    const scopedRecordRows = DAYMARK_BACKUP_LIMITS.records * 2;
    const conservativeRowsRead = (metadataRows * restoreRequests + scopedRecordRows) * 2;
    expect(conservativeRowsRead).toBe(304_400);
    expect(conservativeRowsRead).toBeLessThan(freePlan.d1RowsReadPerDay);
  });
});
