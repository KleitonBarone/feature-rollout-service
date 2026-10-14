import { test } from "node:test";
import assert from "node:assert/strict";
import { startPostgres } from "../../scripts/postgres.mjs";
import { Store } from "../../packages/service/dist/store.js";
import { createService } from "../../packages/service/dist/server.js";

export const credentials = [
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
test(
  "authenticated HTTP with PostgreSQL delivers canonical bytes and conditional refreshes",
  { timeout: 60000 },
  async () => {
    const db = await startPostgres();
    const store = new Store(db.connectionString);
    let app;
    let url;
    async function request(
      path,
      method = "GET",
      body,
      token = credentials[0].token,
      headers = {},
    ) {
      return fetch(url + path, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { "content-type": "application/json" } : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    }
    try {
      await store.migrate();
      app = await createService({ store, credentials });
      url = await app.listen({ port: 0, host: "127.0.0.1" });
      assert.equal((await fetch(url + "/v1/environments")).status, 401);
      assert.equal(
        (
          await request(
            "/v1/environments",
            "POST",
            { name: "test" },
            credentials[1].token,
          )
        ).status,
        403,
      );
      assert.equal(
        (await request("/v1/environments", "POST", { name: "test" })).status,
        200,
      );
      const edited = await request(
        "/v1/environments/test/flags/feature",
        "PUT",
        {
          expectedRevision: 0,
          flag: {
            key: "feature",
            type: "boolean",
            defaultValue: false,
            rules: [],
          },
        },
      );
      assert.equal(edited.status, 200);
      assert.equal((await edited.json()).revision, 1);
      assert.equal(
        (
          await request("/v1/environments/test/publish", "POST", {
            expectedRevision: 1,
            expectedActiveVersion: 0,
            idempotencyKey: "publish",
          })
        ).status,
        200,
      );
      const response = await request(
        "/v1/environments/test/configuration",
        "GET",
        undefined,
        credentials[1].token,
      );
      assert.equal(response.status, 200);
      const etag = response.headers.get("etag");
      const original = await response.text();
      assert.equal(JSON.parse(original).schemaVersion, "configuration-v2");
      await request("/v1/environments", "POST", { name: "other" });
      await request("/v1/environments/other/flags/feature", "PUT", {
        expectedRevision: 0,
        flag: {
          key: "feature",
          type: "boolean",
          defaultValue: true,
          rules: [],
        },
      });
      await request("/v1/environments/other/publish", "POST", {
        expectedRevision: 1,
        expectedActiveVersion: 0,
        idempotencyKey: "other",
      });
      assert.equal(
        (await (await request("/v1/environments/other/configuration")).json())
          .flags[0].defaultValue,
        true,
      );
      assert.equal(JSON.parse(original).flags[0].defaultValue, false);
      assert.equal(
        (
          await request(
            "/v1/environments/test/configuration",
            "GET",
            undefined,
            credentials[1].token,
            { "if-none-match": etag },
          )
        ).status,
        304,
      );
      assert.equal(
        (
          await request(
            "/v1/environments/other/configuration",
            "GET",
            undefined,
            credentials[1].token,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/v1/environments/test/flags/feature", "PUT", {
            expectedRevision: "1",
            flag: {
              key: "feature",
              type: "boolean",
              defaultValue: false,
              rules: [],
            },
          })
        ).status,
        400,
      );
      assert.ok(
        (await (await request("/v1/openapi.json")).json()).paths[
          "/v1/environments/{environment}/configuration"
        ],
      );
      assert.equal(
        (await (await request("/v1/environments/test/audit")).json())[0].actor,
        "admin",
      );
      assert.equal(
        (await request("/v1/environments/test/configuration")).status,
        200,
      );
      await db.database.stop();
      assert.equal(
        (await request("/v1/environments/test/configuration")).status,
        503,
      );
      assert.equal((await fetch(url + "/health/live")).status, 200);
      assert.equal((await fetch(url + "/health/ready")).status, 503);
      await db.database.start();
      assert.equal(
        (await request("/v1/environments/test/configuration")).status,
        200,
      );
    } finally {
      await app?.close();
      await store.close();
      await db.close();
    }
  },
);
