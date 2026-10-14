import { Value } from "@sinclair/typebox/value";
import { createService, CredentialsSchema } from "./server.js";
import { Store } from "./store.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error(
    "DATABASE_URL is required. See .env.example and docs/operations.md.",
  );
const store = new Store(connectionString);
if (process.argv.includes("migrate")) {
  try {
    await store.migrate();
    console.log("Migrations applied.");
  } finally {
    await store.close();
  }
} else {
  const credentials: unknown = JSON.parse(
    process.env.ROLLOUT_CREDENTIALS ?? "null",
  );
  if (!Value.Check(CredentialsSchema, credentials)) {
    await store.close();
    throw new Error(
      "ROLLOUT_CREDENTIALS must be a JSON array of scoped credentials.",
    );
  }
  const app = await createService({ store, credentials, logger: true });
  const port = Number(process.env.PORT ?? 3100);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("Invalid PORT");
  const shutdown = async () => {
    await app.close();
    await store.close();
  };
  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
  try {
    const address = await app.listen({
      host: process.env.HOST ?? "127.0.0.1",
      port,
    });
    console.log(`Service ready at ${address}`);
  } catch (error) {
    await shutdown();
    throw error;
  }
}
