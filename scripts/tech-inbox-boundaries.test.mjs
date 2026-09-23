import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const product = join(root, "modules/tech-inbox");
const manifest = JSON.parse(readFileSync(join(product, "package.json"), "utf8"));
// Use the parser already pinned with the host's Vite/Rolldown toolchain.
const webRequire = createRequire(join(root, "apps/web/package.json"));
const viteRequire = createRequire(webRequire.resolve("vite/package.json"));
const { parseAst } = await import(pathToFileURL(viteRequire.resolve("rolldown/parseAst")).href);

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

function imports(path, source) {
  const specifiers = [];
  const tree = parseAst(source, { lang: path.endsWith(".tsx") ? "tsx" : "ts" }, path);
  function visit(node) {
    if (node === null || typeof node !== "object") return;
    if (
      ["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type) &&
      node.source
    ) {
      expect(typeof node.source.value, path).toBe("string");
      specifiers.push(node.source.value);
    }
    if (node.type === "TSImportType") {
      expect(typeof node.source.value, path).toBe("string");
      specifiers.push(node.source.value);
    }
    expect(["ImportExpression", "TSImportEqualsDeclaration"].includes(node.type), path).toBe(false);
    expect(node.type === "CallExpression" && node.callee?.name === "require", path).toBe(false);
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  }
  visit(tree);
  return specifiers;
}

describe("Tech Inbox package ownership", () => {
  it("parses static and type imports without treating text as dependencies", () => {
    expect(
      imports(
        "fixture.tsx",
        `import type { A } from "./first";
         export { B } from "./second";
         export * from "./third";
         type C = import("./fourth").C;
         const label = "import from outside";
         const view = <div>import from text</div>;`,
      ),
    ).toEqual(["./first", "./second", "./third", "./fourth"]);
    for (const source of [
      'import("./dynamic")',
      'require("./commonjs")',
      'import Local = require("./import-equals")',
    ]) {
      expect(() => imports("fixture.ts", source)).toThrow();
    }
  });

  it("has no foundation, Daymark, workspace or deployment dependency", () => {
    expect(manifest.private).toBe(true);
    const dependencies = {
      ...manifest.dependencies,
      ...manifest.peerDependencies,
      ...manifest.devDependencies,
    };
    for (const [name, version] of Object.entries(dependencies)) {
      expect(name).not.toMatch(/rizakura|tech-inbox|cloudflare|wrangler|hono|jose/);
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    }
    expect(Object.keys(manifest.scripts).join(" ")).not.toMatch(/deploy|publish|migrat/);
  });

  it("keeps product source and unit fixtures independent of the host repository", () => {
    const external = new Set([
      ...Object.keys(manifest.dependencies),
      ...Object.keys(manifest.peerDependencies),
      ...Object.keys(manifest.devDependencies),
    ]);
    const productFiles = [...files(join(product, "src")), ...files(join(product, "test"))];
    expect(productFiles.length).toBeGreaterThan(30);
    for (const path of productFiles) {
      const source = readFileSync(path, "utf8");
      for (const specifier of imports(path, source)) {
        if (specifier.startsWith(".")) {
          const target = relative(product, resolve(dirname(path), specifier));
          expect(target === ".." || target.startsWith(`..${sep}`), `${path}: ${specifier}`).toBe(
            false,
          );
        } else {
          const packageName = specifier.startsWith("@")
            ? specifier.split("/").slice(0, 2).join("/")
            : specifier.split("/")[0];
          const testOnlyNode =
            /(?:\.test\.tsx?$|\/test\/)/.test(path) && specifier.startsWith("node:");
          expect(testOnlyNode || external.has(packageName), `${path}: ${specifier}`).toBe(true);
        }
      }
      if (!/\.test\./.test(path) && path.startsWith(join(product, "src"))) {
        expect(source, path).not.toMatch(
          /\b(?:D1Database|CloudflareBindings|AppBindings|MessageBatch)\b/,
        );
      }
    }
  });

  it("keeps the foundation contracts product-independent and schema composition in the host", () => {
    const common = JSON.parse(readFileSync(join(root, "packages/contracts/package.json"), "utf8"));
    expect(Object.keys(common.dependencies)).toEqual(["zod"]);
    expect(readFileSync(join(root, "packages/contracts/src/index.ts"), "utf8")).toBe(
      'export * from "./http";\n',
    );
    const schema = readFileSync(join(root, "packages/db/src/schema.ts"), "utf8");
    expect(schema).toContain("@rizakura-hontai/tech-inbox/schema");
    expect(schema).toContain("@rizakura-hontai/daymark/schema");
    expect(schema).not.toContain("sqliteTable(");
  });

  it("exposes server-only exports separately from browser and contract entrypoints", () => {
    for (const name of ["server", "schema", "metadata"]) {
      expect(manifest.exports[`./${name}`]).toEqual({
        workerd: `./src/${name}.ts`,
        browser: null,
        default: `./src/${name}.ts`,
      });
    }
    expect(manifest.exports["."]).toBeUndefined();
  });
});
