import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { run } from "./process.mjs";

const directory = await mkdtemp(join(tmpdir(), "frs-artifacts-"));
try {
  await run(process.execPath, [
    "scripts/bundle-sdk.mjs",
    join(directory, "sdk"),
  ]);
  await run(process.execPath, [
    "scripts/export-schemas.mjs",
    join(directory, "schemas"),
  ]);
  for (const name of [
    "index.js",
    "index.d.ts",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
  ]) {
    const actual = await readFile(join("sdk", name), "utf8");
    const expected = await readFile(join(directory, "sdk", name), "utf8");
    if (actual.replaceAll("\r\n", "\n") !== expected.replaceAll("\r\n", "\n"))
      throw new Error(
        `Stale sdk/${name}. Run pnpm build and include its output.`,
      );
  }
  for (const name of [
    "configuration-v1",
    "configuration-v2",
    "evaluation-context-v1",
  ]) {
    const actual = JSON.parse(
      await readFile(`docs/schemas/${name}.json`, "utf8"),
    );
    const expected = JSON.parse(
      await readFile(join(directory, "schemas", `${name}.json`), "utf8"),
    );
    if (!isDeepStrictEqual(actual, expected))
      throw new Error(
        `Stale schema ${name}. Run pnpm schemas:generate and include its output.`,
      );
  }
  console.log("SDK artifacts and portable schemas match maintained source.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
