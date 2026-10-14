import { spawn } from "node:child_process";
import { pnpm } from "./process.mjs";

await pnpm(["build"]);
const children = [
  spawn(
    process.execPath,
    [
      "node_modules/typescript/bin/tsc",
      "--build",
      "packages/evaluation/tsconfig.build.json",
      "--watch",
    ],
    { stdio: "inherit", windowsHide: true },
  ),
  spawn(process.execPath, ["--watch", "examples/evaluation.mjs"], {
    stdio: "inherit",
    windowsHide: true,
  }),
];
function close() {
  for (const child of children) child.kill();
}
process.once("SIGINT", close);
process.once("SIGTERM", close);
for (const child of children) child.once("exit", close);
