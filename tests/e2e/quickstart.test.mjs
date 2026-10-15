import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { startPostgres } from "../../scripts/postgres.mjs";
import { run } from "../../scripts/process.mjs";
import { Store } from "../../packages/service/dist/store.js";
import { createService } from "../../packages/service/dist/server.js";

test(
  "documented quickstart publishes and runs the exact copied application",
  { timeout: 60000 },
  async () => {
    const db = await startPostgres();
    const directory = await mkdtemp(join(tmpdir(), "frs-quickstart-"));
    const store = new Store(db.connectionString);
    let app;
    try {
      await store.migrate();
      const settings = parseEnv(
        await readFile("examples/quickstart/service.env.example", "utf8"),
      );
      app = await createService({
        store,
        credentials: JSON.parse(settings.ROLLOUT_CREDENTIALS),
      });
      const url = await app.listen({ host: "127.0.0.1", port: 0 });
      const publish = () =>
        run(
          process.execPath,
          [
            "--env-file=examples/quickstart/service.env.example",
            "examples/quickstart/publish.mjs",
          ],
          {
            env: {
              ...process.env,
              ROLLOUT_URL: url,
              ROLLOUT_MANAGEMENT_TOKEN: settings.ROLLOUT_MANAGEMENT_TOKEN,
              ROLLOUT_ENVIRONMENT: "quickstart",
            },
          },
        );
      assert.equal(JSON.parse(await publish()).version, 1);
      assert.equal(JSON.parse(await publish()).reused, true);
      assert.equal((await store.events("quickstart")).length, 3);
      const consumer = join(directory, "application");
      await run(process.execPath, ["examples/quickstart/copy.mjs", consumer]);
      await assert.rejects(
        run(process.execPath, ["examples/quickstart/copy.mjs", consumer]),
        /EEXIST/,
      );
      const result = JSON.parse(
        await run(process.execPath, ["--env-file=.env", "app.mjs"], {
          cwd: consumer,
          env: {
            ...process.env,
            ROLLOUT_URL: url,
            ROLLOUT_ENVIRONMENT: "quickstart",
            ROLLOUT_READ_TOKEN: "local-quickstart-read-token",
            ROLLOUT_MANAGEMENT_TOKEN: "",
            ROLLOUT_CREDENTIALS: "",
            DATABASE_URL: "",
          },
        }),
      );
      assert.equal(result.value, true);
      assert.equal(result.reasonCode, "PERCENTAGE_MATCH");
      assert.equal(result.configurationVersion, 1);
      await store.edit("quickstart", 1, "operator", {
        type: "put",
        flag: {
          key: "unpublished",
          type: "boolean",
          defaultValue: true,
          rules: [],
        },
      });
      // A rerun must not publish unrelated pending work.
      assert.equal(JSON.parse(await publish()).reused, true);
      assert.equal((await store.publication("quickstart")).version, 1);
    } finally {
      await app?.close();
      await store.close();
      await db.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
