import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}", "test/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Domain/contract/metadata coverage is independent. UI keeps the host's
      // existing integration coverage gate plus injected-client tests here.
      exclude: ["src/**/*.test.ts", "src/app.tsx", "src/browser.ts", "src/client/**"],
      reporter: ["text", "json-summary"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
        "src/contracts/**": { branches: 90 },
        "src/core/url-normalization.ts": { branches: 90 },
        "src/metadata/url-policy.ts": { branches: 90 },
      },
    },
  },
});
