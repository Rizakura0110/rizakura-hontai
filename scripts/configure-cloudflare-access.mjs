import assert from "node:assert/strict";
import {
  assertExactAccessApplication,
  assertExactOwnerPolicy,
} from "./cloudflare-preflight-assertions.mjs";

const apiOrigin = "https://api.cloudflare.com";
const apiPrefix = "/client/v4";
const applicationName = "tech-inbox-app";
const workerName = "tech-inbox-app";

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

function requiredEnvironmentVariable(name) {
  const value = process.env[name]?.trim();
  assert.ok(value, `${name} is required in the process environment.`);
  return value;
}

async function cloudflareRequest(method, path, label, body) {
  const response = await fetch(new URL(`${apiPrefix}${path}`, apiOrigin), {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
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

const accountPath = `/accounts/${accountId}`;
const [organization, workers, applications] = await Promise.all([
  cloudflareRequest("GET", `${accountPath}/access/organizations`, "Zero Trust organization lookup"),
  cloudflareRequest("GET", `${accountPath}/workers/scripts`, "Worker lookup"),
  cloudflareRequest("GET", `${accountPath}/access/apps?per_page=100`, "Access application lookup"),
]);

assert.ok(
  typeof organization?.auth_domain === "string" &&
    organization.auth_domain.endsWith(".cloudflareaccess.com"),
  "A valid Zero Trust team domain was not found.",
);
assert.ok(Array.isArray(workers), "Worker lookup did not return a list.");
assert.ok(Array.isArray(applications), "Access application lookup did not return a list.");

const matchingWorkers = workers.filter((worker) => worker?.id === workerName);
assert.equal(matchingWorkers.length, 1, `Expected exactly one ${workerName} Worker.`);
const workerId = matchingWorkers[0]?.tag;
assert.match(workerId ?? "", /^[0-9a-f]{32}$/i, "The Worker immutable ID is missing or invalid.");

const matchingApplications = applications.filter(
  (application) => application?.name === applicationName,
);
assert.ok(
  matchingApplications.length <= 1,
  `More than one Access application is named ${applicationName}.`,
);

let application = matchingApplications[0];
let applicationWasCreated = false;

if (application === undefined) {
  application = await cloudflareRequest(
    "POST",
    `${accountPath}/access/apps`,
    "Access application creation",
    {
      app_launcher_visible: false,
      destinations: [{ type: "worker", worker_id: workerId }],
      name: applicationName,
      policies: [
        {
          decision: "allow",
          include: [{ email: { email: allowedEmail } }],
          name: "Allow owner email",
          precedence: 1,
        },
      ],
      session_duration: "168h",
      type: "self_hosted",
    },
  );
  applicationWasCreated = true;
} else {
  assert.ok(
    typeof application.id === "string" && application.id.length > 0,
    "The existing Access application ID is missing.",
  );
  application = await cloudflareRequest(
    "GET",
    `${accountPath}/access/apps/${application.id}`,
    "Access application verification",
  );
}

assertExactAccessApplication(application, workerId);

const policies = await cloudflareRequest(
  "GET",
  `${accountPath}/access/apps/${application.id}/policies?per_page=100`,
  "Access policy verification",
);
assertExactOwnerPolicy(policies, allowedEmail);

const secrets = [
  { name: "TEAM_DOMAIN", text: `https://${organization.auth_domain}` },
  { name: "POLICY_AUD", text: application.aud },
  { name: "ALLOWED_EMAIL", text: allowedEmail },
];

for (const secret of secrets) {
  await cloudflareRequest(
    "PUT",
    `${accountPath}/workers/scripts/${workerName}/secrets`,
    `Worker secret ${secret.name} update`,
    { ...secret, type: "secret_text" },
  );
}

console.info(
  applicationWasCreated
    ? "Created the Worker-level Access application."
    : "Verified the existing Worker-level Access application.",
);
console.info("Verified the exact owner-email allow policy and seven-day session duration.");
console.info("Configured TEAM_DOMAIN, POLICY_AUD, and ALLOWED_EMAIL as Worker secrets.");
console.info("No credential, team domain, audience tag, or email value was printed.");
