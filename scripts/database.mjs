import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { startPostgres } from "./postgres.mjs";

const statePath = resolve(".local/database-owner.json");
if (process.argv[2] === "stop") {
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const response = await fetch(`http://127.0.0.1:${state.port}/stop`, {
    method: "POST",
    headers: { authorization: `Bearer ${state.token}` },
  });
  if (!response.ok)
    throw new Error(
      "The development database owner did not acknowledge shutdown.",
    );
} else {
  await mkdir(".local", { recursive: true });
  const database = await startPostgres({
    directory: resolve(".local/postgres"),
    port: 55432,
  });
  const token = randomBytes(24).toString("hex");
  const control = createServer((request, response) => {
    if (
      request.method !== "POST" ||
      request.url !== "/stop" ||
      request.headers.authorization !== `Bearer ${token}`
    ) {
      response.writeHead(403).end();
      return;
    }
    response.end("stopping");
    void close();
  });
  await new Promise((resolve) => control.listen(0, "127.0.0.1", resolve));
  const address = control.address();
  if (!address || typeof address === "string")
    throw new Error("No database control port");
  await writeFile(statePath, JSON.stringify({ port: address.port, token }));
  console.log(
    "Development PostgreSQL is ready on 127.0.0.1:55432. Stop with Ctrl+C.",
  );
  const close = async () => {
    control.close();
    await database.close();
    await unlink(statePath).catch(() => undefined);
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
