import { test } from "node:test";
import assert from "node:assert/strict";
import { startPostgres } from "../../scripts/postgres.mjs";
import { Store } from "../../packages/service/dist/store.js";
import { createService } from "../../packages/service/dist/server.js";

test(
  "readiness requires matching completed migrations and recovers after storage failure",
  { timeout: 60000 },
  async () => {
    const db = await startPostgres();
    const store = new Store(db.connectionString);
    let app;
    try {
      app = await createService({
        store,
        credentials: [
          {
            token: "synthetic-ready-admin",
            actor: "operator",
            permission: "write",
            environments: ["*"],
          },
        ],
      });
      const ready = () => app.inject({ url: "/health/ready" });
      assert.equal((await ready()).statusCode, 503);
      await store.pool.query(
        "CREATE TABLE schema_migrations (name text PRIMARY KEY, digest text NOT NULL)",
      );
      assert.equal((await ready()).statusCode, 503);
      assert.equal(
        (
          await store.pool.query(
            "SELECT count(*)::integer AS count FROM schema_migrations",
          )
        ).rows[0].count,
        0,
      );
      await store.migrate("001-foundation.sql");
      assert.equal((await ready()).statusCode, 503);
      await store.migrate();
      assert.equal((await ready()).statusCode, 200);
      const [{ digest }] = (
        await store.pool.query(
          "SELECT digest FROM schema_migrations WHERE name='002-audit-index.sql'",
        )
      ).rows;
      await store.pool.query(
        "UPDATE schema_migrations SET digest='changed' WHERE name='002-audit-index.sql'",
      );
      assert.equal((await ready()).statusCode, 503);
      await store.pool.query(
        "UPDATE schema_migrations SET digest=$1 WHERE name='002-audit-index.sql'",
        [digest],
      );
      assert.equal((await ready()).statusCode, 200);
      await db.database.stop();
      assert.equal((await ready()).statusCode, 503);
      assert.equal((await app.inject({ url: "/health/live" })).statusCode, 200);
      await db.database.start();
      assert.equal((await ready()).statusCode, 200);
    } finally {
      await app?.close();
      await store.close();
      await db.close();
    }
  },
);
