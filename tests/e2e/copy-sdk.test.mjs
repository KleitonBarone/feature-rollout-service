import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { run } from "../../scripts/process.mjs";

test(
  "copied SDK works without node_modules or workspace and has standalone declarations",
  { timeout: 60000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "frs-copy-"));
    try {
      await cp("sdk", join(directory, "sdk"), { recursive: true });
      await writeFile(
        join(directory, "package.json"),
        '{"private":true,"type":"module"}',
      );
      await writeFile(
        join(directory, "consumer.ts"),
        `import {RolloutClient} from './sdk/index.js';\nconst client = new RolloutClient({url:'http://localhost',token:'synthetic-token',environment:'demo'});\nconst value: boolean = client.boolean('missing',{},false);\nif(value!==false)throw new Error('Bad fallback');\nconsole.log(value);\nawait client.close();`,
      );
      await run(
        process.execPath,
        [
          resolve("node_modules/typescript/bin/tsc"),
          "--strict",
          "--module",
          "NodeNext",
          "--target",
          "ES2023",
          "consumer.ts",
        ],
        { cwd: directory },
      );
      assert.equal(
        (
          await run(process.execPath, ["consumer.js"], { cwd: directory })
        ).trim(),
        "false",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
