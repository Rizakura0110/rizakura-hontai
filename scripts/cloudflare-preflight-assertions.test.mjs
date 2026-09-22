import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import {
  assertAccountWorkerOrigin,
  assertExactAccessApplication,
  assertExactDatabaseBinding,
  assertExactOwnerPolicy,
  assertAppOriginBinding,
  assertSingleQueueConsumer,
  assertNoConflictingAccessApplication,
  assertWorkerSubdomainState,
} from "./cloudflare-preflight-assertions.mjs";

const workerId = "a".repeat(32);
const allowedEmail = "owner@example.com";

function validApplication() {
  return {
    app_launcher_visible: false,
    aud: "audience-tag",
    destinations: [{ type: "worker", worker_id: workerId }],
    id: "application-id",
    session_duration: "168h",
    type: "self_hosted",
  };
}

function validPolicies() {
  return [
    {
      decision: "allow",
      include: [{ email: { email: allowedEmail } }],
    },
  ];
}

describe("Cloudflare read-only preflight assertions", () => {
  it("requires the exact origin from the Worker name and the actual account subdomain", () => {
    expect(() =>
      assertAccountWorkerOrigin(
        "https://rizakura-hontai.example.workers.dev",
        "rizakura-hontai",
        "example",
      ),
    ).not.toThrow();
  });

  it.each([
    ["https://rizakura-hontai.other.workers.dev", "example"],
    ["https://tech-inbox-app.example.workers.dev", "example"],
    ["http://rizakura-hontai.example.workers.dev", "example"],
    ["https://rizakura-hontai.example.workers.dev/", "example"],
    ["https://rizakura-hontai.example.workers.dev:443", "example"],
    ["https://rizakura-hontai.example.workers.dev", ""],
    ["https://rizakura-hontai.example.workers.dev", undefined],
    ["https://rizakura-hontai.example.workers.dev", null],
  ])("rejects an origin or account subdomain mismatch", (origin, subdomain) => {
    expect(() => assertAccountWorkerOrigin(origin, "rizakura-hontai", subdomain)).toThrow();
  });

  it("does not expose either hostname when account-origin verification fails", () => {
    const origin = "https://private-worker.configured-subdomain.workers.dev";
    let failure;
    try {
      assertAccountWorkerOrigin(origin, "private-worker", "actual-subdomain");
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    const details = inspect(failure);
    for (const value of [origin, "private-worker", "configured-subdomain", "actual-subdomain"]) {
      expect(details).not.toContain(value);
    }
  });

  it("requires the current origin and exactly one renamed Queue consumer", () => {
    const origin = "https://rizakura-hontai.example.workers.dev";
    const binding = { name: "APP_ORIGIN", type: "plain_text", text: origin };
    expect(() => assertAppOriginBinding([binding], origin)).not.toThrow();
    for (const bindings of [[], [binding, binding], [{ ...binding, text: "old-origin" }]]) {
      expect(() => assertAppOriginBinding(bindings, origin)).toThrow();
    }
    expect(() =>
      assertSingleQueueConsumer({ consumers: [{ script: "rizakura-hontai" }] }, "rizakura-hontai"),
    ).not.toThrow();
    for (const consumers of [
      [],
      [{ script: "tech-inbox-app" }],
      [{ script: "rizakura-hontai" }, { script: "tech-inbox-app" }],
    ]) {
      expect(() => assertSingleQueueConsumer({ consumers }, "rizakura-hontai")).toThrow();
    }
  });

  it("refuses a duplicate Access application when only the name changed", () => {
    expect(() => assertNoConflictingAccessApplication([], workerId)).not.toThrow();
    expect(() =>
      assertNoConflictingAccessApplication(
        [{ name: "legacy", destinations: [{ type: "worker", worker_id: workerId }] }],
        workerId,
      ),
    ).toThrow("another name");
  });

  it("requires the configured D1 name, ID and single Worker binding even when the old DB remains", () => {
    const expected = { binding: "DB", database_name: "rizakura-hontai", database_id: "new-id" };
    const databases = [
      { name: "tech-inbox", uuid: "old-id" },
      { name: "rizakura-hontai", uuid: "new-id" },
    ];
    const bindings = [
      { name: "DB", type: "d1", id: "new-id" },
      { name: "ASSETS", type: "assets" },
    ];
    expect(() => assertExactDatabaseBinding(databases, bindings, expected)).not.toThrow();
    for (const invalid of [
      [],
      [{ name: "DB", type: "d1", id: "old-id" }],
      [...bindings, { name: "OLD_DB", type: "d1", id: "old-id" }],
    ]) {
      expect(() => assertExactDatabaseBinding(databases, invalid, expected)).toThrow();
    }
    expect(() =>
      assertExactDatabaseBinding(databases, bindings, { ...expected, database_name: "missing" }),
    ).toThrow();
    expect(() =>
      assertExactDatabaseBinding([...databases, databases[1]], bindings, expected),
    ).toThrow();
  });

  it("accepts the exact private Access application", () => {
    expect(() => assertExactAccessApplication(validApplication(), workerId)).not.toThrow();
  });

  it.each([
    ["another target", { destinations: [{ type: "worker", worker_id: "b".repeat(32) }] }],
    ["app launcher exposure", { app_launcher_visible: true }],
    ["short session", { session_duration: "24h" }],
  ])("rejects %s", (_label, override) => {
    expect(() =>
      assertExactAccessApplication({ ...validApplication(), ...override }, workerId),
    ).toThrow();
  });

  it("accepts only the exact owner allow policy", () => {
    expect(() => assertExactOwnerPolicy(validPolicies(), allowedEmail)).not.toThrow();
  });

  it("does not expose either owner email when validation fails", () => {
    let failure;
    try {
      assertExactOwnerPolicy(validPolicies(), "typo@example.com");
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(inspect(failure)).not.toContain(allowedEmail);
    expect(inspect(failure)).not.toContain("typo@example.com");
  });

  it.each([
    ["an additional policy", [...validPolicies(), ...validPolicies()]],
    [
      "another email",
      [{ decision: "allow", include: [{ email: { email: "other@example.com" } }] }],
    ],
    ["an everyone rule", [{ decision: "allow", include: [{ everyone: {} }] }]],
  ])("rejects %s", (_label, policies) => {
    expect(() => assertExactOwnerPolicy(policies, allowedEmail)).toThrow();
  });

  it("accepts the intended app and fetcher subdomain states", () => {
    expect(() =>
      assertWorkerSubdomainState(
        { enabled: true, previews_enabled: false },
        { enabled: true, previews_enabled: false },
        "app Worker",
      ),
    ).not.toThrow();
    expect(() =>
      assertWorkerSubdomainState(
        { enabled: false, previews_enabled: false },
        { enabled: false, previews_enabled: false },
        "metadata fetcher",
      ),
    ).not.toThrow();
  });

  it("rejects an exposed metadata fetcher", () => {
    expect(() =>
      assertWorkerSubdomainState(
        { enabled: true, previews_enabled: false },
        { enabled: false, previews_enabled: false },
        "metadata fetcher",
      ),
    ).toThrow();
  });
});
