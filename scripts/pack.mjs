import { mkdir, copyFile } from "node:fs/promises";
import { pnpm } from "./process.mjs";
await pnpm(["build"]);
await mkdir(".local/artifacts", { recursive: true });
for (const pkg of ["evaluation", "sdk-node", "service"]) {
  await copyFile("LICENSE", `packages/${pkg}/LICENSE`);
  await pnpm([
    "--dir",
    `packages/${pkg}`,
    "pack",
    "--pack-destination",
    "../../.local/artifacts",
  ]);
}
console.log("Release candidates are in .local/artifacts.");
