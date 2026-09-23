import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { daymarkBoundary } from "./daymark-boundary.ts";
import { sharedRuntimeGuard } from "./shared-runtime.ts";
import { techInboxBoundary } from "./tech-inbox-boundary.ts";

export default defineConfig({
  appType: "mpa",
  resolve: {
    // Product submodules install independently; bundle one shared runtime.
    dedupe: ["react", "react-dom", "react-router", "zod", "drizzle-orm"],
  },
  environments: {
    client: {
      build: {
        rolldownOptions: {
          input: {
            portal: fileURLToPath(new URL("./index.html", import.meta.url)),
            techInbox: fileURLToPath(new URL("./tech-inbox/index.html", import.meta.url)),
            daymark: fileURLToPath(new URL("./daymark/index.html", import.meta.url)),
          },
        },
      },
    },
  },
  plugins: [
    daymarkBoundary(),
    techInboxBoundary(),
    sharedRuntimeGuard(),
    react(),
    tailwindcss(),
    cloudflare({
      auxiliaryWorkers: [{ configPath: "../../workers/metadata-fetcher/wrangler.jsonc" }],
    }),
  ],
});
