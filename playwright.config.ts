import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile-chrome-320",
      use: {
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
        viewport: { width: 320, height: 700 },
      },
    },
  ],
  webServer: {
    command: "pnpm --dir apps/web exec vite preview --host 127.0.0.1 --port 4173",
    env: {
      ALLOWED_EMAIL: "ci-owner@example.invalid",
      POLICY_AUD: "ci-only-placeholder",
      TEAM_DOMAIN: "https://ci-placeholder.invalid.cloudflareaccess.com",
    },
    reuseExistingServer: !process.env.CI,
    url: "http://127.0.0.1:4173/api/v1/health",
  },
});
