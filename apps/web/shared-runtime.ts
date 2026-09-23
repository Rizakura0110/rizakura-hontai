import type { Plugin } from "vite";

const sharedRuntimes = ["react", "react-dom", "react-router", "zod", "drizzle-orm"] as const;
const sharedRuntimeNames = new Set<string>(sharedRuntimes);
const packagePath = /(?:^|\/)node_modules\/([^/]+)(?=\/|$)/g;

export function duplicateSharedRuntimes(moduleIds: Iterable<string>) {
  const installations = new Map<string, Set<string>>();
  for (const id of moduleIds) {
    // Query/proxy suffixes and Windows separators do not create a new installation.
    const path = id.replaceAll("\\", "/").replace(/^\0+/, "").split(/[?#]/)[0] ?? "";
    // Only the innermost package owns a module, not any dependency ancestors.
    const match = [...path.matchAll(packagePath)].at(-1);
    const name = match?.[1];
    if (!match || !name || !sharedRuntimeNames.has(name)) continue;
    const roots = installations.get(name) ?? new Set<string>();
    roots.add(path.slice(0, match.index + match[0].length));
    installations.set(name, roots);
  }
  return sharedRuntimes.flatMap((name) => {
    const roots = installations.get(name);
    return roots && roots.size > 1 ? [{ name, roots: [...roots].sort() }] : [];
  });
}

export function sharedRuntimeGuard(): Plugin {
  return {
    name: "shared-runtime-single-installation",
    apply: "build",
    generateBundle(_options, bundle) {
      const renderedIds = new Set<string>();
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        for (const [id, module] of Object.entries(output.modules)) {
          if (module.renderedLength > 0) renderedIds.add(id);
        }
      }
      const duplicates = duplicateSharedRuntimes(renderedIds);
      if (duplicates.length > 0) {
        this.error(
          `Shared runtime packages must use one installation per build:\n${duplicates
            .map(({ name, roots }) => `${name}:\n${roots.map((root) => `  ${root}`).join("\n")}`)
            .join("\n")}`,
        );
      }
    },
  };
}
