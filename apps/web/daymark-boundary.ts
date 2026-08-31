import type { Plugin } from "vite";

// Check resolved source as well as package exports: bundlers may interpret null
// export conditions differently, and relative imports must not bypass this boundary.
export function daymarkBoundary(): Plugin {
  return {
    name: "daymark-browser-boundary",
    enforce: "pre",
    load(id) {
      if (
        this.environment.config.consumer === "client" &&
        /\/modules\/daymark\/(src|dist)\/(server|schema)(?:[/.])/.test(id.replaceAll("\\", "/"))
      ) {
        this.error("Daymark server/schema exports are forbidden in a browser build.");
      }
    },
  };
}
