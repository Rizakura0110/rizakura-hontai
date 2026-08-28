import assert from "node:assert/strict";

export function assertExactAccessApplication(application, workerId) {
  assert.ok(
    typeof application?.id === "string" && application.id.length > 0,
    "The Access application ID is missing.",
  );
  assert.ok(
    typeof application?.aud === "string" && application.aud.length > 0,
    "The Access application audience tag is missing.",
  );
  assert.equal(application.type, "self_hosted", "The Access application type is not self_hosted.");
  assert.equal(
    application.session_duration,
    "168h",
    "The Access session duration is not seven days.",
  );
  assert.equal(
    application.app_launcher_visible,
    false,
    "The Access application must not be visible in the app launcher.",
  );
  assert.ok(
    Array.isArray(application.destinations),
    "Access application destinations are missing.",
  );
  assert.deepEqual(
    application.destinations.map(({ type, uri, worker_id: destinationWorkerId }) => ({
      type,
      uri,
      worker_id: destinationWorkerId,
    })),
    [{ type: "worker", uri: undefined, worker_id: workerId }],
    "The Access application does not target only the expected Worker.",
  );
}

export function assertExactOwnerPolicy(policies, allowedEmail) {
  assert.ok(Array.isArray(policies), "Access policies did not return a list.");
  assert.equal(policies.length, 1, "The Access application must have exactly one policy.");

  const [policy] = policies;
  assert.equal(policy?.decision, "allow", "The Access policy must use the allow decision.");
  assert.deepEqual(
    policy?.include,
    [{ email: { email: allowedEmail } }],
    "The Access policy must include only the configured owner email.",
  );
  assert.ok(
    policy?.exclude === undefined || (Array.isArray(policy.exclude) && policy.exclude.length === 0),
    "The Access policy must not contain exclusions.",
  );
  assert.ok(
    policy?.require === undefined || (Array.isArray(policy.require) && policy.require.length === 0),
    "The Access policy must not contain additional requirements.",
  );
}

export function assertWorkerSubdomainState(state, expected, label) {
  assert.deepEqual(
    {
      enabled: state?.enabled,
      previews_enabled: state?.previews_enabled,
    },
    expected,
    `${label} workers.dev or preview URL exposure does not match the expected state.`,
  );
}
