import { describe, expect, it } from "vitest";
import {
  assertExactAccessApplication,
  assertExactOwnerPolicy,
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
