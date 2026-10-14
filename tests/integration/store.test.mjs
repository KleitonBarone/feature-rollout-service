import { test } from "node:test";
import assert from "node:assert/strict";
import { startPostgres } from "../../scripts/postgres.mjs";
import { Store } from "../../packages/service/dist/store.js";

test(
  "real PostgreSQL publication is atomic, immutable, restartable, and concurrent-safe",
  { timeout: 60000 },
  async () => {
    const database = await startPostgres();
    let store = new Store(database.connectionString);
    try {
      await store.migrate("001-foundation.sql");
      await store.createEnvironment("test", "synthetic-admin");
      await store.edit("test", 0, "synthetic-admin", {
        type: "put",
        flag: {
          key: "feature",
          type: "boolean",
          defaultValue: false,
          rules: [],
          rollout: {
            id: "all",
            salt: "stable",
            bucketBy: "targetingKey",
            allocations: [{ serve: true, weight: 100000 }],
          },
        },
      });
      const input = {
        expectedRevision: 1,
        expectedActiveVersion: 0,
        idempotencyKey: "first",
      };
      const results = await Promise.allSettled([
        store.publish("test", input, "synthetic-admin"),
        store.publish(
          "test",
          { ...input, idempotencyKey: "concurrent" },
          "synthetic-admin",
        ),
      ]);
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      const original = await store.publication("test");
      const eventsBeforeUpgrade = await store.events("test");
      await store.migrate();
      await store.migrate();
      assert.deepEqual(await store.publication("test"), original);
      assert.deepEqual(await store.events("test"), eventsBeforeUpgrade);
      assert.equal(
        (
          await store.pool.query(
            "SELECT to_regclass('audit_events_environment_id')::text AS name",
          )
        ).rows[0].name,
        "audit_events_environment_id",
      );
      assert.deepEqual(
        await store.publish(
          "test",
          { ...input, idempotencyKey: original.idempotency_key },
          "synthetic-admin",
        ),
        original,
      );
      await assert.rejects(
        store.pool.query("UPDATE publications SET digest=$1", ["changed"]),
        /immutable/,
      );
      await assert.rejects(
        store.pool.query("DELETE FROM audit_events"),
        /immutable/,
      );
      await store.edit("test", 1, "synthetic-admin", {
        type: "put",
        flag: {
          key: "unpublished",
          type: "boolean",
          defaultValue: true,
          rules: [],
        },
      });
      const killed = await store.publish(
        "test",
        {
          expectedRevision: 2,
          expectedActiveVersion: 1,
          idempotencyKey: "kill",
        },
        "synthetic-admin",
        { type: "kill", key: "feature" },
      );
      assert.equal(JSON.parse(killed.canonical).flags.length, 1);
      assert.equal(JSON.parse(killed.canonical).flags[0].rollout, undefined);
      await assert.rejects(
        store.publish(
          "test",
          {
            expectedRevision: 2,
            expectedActiveVersion: 2,
            idempotencyKey: "stale-draft",
          },
          "synthetic-admin",
        ),
        /reconcile/,
      );
      const rollback = await store.publish(
        "test",
        {
          expectedRevision: 2,
          expectedActiveVersion: 2,
          idempotencyKey: "rollback",
        },
        "synthetic-admin",
        { type: "rollback", version: 1 },
      );
      assert.equal(rollback.version, 3);
      assert.deepEqual(await store.publication("test", 1), original);
      await store.close();
      store = new Store(database.connectionString);
      assert.equal((await store.publication("test")).version, 3);
      await database.database.stop();
      await assert.rejects(store.publication("test"));
      await database.database.start();
      assert.equal(
        (await store.publication("test")).canonical,
        rollback.canonical,
      );
      assert.ok(
        (await store.events("test")).some(
          (event) => event.action === "rollback",
        ),
      );
      await assert.rejects(
        store.publish(
          "test",
          {
            expectedRevision: 2,
            expectedActiveVersion: 3,
            idempotencyKey: original.idempotency_key,
          },
          "synthetic-admin",
        ),
        /different input/,
      );
    } finally {
      await store.close();
      await database.close();
    }
  },
);
