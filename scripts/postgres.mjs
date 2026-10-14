import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import EmbeddedPostgres from "embedded-postgres";

export async function freePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const address = socket.address();
  if (!address || typeof address === "string")
    throw new Error("No ephemeral port");
  await new Promise((resolve) => socket.close(resolve));
  return address.port;
}

export async function startPostgres({ directory, port } = {}) {
  const temporary = !directory;
  const databaseDir =
    directory ?? (await mkdtemp(join(tmpdir(), "frs-postgres-")));
  const password = temporary
    ? randomBytes(24).toString("hex")
    : "local-development-only";
  port ??= await freePort();
  let log = "";
  const database = new EmbeddedPostgres({
    databaseDir,
    port,
    user: "rollout",
    password,
    persistent: true,
    authMethod: "scram-sha-256",
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: (message) => {
      log += `${String(message)}\n`;
    },
    onError: (message) => {
      log += `${String(message)}\n`;
    },
  });
  let started = false;
  try {
    if (!existsSync(join(databaseDir, "PG_VERSION")))
      await database.initialise();
    await database.start();
    started = true;
    const connection = database.getPgClient();
    await connection.connect();
    const exists = await connection.query(
      "SELECT 1 FROM pg_database WHERE datname='rollout'",
    );
    if (!exists.rowCount) await database.createDatabase("rollout");
    await connection.end();
  } catch (error) {
    if (started) await database.stop().catch(() => undefined);
    if (temporary) await rm(databaseDir, { recursive: true, force: true });
    throw new Error(`Local PostgreSQL failed.\n${log}`, { cause: error });
  }
  return {
    database,
    databaseDir,
    connectionString: `postgresql://rollout:${password}@127.0.0.1:${port}/rollout`,
    async close() {
      await database.stop();
      if (temporary) await rm(databaseDir, { recursive: true, force: true });
    },
  };
}
