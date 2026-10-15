import { test } from "node:test";
import assert from "node:assert/strict";
import { startPostgres } from "../../scripts/postgres.mjs";
import { Store } from "../../packages/service/dist/store.js";
import { createService } from "../../packages/service/dist/server.js";

test(
  "HTTP input boundaries and audit contract",
  { timeout: 60000 },
  async (t) => {
    const db = await startPostgres();
    const store = new Store(db.connectionString);
    let app;
    const headers = { authorization: "Bearer synthetic-contract-admin" };
    try {
      await store.migrate();
      app = await createService({
        store,
        credentials: [
          {
            token: "synthetic-contract-admin",
            actor: "operator",
            permission: "write",
            environments: ["*"],
          },
        ],
      });
      await t.test(
        "returns safe client errors for malformed and unsupported bodies",
        async () => {
          for (const [payload, contentType, status, code] of [
            ["{", "application/json", 400, "INVALID_INPUT"],
            ["xml", "application/xml", 415, "UNSUPPORTED_MEDIA_TYPE"],
            [
              JSON.stringify({ name: "e".repeat(1024 * 1024) }),
              "application/json",
              413,
              "BODY_TOO_LARGE",
            ],
          ]) {
            const result = await app.inject({
              method: "POST",
              url: "/v1/environments",
              headers: { ...headers, "content-type": contentType },
              payload,
            });
            assert.equal(result.statusCode, status);
            const error = result.json();
            assert.deepEqual(Object.keys(error).sort(), [
              "code",
              "message",
              "requestId",
            ]);
            assert.equal(error.code, code);
            assert.equal(typeof error.requestId, "string");
            assert.ok(!result.body.includes("synthetic-contract-admin"));
          }
        },
      );
      await t.test(
        "round-trips accepted environment and flag identifier lengths",
        async () => {
          for (const length of [100, 101, 128]) {
            const name = "e".repeat(length);
            const key = "f".repeat(length);
            assert.equal(
              (
                await app.inject({
                  method: "POST",
                  url: "/v1/environments",
                  headers,
                  payload: { name },
                })
              ).statusCode,
              200,
            );
            const edited = await app.inject({
              method: "PUT",
              url: `/v1/environments/${name}/flags/${key}`,
              headers,
              payload: {
                expectedRevision: 0,
                flag: { key, type: "boolean", defaultValue: false, rules: [] },
              },
            });
            assert.equal(edited.statusCode, 200);
            const draft = await app.inject({
              url: `/v1/environments/${name}/draft`,
              headers,
            });
            assert.equal(draft.statusCode, 200);
            assert.equal(draft.json().flags[0].key, key);
          }
          const name = "e".repeat(129);
          assert.equal(
            (
              await app.inject({
                method: "POST",
                url: "/v1/environments",
                headers,
                payload: { name },
              })
            ).statusCode,
            400,
          );
          await assert.rejects(
            store.environment(name),
            (error) => error.code === "ENVIRONMENT_NOT_FOUND",
          );
        },
      );
      await t.test(
        "describes audit responses and preserves wire fields and pagination",
        async () => {
          await store.createEnvironment("audit-test", "operator");
          await store.edit("audit-test", 0, "operator", {
            type: "put",
            flag: {
              key: "feature",
              type: "boolean",
              defaultValue: false,
              rules: [],
            },
          });
          const result = await app.inject({
            url: "/v1/environments/audit-test/audit?limit=1",
            headers,
          });
          assert.equal(result.statusCode, 200);
          const [event] = result.json();
          assert.deepEqual(Object.keys(event).sort(), [
            "action",
            "actor",
            "created_at",
            "details",
            "id",
            "revision",
            "version",
          ]);
          assert.match(event.id, /^[0-9]+$/);
          assert.equal(event.actor, "operator");
          assert.equal(
            new Date(event.created_at).toISOString(),
            event.created_at,
          );
          const next = await app.inject({
            url: `/v1/environments/audit-test/audit?after=${event.id}`,
            headers,
          });
          assert.equal(next.json()[0].action, "flag.put");
          assert.equal(next.json()[0].details.after.key, "feature");
          const spec = (
            await app.inject({ url: "/v1/openapi.json", headers })
          ).json();
          const responses =
            spec.paths["/v1/environments/{environment}/audit"].get.responses;
          assert.equal(
            responses[200].content?.["application/json"]?.schema.type,
            "array",
          );
          assert.equal(
            responses[200].content["application/json"].schema.items.properties
              .id.type,
            "string",
          );
          for (const status of [400, 401, 403, 503])
            assert.ok(responses[status]);
        },
      );
    } finally {
      await app?.close();
      await store.close();
      await db.close();
    }
  },
);
