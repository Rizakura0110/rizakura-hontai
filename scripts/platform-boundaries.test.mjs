import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const externalImports = new Set([
  "react",
  "hono",
  "hono/utils/http-status",
  "jose",
  "@rizakura-me/contracts/http",
]);

function staticImports(source) {
  // Shared modules use static ESM only, so boundary checks need no compiler API.
  expect(source).not.toMatch(/\b(?:import|require)\s*\(/);
  return Array.from(
    source.matchAll(/\b(?:from\s*|import\s*)["']([^"']+)["']/g),
    (match) => match[1],
  );
}

describe("shared platform import boundaries", () => {
  it.each(["apps/web/src/client/platform", "apps/web/src/worker/platform"])(
    "%s does not depend on a product implementation",
    (directory) => {
      const base = resolve(root, directory);
      const files = readdirSync(base).filter(
        (file) => /\.tsx?$/.test(file) && !file.includes(".test."),
      );
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const source = readFileSync(resolve(base, file), "utf8");
        for (const specifier of staticImports(source)) {
          if (specifier.startsWith(".")) {
            const target = relative(base, resolve(base, specifier));
            expect(target === ".." || target.startsWith(`..${sep}`), `${file}: ${specifier}`).toBe(
              false,
            );
          } else {
            expect(externalImports.has(specifier), `${file}: ${specifier}`).toBe(true);
          }
        }
      }
    },
  );
  it("keeps the shared HTTP contracts free of article domain imports", () => {
    const source = readFileSync(resolve(root, "packages/contracts/src/http.ts"), "utf8");
    expect(staticImports(source)).toEqual(["zod"]);
  });
});
