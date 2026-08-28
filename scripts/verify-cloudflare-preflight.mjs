import assert from "node:assert/strict";

const apiOrigin = "https://api.cloudflare.com";
const apiPrefix = "/client/v4";

const token = requiredEnvironmentVariable("CLOUDFLARE_API_TOKEN");
const accountId = requiredEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID");
const allowedEmail = requiredEnvironmentVariable("TECH_INBOX_ALLOWED_EMAIL");

assert.match(
  accountId,
  /^[0-9a-f]{32}$/i,
  "CLOUDFLARE_ACCOUNT_ID must be a 32-character hexadecimal account ID.",
);
assert.ok(
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allowedEmail),
  "TECH_INBOX_ALLOWED_EMAIL must contain one email address.",
);

async function cloudflareGet(path, label) {
  const response = await fetch(new URL(`${apiPrefix}${path}`, apiOrigin), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(15_000),
  });

  const payload = await response.json().catch(() => undefined);
  const errors = Array.isArray(payload?.errors)
    ? payload.errors
        .map((error) => (typeof error?.message === "string" ? error.message : undefined))
        .filter(Boolean)
    : [];

  assert.ok(
    response.ok && payload?.success === true,
    `${label} failed with HTTP ${response.status}${errors.length > 0 ? `: ${errors.join("; ")}` : "."}`,
  );
  return payload.result;
}

function requiredEnvironmentVariable(name) {
  const value = process.env[name]?.trim();
  assert.ok(value, `${name} is required in the process environment.`);
  return value;
}

function namedResources(result, property, label) {
  assert.ok(Array.isArray(result), `${label} did not return a resource list.`);
  return result.flatMap((resource) => {
    const name = resource?.[property];
    return typeof name === "string" ? [name] : [];
  });
}

function existingState(resourceNames, expectedNames) {
  return expectedNames.map((name) => ({
    name,
    state: resourceNames.includes(name) ? "exists" : "absent",
  }));
}

const accountPath = `/accounts/${accountId}`;
const tokenResult = await cloudflareGet(
  `${accountPath}/tokens/verify`,
  "Account API token verification",
);
assert.equal(tokenResult?.status, "active", "CLOUDFLARE_API_TOKEN is not active.");

const [account, workersSubdomain, organization, databases, queues, workers, accessApplications] =
  await Promise.all([
    cloudflareGet(accountPath, "Account verification"),
    cloudflareGet(`${accountPath}/workers/subdomain`, "Workers subdomain verification"),
    cloudflareGet(`${accountPath}/access/organizations`, "Zero Trust organization verification"),
    cloudflareGet(`${accountPath}/d1/database?per_page=100`, "D1 permission verification"),
    cloudflareGet(`${accountPath}/queues?per_page=100`, "Queues permission verification"),
    cloudflareGet(`${accountPath}/workers/scripts`, "Workers permission verification"),
    cloudflareGet(`${accountPath}/access/apps?per_page=100`, "Access permission verification"),
  ]);

assert.equal(account?.id, accountId, "The token did not return the requested account.");
assert.ok(
  typeof workersSubdomain?.subdomain === "string" && workersSubdomain.subdomain.length > 0,
  "A workers.dev subdomain is not configured for this account.",
);
assert.ok(
  typeof organization?.auth_domain === "string" &&
    organization.auth_domain.endsWith(".cloudflareaccess.com"),
  "A Zero Trust organization and team domain must be configured before deployment.",
);

const resourceState = {
  accessApplications: existingState(
    namedResources(accessApplications, "name", "Access applications"),
    ["tech-inbox-app"],
  ),
  databases: existingState(namedResources(databases, "name", "D1 databases"), ["tech-inbox"]),
  queues: existingState(namedResources(queues, "queue_name", "Queues"), [
    "tech-inbox-metadata",
    "tech-inbox-metadata-dlq",
  ]),
  workers: existingState(namedResources(workers, "id", "Workers"), [
    "tech-inbox-app",
    "tech-inbox-metadata-fetcher",
  ]),
};

console.info("Cloudflare Phase 9 read-only preflight passed.");
console.info("Credentials, account details, team domain, and allowed email were not printed.");
console.table(resourceState.databases);
console.table(resourceState.queues);
console.table(resourceState.workers);
console.table(resourceState.accessApplications);
