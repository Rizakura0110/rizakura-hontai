import { describe, expect, it } from "vitest";
import { duplicateSharedRuntimes, sharedRuntimeGuard } from "../apps/web/shared-runtime.ts";

const packages = ["react", "react-dom", "react-router", "zod", "drizzle-orm"];
const root = "/workspace/node_modules/.pnpm";
const product = "/workspace/modules/tech-inbox/node_modules/.pnpm";

function checkBundle(bundle) {
  const hook = sharedRuntimeGuard().generateBundle;
  expect(typeof hook).toBe("function");
  hook.call(
    {
      error(message) {
        throw new Error(message);
      },
    },
    {},
    bundle,
    false,
  );
}

function chunk(modules) {
  return {
    type: "chunk",
    modules: Object.fromEntries(
      modules.map(([id, renderedLength = 10]) => [id, { renderedLength }]),
    ),
  };
}

describe("shared runtime build guard", () => {
  it.each(packages)(
    "rejects separate pnpm installations of %s even at the same version",
    (name) => {
      const installation = `${name}@1.0.0/node_modules/${name}`;
      expect(
        duplicateSharedRuntimes([
          `${root}/${installation}/index.js`,
          `${product}/${installation}/index.js`,
        ]),
      ).toEqual([{ name, roots: [`${product}/${installation}`, `${root}/${installation}`] }]);
    },
  );

  it("allows many subpaths and transformed module IDs from one installation", () => {
    expect(
      duplicateSharedRuntimes([
        "/workspace/node_modules/react/index.js",
        "/workspace/node_modules/react/jsx-runtime.js",
        "/workspace/node_modules/react/cjs/react.production.js",
        "/workspace/node_modules/react/index.js?commonjs-proxy",
        "\0/workspace/node_modules/react/index.js?commonjs-es-import",
        "/workspace/node_modules/react/index.js#fragment",
        "/workspace/node_modules/react-dom/client.js",
        "/workspace/node_modules/react-dom/server.browser.js",
        "/workspace/node_modules/zod/v4/classic/index.js",
        "/workspace/node_modules/zod/v4/core/index.js",
        "/workspace/node_modules/drizzle-orm/sqlite-core/index.js",
        "/workspace/node_modules/drizzle-orm/d1/index.js",
      ]),
    ).toEqual([]);
  });

  it("normalizes Windows paths without hiding separate installations", () => {
    expect(
      duplicateSharedRuntimes([
        "C:\\workspace\\node_modules\\react\\index.js",
        "C:/workspace/node_modules/react/jsx-runtime.js",
      ]),
    ).toEqual([]);
    expect(
      duplicateSharedRuntimes([
        "C:\\workspace\\node_modules\\react\\index.js",
        "C:\\workspace\\modules\\daymark\\node_modules\\react\\index.js",
      ]),
    ).toEqual([
      {
        name: "react",
        roots: [
          "C:/workspace/modules/daymark/node_modules/react",
          "C:/workspace/node_modules/react",
        ],
      },
    ]);
  });

  it("detects distinct peer-resolution directories and normal nested dependencies", () => {
    expect(
      duplicateSharedRuntimes([
        `${root}/react-router@8.3.0_react@19.2.8/node_modules/react-router/dist/index.js`,
        `${root}/react-router@8.3.0_react@19.2.7/node_modules/react-router/dist/index.js`,
        "/workspace/node_modules/zod/index.js",
        "/workspace/node_modules/other/node_modules/zod/index.js",
      ]).map(({ name }) => name),
    ).toEqual(["react-router", "zod"]);
  });

  it("does not mistake similar names, type packages or source folders for shared runtimes", () => {
    expect(
      duplicateSharedRuntimes([
        "/workspace/node_modules/react-refresh/runtime.js",
        "/workspace/node_modules/react-router-dom/index.js",
        "/workspace/node_modules/@types/react/index.d.ts",
        "/workspace/node_modules/@example/zod/index.js",
        "/workspace/src/react/index.ts",
        "/workspace/node_modules/zod-helper/index.js",
        "/workspace/node_modules/react/index.js",
        "/workspace/modules/daymark/node_modules/react/node_modules/other/index.js",
        "virtual:shared-runtime",
      ]),
    ).toEqual([]);
  });

  it("checks rendered modules across all output chunks", () => {
    expect(() =>
      checkBundle({
        "app.js": chunk([["/workspace/node_modules/zod/v4/core/index.js"]]),
        "daymark.js": chunk([["/workspace/modules/daymark/node_modules/zod/v4/core/index.js"]]),
      }),
    ).toThrow("Shared runtime packages must use one installation per build:\nzod:");
  });

  it("ignores assets, fully tree-shaken modules and repeated references to the same module", () => {
    expect(() =>
      checkBundle({
        "app.js": chunk([
          ["/workspace/node_modules/zod/v4/core/index.js"],
          ["/workspace/modules/daymark/node_modules/zod/v4/core/index.js", 0],
        ]),
        "tech-inbox.js": chunk([["/workspace/node_modules/zod/v4/core/index.js"]]),
        "style.css": { type: "asset", source: "body {}" },
      }),
    ).not.toThrow();
    expect(sharedRuntimeGuard().apply).toBe("build");
  });
});
