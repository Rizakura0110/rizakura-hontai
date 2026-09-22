import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

export function deploymentIdentity(config) {
  const name = config.name;
  assert.ok(
    typeof name === "string" && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name),
    "Invalid app Worker name.",
  );
  const origin = config.vars?.APP_ORIGIN;
  assert.ok(typeof origin === "string", "APP_ORIGIN is missing.");
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new Error("Invalid production APP_ORIGIN.");
  }
  assert.ok(
    url.protocol === "https:" &&
      url.origin === origin &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname.startsWith(`${name}.`) &&
      /^[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname),
    "APP_ORIGIN must match the app Worker's production workers.dev hostname.",
  );
  return {
    appWorkerName: name,
    applicationName: name,
    appOrigin: origin,
    artifactDirectory: name.replaceAll("-", "_"),
  };
}

export function readDeploymentConfig() {
  const config = JSON.parse(
    readFileSync(new URL("../apps/web/wrangler.jsonc", import.meta.url), "utf8"),
  );
  return { config, ...deploymentIdentity(config) };
}
