import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pnpm, run } from "../../scripts/process.mjs";

test(
  "an independent application installs emitted evaluator and declarations",
  { timeout: 120000 },
  async () => {
    await pnpm(["build"]);
    const directory = await mkdtemp(join(tmpdir(), "frs-consumer-"));
    try {
      await pnpm([
        "--dir",
        "packages/evaluation",
        "pack",
        "--pack-destination",
        directory,
      ]);
      const tarball = (await readdir(directory)).find((file) =>
        file.endsWith(".tgz"),
      );
      assert.ok(tarball);
      await writeFile(
        join(directory, "package.json"),
        JSON.stringify({ private: true, type: "module" }),
      );
      await pnpm([
        "--dir",
        directory,
        "add",
        "--ignore-scripts",
        join(directory, tarball),
      ]);
      const { configurations } = JSON.parse(
        await readFile("conformance/v1/evaluation.json", "utf8"),
      );
      const source = `import { evaluateBoolean, assignmentBucket, type Configuration } from '@feature-rollout/evaluation';\nconst configuration: Configuration = ${JSON.stringify(configurations.standard)};\nconst result = evaluateBoolean({ configuration, flagKey: 'ordered-rule', context: { schemaVersion: 'evaluation-context-v1', attributes: { region: 'BR', plan: 'pro' } }, fallbackValue: false, now: new Date('2026-01-01T00:00:00.000Z') });\nif (!result.value || result.reasonCode !== 'TARGETING_MATCH') throw new Error('Bad targeting');\nconsole.log(assignmentBucket({flagKey:'checkout-flow',salt:'rollout-1',value:'subject-a'}));`;
      await writeFile(join(directory, "consumer.ts"), source);
      await run(
        process.execPath,
        [
          resolve("node_modules/typescript/bin/tsc"),
          "--strict",
          "--skipLibCheck",
          "--module",
          "NodeNext",
          "--target",
          "ES2023",
          "--outDir",
          "build",
          "consumer.ts",
        ],
        { cwd: directory },
      );
      for (let i = 0; i < 2; i++)
        assert.equal(
          (
            await run(process.execPath, ["build/consumer.js"], {
              cwd: directory,
            })
          ).trim(),
          "97186",
        );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
