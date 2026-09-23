import type { Plugin } from "vite";

// Resolved paths also cover relative imports that bypass package export conditions.
export function techInboxBoundary(): Plugin {
  return {
    name: "tech-inbox-browser-boundary",
    enforce: "pre",
    load(id) {
      if (
        this.environment.config.consumer === "client" &&
        /\/(?:packages|modules)\/tech-inbox\/(src|dist)\/(server|schema|metadata)(?:[/.])/.test(
          id.replaceAll("\\", "/"),
        )
      ) {
        this.error("Tech Inbox server/schema/metadata exports are forbidden in a browser build.");
      }
    },
  };
}
