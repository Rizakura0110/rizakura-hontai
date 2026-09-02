import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { daymarkBoundary } from "./daymark-boundary.ts";

export default defineConfig({
  appType: "mpa",
  resolve: {
    dedupe: ["react", "react-dom"],
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
    react(),
    tailwindcss(),
    cloudflare({
      auxiliaryWorkers: [{ configPath: "../../workers/metadata-fetcher/wrangler.jsonc" }],
    }),
  ],
});
