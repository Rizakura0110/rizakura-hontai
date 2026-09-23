import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { techInboxBoundary } from "../apps/web/tech-inbox-boundary.ts";

const webRoot = fileURLToPath(new URL("../apps/web/", import.meta.url));
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { build } = await import(pathToFileURL(require.resolve("vite")).href);
const virtualEntry = `${webRoot}__tech_inbox_boundary__.ts`;

async function bundle(entrypoint, server = false, direct = false) {
  const source = entrypoint === "app" ? "app.tsx" : `${entrypoint}.ts`;
  return build({
    configFile: false,
    root: webRoot,
    logLevel: "silent",
    ...(server ? { resolve: { conditions: ["workerd", "browser"] } } : {}),
    plugins: [
      techInboxBoundary(),
      {
        name: "tech-inbox-boundary-fixture",
        resolveId: (id) => (id === virtualEntry ? id : undefined),
        load: (id) =>
          id === virtualEntry
            ? `export * from "${direct ? `../../packages/tech-inbox/src/${source}` : `@rizakura-hontai/tech-inbox/${entrypoint}`}";`
            : undefined,
      },
    ],
    ssr: { noExternal: ["@rizakura-hontai/tech-inbox"] },
    build: {
      write: false,
      ...(server ? { ssr: virtualEntry } : { lib: { entry: virtualEntry, formats: ["es"] } }),
    },
  });
}

for (const entrypoint of ["app", "browser", "contracts", "core"]) {
  const result = await bundle(entrypoint);
  const bundles = Array.isArray(result) ? result : [result];
  for (const output of bundles) {
    for (const chunk of output.output) {
      if (chunk.type !== "chunk") continue;
      assert.ok(Object.keys(chunk.modules).some((id) => id.includes("tech-inbox/src/")));
      assert.ok(
        Object.keys(chunk.modules).every(
          (id) => !/tech-inbox\/src\/(server|schema|metadata)(?:[/.])/.test(id),
        ),
      );
    }
  }
}
for (const entrypoint of ["server", "schema", "metadata"]) {
  await bundle(entrypoint, true);
  for (const direct of [false, true]) {
    await assert.rejects(
      () => bundle(entrypoint, false, direct),
      (error) => {
        const message = String(error);
        return message.includes(entrypoint) && /export|specifier|conditions/i.test(message);
      },
      `Browser must not import Tech Inbox ${entrypoint} (${direct ? "source" : "package"}).`,
    );
  }
}
console.info(
  "Tech Inbox entrypoints: app/browser/contracts/core build; server/schema/metadata build only on server.",
);
