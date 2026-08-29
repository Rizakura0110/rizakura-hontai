import assert from "node:assert/strict";

function assertNonNegativeNumber(value, label) {
  assert.equal(typeof value, "number", `${label} must be a number.`);
  assert.ok(Number.isFinite(value) && value >= 0, `${label} must be non-negative.`);
}

export function normalizeQueueMetrics(metrics, label) {
  const backlogCount = metrics?.backlog_count;
  const backlogBytes = metrics?.backlog_bytes;
  assertNonNegativeNumber(backlogCount, `${label} backlog count`);
  assertNonNegativeNumber(backlogBytes, `${label} backlog bytes`);
  return { backlogCount, backlogBytes };
}

export function summarizeQueueOperationGroups(groups) {
  assert.ok(Array.isArray(groups), "Queue operation analytics did not return a list.");

  const summary = {
    dlqDeliveries: 0,
    failedDeliveries: 0,
  };

  for (const group of groups) {
    const count = group?.count;
    assertNonNegativeNumber(count, "Queue operation count");

    if (group?.dimensions?.actionType !== "DeleteMessage") continue;
    if (group.dimensions.outcome === "dlq") summary.dlqDeliveries += count;
    if (group.dimensions.outcome === "fail") summary.failedDeliveries += count;
  }

  return summary;
}

export function summarizeWorkerInvocationGroups(groups, scriptName) {
  assert.ok(Array.isArray(groups), `${scriptName} analytics did not return a list.`);

  const summary = {
    errors: 0,
    nonSuccessRequests: 0,
    requests: 0,
    scriptName,
    statuses: {},
  };

  for (const group of groups) {
    const requests = group?.sum?.requests;
    const errors = group?.sum?.errors;
    const status = group?.dimensions?.status;
    assertNonNegativeNumber(requests, `${scriptName} request count`);
    assertNonNegativeNumber(errors, `${scriptName} error count`);
    assert.ok(typeof status === "string" && status.length > 0, `${scriptName} status is missing.`);

    summary.requests += requests;
    summary.errors += errors;
    summary.statuses[status] = (summary.statuses[status] ?? 0) + requests;
    if (status !== "success") summary.nonSuccessRequests += requests;
  }

  return summary;
}

export function assertHealthyProductionState({ mainQueue, recentQueueOperations, workers }) {
  assert.equal(mainQueue.backlogCount, 0, "The metadata Queue backlog is not empty.");
  assert.equal(
    recentQueueOperations.dlqDeliveries,
    0,
    "New metadata messages reached the DLQ during the health window.",
  );
  assert.equal(
    recentQueueOperations.failedDeliveries,
    0,
    "Metadata message deletion failures occurred during the health window.",
  );

  for (const worker of workers) {
    assert.equal(worker.errors, 0, `${worker.scriptName} reported Worker errors.`);
    assert.equal(
      worker.nonSuccessRequests,
      0,
      `${worker.scriptName} reported non-success invocations.`,
    );
  }
}
