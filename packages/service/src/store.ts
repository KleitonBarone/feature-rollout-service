import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import {
  parseConfigurationV2,
  serializeConfigurationV2,
  type ConfigurationV2,
  type Flag,
} from "@feature-rollout/evaluation";

export class ServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
type EnvironmentRow = {
  name: string;
  revision: number;
  base_version: number;
  active_version: number;
  draft: string;
  archived_flags: string;
  archived: boolean;
};
export type Publication = {
  environment: string;
  version: number;
  canonical: string;
  digest: string;
  idempotency_key: string;
  request_hash: string;
};
export type PublishInput = {
  expectedRevision: number;
  expectedActiveVersion: number;
  idempotencyKey: string;
};
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function migrate(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(71349011)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, digest text NOT NULL)",
    );
    const directory = new URL("../migrations/", import.meta.url);
    for (const name of (await readdir(directory))
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(new URL(name, directory), "utf8");
      const existing = await client.query<{ digest: string }>(
        "SELECT digest FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].digest !== digest(sql))
          throw new Error(`Changed migration ${name}`);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations(name,digest) VALUES ($1,$2)",
          [name, digest(sql)],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(71349011)");
    client.release();
  }
}

export class Store {
  readonly pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 10000,
      statement_timeout: 5000,
    });
    this.pool.on("error", () => {
      /* Request and readiness checks report database failures. */
    });
  }
  async close() {
    await this.pool.end();
  }
  async migrate() {
    await migrate(this.pool);
  }
  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async environment(
    name: string,
    client: PoolClient | Pool = this.pool,
    lock = false,
  ): Promise<EnvironmentRow> {
    const result = await client.query<EnvironmentRow>(
      `SELECT * FROM environments WHERE name=$1${lock ? " FOR UPDATE" : ""}`,
      [name],
    );
    const environment = result.rows[0];
    if (!environment)
      throw new ServiceError(
        404,
        "ENVIRONMENT_NOT_FOUND",
        "Environment not found",
      );
    if (environment.archived)
      throw new ServiceError(
        410,
        "ENVIRONMENT_ARCHIVED",
        "Environment is archived",
      );
    return environment;
  }
  configuration(name: string, flags: unknown, version = 1): ConfigurationV2 {
    const configuration = parseConfigurationV2({
      schemaVersion: "configuration-v2",
      environment: name,
      configurationVersion: version,
      generatedAt: new Date().toISOString(),
      flags,
    });
    if (Buffer.byteLength(JSON.stringify(configuration)) > 1024 * 1024)
      throw new ServiceError(
        400,
        "LIMIT_EXCEEDED",
        "Configuration exceeds 1 MiB",
      );
    if (configuration.flags.length > 1000)
      throw new ServiceError(
        400,
        "LIMIT_EXCEEDED",
        "At most 1000 flags per environment",
      );
    return configuration;
  }
  async audit(
    client: PoolClient,
    environment: EnvironmentRow,
    actor: string,
    action: string,
    details: Record<string, unknown> = {},
  ) {
    await client.query(
      "INSERT INTO audit_events(environment,actor,action,revision,version,details) VALUES ($1,$2,$3,$4,$5,$6)",
      [
        environment.name,
        actor,
        action,
        environment.revision,
        environment.active_version,
        JSON.stringify(details),
      ],
    );
  }
  async createEnvironment(name: string, actor: string) {
    return this.transaction(async (client) => {
      const inserted = await client.query<EnvironmentRow>(
        "INSERT INTO environments(name) VALUES($1) ON CONFLICT DO NOTHING RETURNING *",
        [name],
      );
      const environment = inserted.rows[0];
      if (!environment)
        throw new ServiceError(409, "CONFLICT", "Environment already exists");
      await this.audit(client, environment, actor, "environment.create");
      return this.draftResult(environment);
    });
  }
  draftResult(row: EnvironmentRow) {
    return {
      environment: row.name,
      revision: row.revision,
      baseVersion: row.base_version,
      activeVersion: row.active_version,
      flags: this.configuration(row.name, JSON.parse(row.draft) as unknown)
        .flags,
      archivedFlags: this.configuration(
        row.name,
        JSON.parse(row.archived_flags) as unknown,
      ).flags,
    };
  }
  async draft(name: string) {
    return this.draftResult(await this.environment(name));
  }
  async edit(
    name: string,
    expectedRevision: number,
    actor: string,
    operation:
      | { type: "put"; flag: Flag }
      | { type: "archive"; key: string }
      | { type: "restore"; key: string }
      | { type: "rebase"; activeVersion: number },
  ) {
    return this.transaction(async (client) => {
      const environment = await this.environment(name, client, true);
      if (environment.revision !== expectedRevision)
        throw new ServiceError(409, "CONFLICT", "Draft revision changed");
      const draft = this.draftResult(environment);
      const details: Record<string, unknown> =
        operation.type === "put"
          ? {
              flagKey: operation.flag.key,
              before:
                draft.flags.find((flag) => flag.key === operation.flag.key) ??
                null,
              after: operation.flag,
            }
          : operation.type === "rebase"
            ? {
                previousBaseVersion: environment.base_version,
                baseVersion: operation.activeVersion,
              }
            : {
                flagKey: operation.key,
                flag:
                  [...draft.flags, ...draft.archivedFlags].find(
                    (flag) => flag.key === operation.key,
                  ) ?? null,
              };
      if (operation.type === "put") {
        draft.flags = draft.flags.filter(
          (flag) => flag.key !== operation.flag.key,
        );
        draft.flags.push(operation.flag);
        draft.archivedFlags = draft.archivedFlags.filter(
          (flag) => flag.key !== operation.flag.key,
        );
      } else if (operation.type === "archive" || operation.type === "restore") {
        const source =
          operation.type === "archive" ? draft.flags : draft.archivedFlags;
        const flag = source.find((flag) => flag.key === operation.key);
        if (!flag)
          throw new ServiceError(404, "FLAG_NOT_FOUND", "Flag not found");
        if (operation.type === "archive") {
          draft.flags = source.filter((flag) => flag.key !== operation.key);
          draft.archivedFlags.push(flag);
        } else {
          draft.archivedFlags = source.filter(
            (flag) => flag.key !== operation.key,
          );
          draft.flags.push(flag);
        }
      } else {
        if (operation.activeVersion !== environment.active_version)
          throw new ServiceError(409, "CONFLICT", "Active version changed");
        environment.base_version = operation.activeVersion;
      }
      this.configuration(name, draft.flags);
      environment.revision++;
      await client.query(
        "UPDATE environments SET draft=$2,archived_flags=$3,revision=$4,base_version=$5 WHERE name=$1",
        [
          name,
          JSON.stringify(draft.flags),
          JSON.stringify(draft.archivedFlags),
          environment.revision,
          environment.base_version,
        ],
      );
      await this.audit(
        client,
        environment,
        actor,
        `flag.${operation.type}`,
        details,
      );
      return this.draftResult({
        ...environment,
        draft: JSON.stringify(draft.flags),
        archived_flags: JSON.stringify(draft.archivedFlags),
      });
    });
  }
  async publication(
    name: string,
    version?: number,
    client: PoolClient | Pool = this.pool,
  ): Promise<Publication> {
    const environment = await this.environment(name, client);
    const result = await client.query<Publication>(
      "SELECT * FROM publications WHERE environment=$1 AND version=$2",
      [name, version ?? environment.active_version],
    );
    const publication = result.rows[0];
    if (!publication)
      throw new ServiceError(
        404,
        "PUBLICATION_NOT_FOUND",
        "Publication not found",
      );
    return publication;
  }
  async publish(
    name: string,
    input: PublishInput,
    actor: string,
    operation:
      | { type: "publish" }
      | { type: "rollback"; version: number }
      | { type: "kill"; key: string } = { type: "publish" },
  ) {
    return this.transaction(async (client) => {
      const environment = await this.environment(name, client, true);
      const requestHash = digest(JSON.stringify({ input, operation }));
      const existing = await client.query<Publication>(
        "SELECT * FROM publications WHERE environment=$1 AND idempotency_key=$2",
        [name, input.idempotencyKey],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].request_hash !== requestHash)
          throw new ServiceError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Idempotency key has different input",
          );
        return existing.rows[0];
      }
      if (
        input.expectedActiveVersion !== environment.active_version ||
        input.expectedRevision !== environment.revision ||
        (operation.type === "publish" &&
          environment.base_version !== environment.active_version)
      )
        throw new ServiceError(
          409,
          "CONFLICT",
          "Draft or active publication changed; reconcile before publishing",
        );
      let flags = this.draftResult(environment).flags;
      if (operation.type === "rollback")
        flags = parseConfigurationV2(
          JSON.parse(
            (await this.publication(name, operation.version, client)).canonical,
          ) as unknown,
        ).flags;
      if (operation.type === "kill") {
        flags = parseConfigurationV2(
          JSON.parse(
            (await this.publication(name, undefined, client)).canonical,
          ) as unknown,
        ).flags;
        const flag = flags.find((flag) => flag.key === operation.key);
        if (!flag)
          throw new ServiceError(404, "FLAG_NOT_FOUND", "Flag not found");
        flag.rules = [];
        delete flag.rollout;
      }
      const version = environment.active_version + 1;
      const canonical = serializeConfigurationV2(
        this.configuration(name, flags, version),
      );
      const publication: Publication = {
        environment: name,
        version,
        canonical,
        digest: digest(canonical),
        idempotency_key: input.idempotencyKey,
        request_hash: requestHash,
      };
      await client.query(
        "INSERT INTO publications(environment,version,canonical,digest,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6)",
        Object.values(publication),
      );
      environment.active_version = version;
      if (operation.type === "publish") environment.base_version = version;
      await client.query(
        "UPDATE environments SET active_version=$2,base_version=$3 WHERE name=$1",
        [name, version, environment.base_version],
      );
      await this.audit(client, environment, actor, operation.type, {
        version,
        ...(operation.type === "rollback"
          ? { sourceVersion: operation.version }
          : operation.type === "kill"
            ? { flagKey: operation.key }
            : {}),
      });
      return publication;
    });
  }
  async archiveEnvironment(
    name: string,
    actor: string,
    expectedRevision: number,
  ) {
    await this.transaction(async (client) => {
      const row = await this.environment(name, client, true);
      if (row.revision !== expectedRevision)
        throw new ServiceError(409, "CONFLICT", "Revision changed");
      await client.query(
        "UPDATE environments SET archived=true WHERE name=$1",
        [name],
      );
      await this.audit(client, row, actor, "environment.archive");
    });
  }
  async history(name: string, after = 0, limit = 50) {
    await this.environment(name);
    return (
      await this.pool.query<{ version: number; digest: string }>(
        "SELECT version,digest FROM publications WHERE environment=$1 AND version>$2 ORDER BY version LIMIT $3",
        [name, after, limit],
      )
    ).rows;
  }
  async events(name: string, after = "0", limit = 50) {
    return (
      await this.pool.query<{
        id: string;
        actor: string;
        action: string;
        revision: number;
        version: number;
        created_at: Date;
        details: unknown;
      }>(
        "SELECT id::text,actor,action,revision,version,created_at,details FROM audit_events WHERE environment=$1 AND id>$2::bigint ORDER BY id LIMIT $3",
        [name, after, limit],
      )
    ).rows;
  }
}
