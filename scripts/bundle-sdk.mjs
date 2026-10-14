import { build } from "esbuild";
import { rollup } from "rollup";
import { dts } from "rollup-plugin-dts";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import ts from "typescript";
const require = createRequire(import.meta.url);
await build({
  entryPoints: ["packages/sdk-node/dist/index.js"],
  outfile: "sdk/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  legalComments: "inline",
});
const types = await rollup({
  input: "packages/sdk-node/dist/index.d.ts",
  plugins: [
    {
      name: "workspace-declarations",
      resolveId(source) {
        if (source === "@feature-rollout/evaluation")
          return resolve("packages/evaluation/dist/index.d.ts");
        if (source === "@sinclair/typebox")
          return require
            .resolve(source, { paths: [resolve("packages/evaluation")] })
            .replace(/\.js$/, ".d.ts");
        return null;
      },
    },
    dts({
      respectExternal: true,
      compilerOptions: {
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      },
    }),
  ],
  external: (source) => source.startsWith("node:"),
});
try {
  await types.write({ file: "sdk/index.d.ts", format: "es" });
} finally {
  await types.close();
}
await copyFile("LICENSE", "sdk/LICENSE");
const typebox = resolve("packages/evaluation/node_modules/@sinclair/typebox");
const canonical = resolve("packages/evaluation/node_modules/json-canonicalize");
await writeFile(
  "sdk/THIRD_PARTY_NOTICES.md",
  "# Third-party notices\n\n## TypeBox\n\n" +
    (await readFile(join(typebox, "license"), "utf8")) +
    "\n## json-canonicalize\n\n" +
    (await readFile(join(canonical, "LICENSE.md"), "utf8")),
);
