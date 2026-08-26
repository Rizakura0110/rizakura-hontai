import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "apps/**/*.{test,spec}.{ts,tsx}",
      "workers/**/*.{test,spec}.{ts,tsx}",
      "packages/**/*.{test,spec}.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage",
      include: ["apps/*/src/**/*.{ts,tsx}", "workers/*/src/**/*.ts", "packages/*/src/**/*.ts"],
      exclude: ["**/*.{test,spec}.{ts,tsx}", "apps/web/src/client/main.tsx"],
    },
  },
});
