import { describe, expect, it } from "vitest";
import { deploymentIdentity, readDeploymentConfig } from "./cloudflare-deployment-config.mjs";

const config = {
  name: "rizakura-hontai",
  vars: { APP_ORIGIN: "https://rizakura-hontai.example.workers.dev" },
};

describe("shared production deployment identity", () => {
  it("uses one Worker name for Access, health, and build artifacts", () => {
    expect(deploymentIdentity(config)).toEqual({
      appWorkerName: "rizakura-hontai",
      applicationName: "rizakura-hontai",
      appOrigin: config.vars.APP_ORIGIN,
      artifactDirectory: "rizakura_hontai",
    });
    const current = readDeploymentConfig();
    expect(current.appWorkerName).toBe("rizakura-hontai");
    expect(current.config.d1_databases[0].database_name).toBe("rizakura-hontai");
  });

  it.each([
    "https://tech-inbox-app.example.workers.dev",
    "http://rizakura-hontai.example.workers.dev",
    "https://rizakura-hontai.example.workers.dev/",
    "https://rizakura-hontai.example.workers.dev:8080",
    "https://rizakura-hontai.example.workers.dev?x=1",
    "https://rizakura-hontai.example.workers.dev#x",
    "https://user@rizakura-hontai.example.workers.dev",
    "https://rizakura-hontai.example.workers.dev.attacker.invalid",
    "https://preview-rizakura-hontai.example.workers.dev",
    "invalid",
    undefined,
  ])("rejects a mismatched or unsafe origin without exposing its value", (origin) => {
    expect(() => deploymentIdentity({ ...config, vars: { APP_ORIGIN: origin } })).toThrow();
  });

  it.each(["../escape", "-worker", "worker-", "", "x".repeat(64), undefined])(
    "rejects unsafe Worker names",
    (name) => expect(() => deploymentIdentity({ ...config, name })).toThrow("Worker name"),
  );
});
