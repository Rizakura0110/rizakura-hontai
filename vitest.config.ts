import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Keep host and independently installed product fixtures on one React renderer.
    dedupe: [
      "react",
      "react-dom",
      "react-router",
      "zod",
      "drizzle-orm",
      "@testing-library/react",
      "@testing-library/dom",
      "@testing-library/user-event",
    ],
  },
  test: {
    environment: "node",
    include: [
      "apps/**/*.{test,spec}.{ts,tsx}",
      "workers/**/*.{test,spec}.{ts,tsx}",
      "packages/**/*.{test,spec}.{ts,tsx}",
      "modules/tech-inbox/**/*.{test,spec}.{ts,tsx}",
      "scripts/**/*.{test,spec}.mjs",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage",
      include: [
        "apps/*/src/**/*.{ts,tsx}",
        "workers/*/src/**/*.ts",
        "packages/*/src/**/*.{ts,tsx}",
        "modules/tech-inbox/src/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.{test,spec}.{ts,tsx}",
        "apps/web/src/client/main.tsx",
        "apps/web/src/client/daymark.tsx",
        "apps/web/src/client/portal.tsx",
        // Runtime composition is covered by typecheck, dry-run builds, and integration/E2E gates.
        "apps/web/src/worker/index.ts",
        "apps/web/src/worker/d1-article-repository.integration-fixture.ts",
        "workers/metadata-fetcher/src/index.ts",
        // The D1 adapter is exercised against a real local D1 process by api:verify:local.
        "apps/web/src/worker/repositories/d1-article-repository.ts",
        "apps/web/src/worker/repositories/d1-daymark-repository.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
        "packages/contracts/src/**": { branches: 90 },
        "modules/tech-inbox/src/contracts/**": { branches: 90 },
        "modules/tech-inbox/src/core/url-normalization.ts": { branches: 90 },
        "modules/tech-inbox/src/metadata/url-policy.ts": { branches: 90 },
      },
    },
  },
});
