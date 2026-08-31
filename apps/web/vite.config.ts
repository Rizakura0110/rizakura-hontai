import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  appType: "mpa",
  environments: {
    client: {
      build: {
        rolldownOptions: {
          input: {
            portal: fileURLToPath(new URL("./index.html", import.meta.url)),
            techInbox: fileURLToPath(new URL("./tech-inbox/index.html", import.meta.url)),
          },
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    cloudflare({
      auxiliaryWorkers: [{ configPath: "../../workers/metadata-fetcher/wrangler.jsonc" }],
    }),
  ],
});
