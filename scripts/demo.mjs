import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { startPostgres } from "./postgres.mjs";
import { pnpm } from "./process.mjs";

await pnpm(["build"]);
const { Store } = await import("../packages/service/dist/store.js");
const { createService } = await import("../packages/service/dist/server.js");
const { RolloutClient } = await import("../packages/sdk-node/dist/index.js");
await mkdir(".local", { recursive: true });
const database = await startPostgres({
  directory: resolve(".local/demo-postgres"),
});
const store = new Store(database.connectionString);
const token = randomBytes(24).toString("hex");
let service;
let client;
let application;
async function close() {
  await client?.close();
  if (application) await new Promise((resolve) => application.close(resolve));
  await service?.close();
  await store.close();
  await database.close();
}
try {
  await store.migrate();
  service = await createService({
    store,
    credentials: [
      {
        token,
        actor: "local-demo",
        permission: "write",
        environments: ["demo"],
      },
    ],
  });
  const url = await service.listen({
    host: "127.0.0.1",
    port: Number(process.env.PORT ?? 3100),
  });
  async function request(path, method, body) {
    const response = await fetch(url + path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 409)
      throw new Error(await response.text());
    return response.json();
  }
  await request("/v1/environments", "POST", { name: "demo" });
  const draft = await (
    await fetch(url + "/v1/environments/demo/draft", {
      headers: { authorization: `Bearer ${token}` },
    })
  ).json();
  if (draft.activeVersion === 0) {
    const edited = await request(
      "/v1/environments/demo/flags/new-checkout",
      "PUT",
      {
        expectedRevision: draft.revision,
        flag: {
          key: "new-checkout",
          type: "boolean",
          defaultValue: false,
          rules: [],
          rollout: {
            id: "checkout-half",
            salt: "checkout-v1",
            bucketBy: "targetingKey",
            allocations: [
              { serve: true, weight: 50000 },
              { serve: false, weight: 50000 },
            ],
          },
        },
      },
    );
    await request("/v1/environments/demo/publish", "POST", {
      expectedRevision: edited.revision,
      expectedActiveVersion: 0,
      idempotencyKey: "demo-initial",
    });
  }
  client = new RolloutClient({
    url,
    token,
    environment: "demo",
    refreshIntervalMs: 1000,
  });
  await client.start();
  application = createServer((request, reply) => {
    const subject =
      new URL(request.url, "http://localhost").searchParams.get("subject") ??
      "synthetic-user-42";
    reply.setHeader("content-type", "application/json");
    reply.end(
      JSON.stringify({
        evaluation: client.booleanDetails(
          "new-checkout",
          { targetingKey: subject },
          false,
        ),
        status: client.status(),
      }),
    );
  });
  await new Promise((resolve) =>
    application.listen(
      Number(process.env.APP_PORT ?? 3101),
      "127.0.0.1",
      resolve,
    ),
  );
  console.log(
    `Service: ${url}\nExample: http://127.0.0.1:${process.env.APP_PORT ?? 3101}/?subject=synthetic-user-42\nLocal demo token: ${token}\nStop with Ctrl+C. Data stays in .local/demo-postgres.`,
  );
  process.once("SIGINT", () => {
    void close();
  });
  process.once("SIGTERM", () => {
    void close();
  });
} catch (error) {
  await close();
  throw error;
}
