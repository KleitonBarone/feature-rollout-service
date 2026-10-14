# Verification record

Implemented on 2026-10-14. The reference runtime is Node.js 24. The runtime packages use strict TypeScript.

- `pnpm verify` passes 48 unit/conformance cases, real PostgreSQL/HTTP suites, and external-consumer end-to-end tests.
- The copied `sdk/` works with no `node_modules`, no monorepo links, and strict declaration checking. Its real-service test proves targeting, stable buckets, zero network calls per check, conditional refresh, kill, rollback, stale defaults, and recovery.
- PostgreSQL tests cover concurrency, idempotency, immutable audit/publication storage, pending drafts, populated migration from 001 to 002, and database stop/start recovery.
- Ubuntu CI runs full database and integration suites. Windows CI checks source/types and external package/copy use. Windows native PostgreSQL also passes locally under an unprivileged account. Elevated CI Windows accounts are not suitable PostgreSQL owners.
- Container CI builds the service, applies migrations, waits for readiness, creates and publishes a flag, restores a `pg_dump` backup into another database, reruns migrations, and asserts publication/audit preservation.
- The localhost demo has been run through its real SDK HTTP endpoint. Data is owned by `.local/demo-postgres` and persists across restarts.

## Measured workload

`pnpm benchmark` evaluates 10,000 synthetic percentage decisions at 10, 100, and 1000 flags. On the Windows implementation machine, the latest run measured about 9 to 12 microseconds per decision and 14 milliseconds to prepare 1000 flags. That minimal snapshot was 217,028 bytes. About half of synthetic subjects received the enabled value in each workload.

These are reproducible local measurements, not capacity guarantees. Schema complexity and application hardware affect cost. Service/configuration size is capped at 1 MiB and 1000 active flags; run the benchmark and application load tests on deployment hardware before increasing limits.

No npm registry release or deployed production service is part of completion. The committed SDK folder and verified container build are the deliverables.
