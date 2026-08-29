import assert from "node:assert/strict";
import {
  assertHealthyProductionState,
  normalizeQueueMetrics,
  summarizeQueueOperationGroups,
  summarizeWorkerInvocationGroups,
} from "./cloudflare-health-assertions.mjs";

const apiOrigin = "https://api.cloudflare.com";
const apiPrefix = "/client/v4";
const healthWindowHours = 24;
const mainQueueName = "tech-inbox-metadata";
const deadLetterQueueName = "tech-inbox-metadata-dlq";
const workerNames = ["tech-inbox-app", "tech-inbox-metadata-fetcher"];

const token = requiredEnvironmentVariable("CLOUDFLARE_API_TOKEN");
const accountId = requiredEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID");

assert.match(
  accountId,
  /^[0-9a-f]{32}$/i,
  "CLOUDFLARE_ACCOUNT_ID must be a 32-character hexadecimal account ID.",
);

const headers = {
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
};
const accountPath = `/accounts/${accountId}`;

async function cloudflareGet(path, label) {
  const response = await fetch(new URL(`${apiPrefix}${path}`, apiOrigin), {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => undefined);
  assert.ok(
    response.ok && payload?.success === true,
    `${label} failed with HTTP ${response.status}.`,
  );
  return payload.result;
}

async function cloudflareGraphql(query, variables, label) {
  const response = await fetch(new URL(`${apiPrefix}/graphql`, apiOrigin), {
    body: JSON.stringify({ query, variables }),
    headers: { ...headers, "Content-Type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => undefined);
  assert.ok(
    response.ok && payload?.errors == null && payload?.data != null,
    `${label} failed with HTTP ${response.status}.`,
  );
  return payload.data;
}

function requiredEnvironmentVariable(name) {
  const value = process.env[name]?.trim();
  assert.ok(value, `${name} is required in the process environment.`);
  return value;
}

function exactQueue(queues, name) {
  const matches = queues.filter((queue) => queue?.queue_name === name);
  assert.equal(matches.length, 1, `Expected exactly one Queue named ${name}.`);
  assert.match(matches[0]?.queue_id ?? "", /^[0-9a-f]{32}$/i, `${name} ID is invalid.`);
  return matches[0];
}

const queues = await cloudflareGet(`${accountPath}/queues?per_page=100`, "Queue list");
assert.ok(Array.isArray(queues), "Queue list did not return an array.");
const mainQueue = exactQueue(queues, mainQueueName);
const deadLetterQueue = exactQueue(queues, deadLetterQueueName);

const windowEnd = new Date();
const windowStart = new Date(windowEnd.getTime() - healthWindowHours * 60 * 60 * 1000);

const queueOperationsQuery = `
  query QueueOperations(
    $accountTag: string!
    $queueId: string!
    $datetimeStart: Time!
    $datetimeEnd: Time!
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        queueMessageOperationsAdaptiveGroups(
          limit: 10000
          filter: {
            queueId: $queueId
            datetime_geq: $datetimeStart
            datetime_leq: $datetimeEnd
          }
        ) {
          count
          dimensions {
            actionType
            outcome
          }
        }
      }
    }
  }
`;

const workerInvocationsQuery = `
  query WorkerHealth(
    $accountTag: string
    $datetimeStart: string
    $datetimeEnd: string
    $scriptName: string
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        workersInvocationsAdaptive(
          limit: 10000
          filter: {
            scriptName: $scriptName
            datetime_geq: $datetimeStart
            datetime_leq: $datetimeEnd
          }
        ) {
          sum {
            requests
            errors
          }
          dimensions {
            status
          }
        }
      }
    }
  }
`;

const [mainMetricsResult, deadLetterMetricsResult, queueAnalytics, ...workerAnalytics] =
  await Promise.all([
    cloudflareGet(
      `${accountPath}/queues/${mainQueue.queue_id}/metrics`,
      `${mainQueueName} metrics`,
    ),
    cloudflareGet(
      `${accountPath}/queues/${deadLetterQueue.queue_id}/metrics`,
      `${deadLetterQueueName} metrics`,
    ),
    cloudflareGraphql(
      queueOperationsQuery,
      {
        accountTag: accountId,
        datetimeEnd: windowEnd.toISOString(),
        datetimeStart: windowStart.toISOString(),
        queueId: mainQueue.queue_id,
      },
      "Queue operation analytics",
    ),
    ...workerNames.map((scriptName) =>
      cloudflareGraphql(
        workerInvocationsQuery,
        {
          accountTag: accountId,
          datetimeEnd: windowEnd.toISOString(),
          datetimeStart: windowStart.toISOString(),
          scriptName,
        },
        `${scriptName} analytics`,
      ),
    ),
  ]);

const mainQueueMetrics = normalizeQueueMetrics(mainMetricsResult, mainQueueName);
const deadLetterQueueMetrics = normalizeQueueMetrics(deadLetterMetricsResult, deadLetterQueueName);
const queueAccount = queueAnalytics.viewer?.accounts?.[0];
const recentQueueOperations = summarizeQueueOperationGroups(
  queueAccount?.queueMessageOperationsAdaptiveGroups,
);
const workers = workerAnalytics.map((data, index) =>
  summarizeWorkerInvocationGroups(
    data.viewer?.accounts?.[0]?.workersInvocationsAdaptive,
    workerNames[index],
  ),
);

assertHealthyProductionState({
  mainQueue: mainQueueMetrics,
  recentQueueOperations,
  workers,
});

console.info(`Cloudflare production health check passed for the last ${healthWindowHours} hours.`);
console.table([
  { name: mainQueueName, ...mainQueueMetrics },
  { name: deadLetterQueueName, ...deadLetterQueueMetrics },
]);
console.table(
  workers.map(({ errors, requests, scriptName, statuses }) => ({
    errors,
    name: scriptName,
    requests,
    statuses: Object.entries(statuses)
      .map(([status, count]) => `${status}:${count}`)
      .join(", "),
  })),
);
console.info(
  `Recent Queue terminal failures: DLQ ${recentQueueOperations.dlqDeliveries}, fail ${recentQueueOperations.failedDeliveries}.`,
);
if (deadLetterQueueMetrics.backlogCount > 0) {
  console.warn(
    `The DLQ retains ${deadLetterQueueMetrics.backlogCount} historical messages (${deadLetterQueueMetrics.backlogBytes} bytes). Their bodies were not read or changed.`,
  );
}
console.info(
  "Credentials, account details, message bodies, article data, and owner identity were not printed.",
);
