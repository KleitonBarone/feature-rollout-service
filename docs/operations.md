# Running the service

Run `pnpm install --frozen-lockfile` and `pnpm demo` for a local demonstration. It starts owned PostgreSQL, migrates a dedicated database, publishes through HTTP, and serves an application at localhost:3101. It never reads deployment database settings.

For a separate native service, run `pnpm dev:db`, copy `.env.example` to `.env`, and set `ROLLOUT_CREDENTIALS` to a JSON array:

```json
[
  {
    "token": "replace-with-random-management-token",
    "actor": "operator",
    "permission": "write",
    "environments": ["*"]
  },
  {
    "token": "replace-with-random-read-token",
    "actor": "application",
    "permission": "read",
    "environments": ["demo"]
  }
]
```

Generate tokens with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep management tokens separate from scoped SDK tokens. Rotate by adding a credential, restarting the service, switching clients, and removing the old credential. Exposed deployments require TLS at a reverse proxy. Delivery remains authenticated.

Run `pnpm build`, `pnpm db:migrate`, and `pnpm start`. Migrations are explicit, serialized by PostgreSQL advisory lock, and checked against recorded digests. Startup never migrates. `/health/live` reports process liveness; `/health/ready` checks storage and migrations. Add schema changes as new migrations.

## Containers

Set `POSTGRES_PASSWORD` and `ROLLOUT_CREDENTIALS` in an ignored `.env`. Use a URL-safe password or override the connection URL with an encoded password.

```sh
docker compose -f compose.release.yaml build
docker compose -f compose.release.yaml up -d --wait postgres
docker compose -f compose.release.yaml run --rm service node dist/main.js migrate
docker compose -f compose.release.yaml up -d --wait service
```

The image runs as a non-root user. PostgreSQL has a durable volume, retained during normal stop/start. Never remove it as an upgrade step. Bindings default to localhost; expose the service through a TLS reverse proxy.

## Backup and upgrades

Use `pg_dump -Fc` and test `pg_restore` into an independent database. Compose users can run `docker compose -f compose.release.yaml exec -T postgres pg_dump -U rollout -d rollout -Fc`. On Windows, use binary-preserving redirection or `pg_dump -f`; older PowerShell redirection can corrupt binary backups.

Before upgrading, back up publication and audit history, verify against restored data, apply migrations explicitly, then restart. Keep the previous image. Roll back flag behavior by publishing a higher version with historical content, never rewriting history. An older disaster backup can fall behind versions already held by SDKs. Recover publication history or deliberately recreate affected environments and clients; do not disable regression checks.

V1 limits are 1 MiB request/configuration bodies and 1000 active flags per environment. Pools hold at most ten connections; database statements time out after five seconds. SDKs can set stricter size limits. `pnpm benchmark` reports reproducible measurements, not production throughput guarantees.

## Troubleshooting

- `401/403`: check credential scope. Revocation immediately activates declared defaults in clients with cached configuration.
- `409`: refetch draft and active versions. After kill/rollback, review pending edits and explicitly rebase before publishing.
- `503`: check storage/readiness. SDK checks continue locally until maximum age.
- `VERSION_REGRESSION`: investigate restored storage or altered bytes.
- Native PostgreSQL launch errors: inspect captured logs and port conflicts. PostgreSQL requires an unprivileged account, including on Windows. Database suites run on Ubuntu CI; Windows CI checks types, unit tests, and external package/copy integration. The native database path is also exercised locally on Windows.
