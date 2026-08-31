import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { daymarkBoundary } from "../apps/web/daymark-boundary.ts";

const webRoot = fileURLToPath(new URL("../apps/web/", import.meta.url));
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { build } = await import(pathToFileURL(require.resolve("vite")).href);
const virtualEntry = `${webRoot}__daymark_boundary__.ts`;

async function bundle(entrypoint, server = false, direct = false) {
  return build({
    configFile: false,
    root: webRoot,
    logLevel: "silent",
    ...(server ? { resolve: { conditions: ["workerd", "browser"] } } : {}),
    plugins: [
      daymarkBoundary(),
      {
        name: "daymark-boundary-fixture",
        resolveId: (id) => (id === virtualEntry ? id : undefined),
        load: (id) =>
          id === virtualEntry
            ? `export * from "${direct ? `../../modules/daymark/src/${entrypoint}.ts` : `@rizakura-hontai/daymark/${entrypoint}`}";`
            : undefined,
      },
    ],
    ssr: { noExternal: ["@rizakura-hontai/daymark"] },
    build: {
      write: false,
      ...(server ? { ssr: virtualEntry } : { lib: { entry: virtualEntry, formats: ["es"] } }),
    },
  });
}

for (const entrypoint of ["browser", "contracts"]) {
  const result = await bundle(entrypoint);
  const bundles = Array.isArray(result) ? result : [result];
  for (const output of bundles) {
    for (const chunk of output.output) {
      if (chunk.type !== "chunk") continue;
      assert.ok(Object.keys(chunk.modules).some((id) => id.includes("daymark/src/")));
      assert.ok(
        Object.keys(chunk.modules).every((id) => !/daymark\/src\/(server|schema)\./.test(id)),
      );
    }
  }
}
for (const entrypoint of ["server", "schema"]) {
  await bundle(entrypoint, true);
  for (const direct of [false, true]) {
    await assert.rejects(
      () => bundle(entrypoint, false, direct),
      (error) => {
        const message = String(error);
        return message.includes(entrypoint) && /export|specifier|conditions/i.test(message);
      },
      `Browser must not import Daymark ${entrypoint} (${direct ? "source" : "package"}).`,
    );
  }
}
console.info("Daymark entrypoints: browser/contracts build; server/schema build only on server.");
