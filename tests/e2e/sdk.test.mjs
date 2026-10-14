import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fork } from "node:child_process";
import { startPostgres } from "../../scripts/postgres.mjs";
import { pnpm, run } from "../../scripts/process.mjs";
import { Store } from "../../packages/service/dist/store.js";
import { createService } from "../../packages/service/dist/server.js";

test(
  "installed SDK integrates with a real service, kill/rollback, outages, and recovery",
  { timeout: 120000 },
  async () => {
    await pnpm(["build"]);
    const db = await startPostgres();
    const directory = await mkdtemp(join(tmpdir(), "frs-sdk-consumer-"));
    const store = new Store(db.connectionString);
    let app;
    let child;
    const credentials = [
      {
        token: "synthetic-admin-token",
        actor: "admin",
        permission: "write",
        environments: ["*"],
      },
      {
        token: "synthetic-read-token",
        actor: "app",
        permission: "read",
        environments: ["test"],
      },
    ];
    const pending = new Map();
    let requestId = 0;
    let logs = "";
    try {
      await store.migrate();
      app = await createService({ store, credentials });
      const url = await app.listen({ port: 0, host: "127.0.0.1" });
      const port = new URL(url).port;
      async function request(path, body) {
        const response = await fetch(url + path, {
          method: "POST",
          headers: {
            authorization: "Bearer synthetic-admin-token",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        assert.equal(response.status, 200, JSON.stringify(payload));
        return payload;
      }
      await request("/v1/environments", { name: "test" });
      const flags = JSON.parse(
        await readFile("conformance/v1/evaluation.json", "utf8"),
      ).configurations.standard.flags;
      let revision = 0;
      for (const flag of flags) {
        const response = await fetch(
          url + "/v1/environments/test/flags/" + flag.key,
          {
            method: "PUT",
            headers: {
              authorization: "Bearer synthetic-admin-token",
              "content-type": "application/json",
            },
            body: JSON.stringify({ expectedRevision: revision, flag }),
          },
        );
        assert.equal(response.status, 200);
        revision = (await response.json()).revision;
      }
      await request("/v1/environments/test/publish", {
        expectedRevision: revision,
        expectedActiveVersion: 0,
        idempotencyKey: "initial",
      });
      for (const pkg of ["evaluation", "sdk-node"])
        await pnpm([
          "--dir",
          "packages/" + pkg,
          "pack",
          "--pack-destination",
          directory,
        ]);
      const tarballs = (await readdir(directory)).filter((file) =>
        file.endsWith(".tgz"),
      );
      const evaluation = tarballs.find((file) => file.includes("evaluation"));
      assert.ok(evaluation);
      await writeFile(
        join(directory, "package.json"),
        JSON.stringify({
          private: true,
          type: "module",
          pnpm: {
            overrides: {
              "@feature-rollout/evaluation":
                "file:" + join(directory, evaluation).replaceAll("\\", "/"),
            },
          },
        }),
      );
      await writeFile(
        join(directory, "pnpm-workspace.yaml"),
        `packages: []\noverrides:\n  '@feature-rollout/evaluation': ${JSON.stringify("file:" + join(directory, evaluation).replaceAll("\\", "/"))}\n`,
      );
      await pnpm([
        "--dir",
        directory,
        "add",
        "--ignore-scripts",
        ...tarballs.map((file) => join(directory, file)),
      ]);
      await writeFile(
        join(directory, "types.ts"),
        "import { RolloutClient } from '@feature-rollout/sdk-node';\nconst client = new RolloutClient({url:'http://localhost',token:'synthetic-read-token',environment:'test'});\nconst value: boolean = client.boolean('feature',{targetingKey:'subject-a'},false);\nconsole.log(value);\nvoid client.close();",
      );
      await run(
        process.execPath,
        [
          resolve("node_modules/typescript/bin/tsc"),
          "--strict",
          "--skipLibCheck",
          "--noEmit",
          "--module",
          "NodeNext",
          "--target",
          "ES2023",
          "types.ts",
        ],
        { cwd: directory },
      );
      await writeFile(
        join(directory, "app.mjs"),
        `import {RolloutClient} from '@feature-rollout/sdk-node';\nlet now=0, requests=0;\nconst client=new RolloutClient({url:process.env.FRS_URL,token:'synthetic-read-token',environment:'test',maxAgeMs:100,refreshIntervalMs:60000,requestTimeoutMs:250,now:()=>now,fetch:(...args)=>{requests++;return fetch(...args);}});\nprocess.on('message',async message=>{if(message.now!==undefined)now=message.now;let value;if(message.operation==='refresh')value=await client.refresh();else if(message.operation==='close'){await client.close();process.send({id:message.id,value:true});process.disconnect();return;}else value={details:client.booleanDetails(message.key??'ordered-rule',message.context??{attributes:{region:'BR',plan:'pro'}},false),requests,status:client.status()};process.send({id:message.id,value});});\ntry{await client.start();process.send({id:0,value:'ready'});}catch(error){process.send({id:0,error:error.message});await client.close();process.disconnect();}`,
      );
      child = fork(join(directory, "app.mjs"), [], {
        cwd: directory,
        env: { ...process.env, FRS_URL: url },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        windowsHide: true,
      });
      child.stdout.on("data", (chunk) => {
        logs += chunk;
      });
      child.stderr.on("data", (chunk) => {
        logs += chunk;
      });
      child.on("message", (message) => {
        const waiter = pending.get(message.id);
        if (waiter) {
          clearTimeout(waiter.timer);
          pending.delete(message.id);
          if (message.error) waiter.reject(new Error(message.error));
          else waiter.resolve(message.value);
        }
      });
      function wait(id) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error("Consumer timeout\n" + logs));
          }, 10000);
          pending.set(id, { resolve, reject, timer });
        });
      }
      function call(operation, args = {}) {
        const id = ++requestId;
        const result = wait(id);
        child.send({ id, operation, ...args });
        return result;
      }
      assert.equal(await wait(0), "ready");
      const initial = await call("evaluate");
      assert.equal(initial.details.value, true);
      assert.equal(initial.details.ruleId, "region-first");
      for (let i = 0; i < 10; i++)
        assert.equal((await call("evaluate")).requests, initial.requests);
      const percent = await call("evaluate", {
        key: "checkout-flow",
        context: { targetingKey: "subject-a" },
      });
      assert.equal(percent.details.bucket, 97186);
      assert.equal(await call("refresh", { now: 50 }), true);
      await request("/v1/environments/test/flags/ordered-rule/kill", {
        expectedRevision: revision,
        expectedActiveVersion: 1,
        idempotencyKey: "kill",
      });
      await call("refresh");
      assert.equal((await call("evaluate")).details.value, false);
      await request("/v1/environments/test/rollback", {
        expectedRevision: revision,
        expectedActiveVersion: 2,
        idempotencyKey: "rollback",
        version: 1,
      });
      await call("refresh");
      assert.equal((await call("evaluate")).details.value, true);
      await app.close();
      app = undefined;
      assert.equal((await call("evaluate", { now: 149 })).details.value, true);
      assert.equal(await call("refresh", { now: 150 }), false);
      assert.equal(
        (await call("evaluate")).details.reasonCode,
        "DEFAULT_STALE_CONFIGURATION",
      );
      app = await createService({ store, credentials });
      await app.listen({ port: Number(port), host: "127.0.0.1" });
      assert.equal(await call("refresh", { now: 200 }), true);
      assert.equal((await call("evaluate")).details.value, true);
      assert.equal(await call("close"), true);
      await new Promise((resolve) => child.once("exit", resolve));
      child = undefined;
    } finally {
      for (const waiter of pending.values()) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error("Test ended"));
      }
      child?.kill();
      await app?.close();
      await store.close();
      await db.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
