# Verification record

Implemented on 2026-10-14. The reference runtime is Node.js 24. The runtime packages use strict TypeScript.

- `pnpm verify` passed on 2026-10-15 with 53 unit/conformance cases, seven PostgreSQL/HTTP cases, four external-consumer scenarios, artifact comparisons, and documentation checks.
- The copied `sdk/` works with no `node_modules`, no monorepo links, and strict declaration checking. Its real-service test proves targeting, stable buckets, zero network calls per check, conditional refresh, kill, rollback, stale defaults, and recovery.
- PostgreSQL tests cover concurrency, idempotency, immutable audit/publication storage, pending drafts, populated migration from 001 to 002, and database stop/start recovery.
- Ubuntu CI runs full database and integration suites. Windows CI checks source/types and external package/copy use. Windows native PostgreSQL also passes locally under an unprivileged account. Elevated CI Windows accounts are not suitable PostgreSQL owners.
- Container CI builds the service, applies migrations, waits for readiness, creates and publishes a flag, restores a `pg_dump` backup into another database, reruns migrations, and asserts publication/audit preservation.
- The localhost demo has been run through its real SDK HTTP endpoint. Data is owned by `.local/demo-postgres` and persists across restarts.

Review fixes on 2026-10-15 add focused regressions for observer mutation and rejected promises, context accessors and excessive nesting, 128-character identifiers, malformed HTTP bodies, audit response schemas, and readiness across incomplete or changed migration history. The copied SDK is checked before regeneration; generated output is compared in temporary directories without overwriting repository artifacts.

The integration quickstart executes the maintained publish, copy, and application files against disposable PostgreSQL and a real HTTP listener. It verifies safe reruns without publishing pending drafts and application use without management credentials, workspace links, or runtime installation.

The updated container workflow also passed locally through Docker in WSL Ubuntu on 2026-10-15. It built the non-root image, applied migrations, published through authenticated HTTP, restored a binary backup into an independent database, checked readiness against restored migration history, and verified one publication and three audit events. Existing host networks exhausted Docker's automatic address pools, so this rehearsal used a checked, explicit temporary subnet and host-matched MTU. It changed no daemon settings or existing networks.

Both the initial failed network allocation and the successful rehearsal cleaned their owned resources. Final inspection found no task containers, networks, volumes, images, builders, or temporary backup files. Docker reported zero image, container, volume, and build-cache usage; unrelated pre-existing networks remained untouched.

## Measured workload

`pnpm benchmark` evaluates 10,000 synthetic percentage decisions at 10, 100, and 1000 flags. On the Windows implementation machine, the 2026-10-15 run measured about 9 to 11 microseconds per decision and 14 milliseconds to prepare 1000 flags. That minimal snapshot was 217,028 bytes. About half of synthetic subjects received the enabled value in each workload.

These are reproducible local measurements, not capacity guarantees. Schema complexity and application hardware affect cost. Service/configuration size is capped at 1 MiB and 1000 active flags; run the benchmark and application load tests on deployment hardware before increasing limits.

No npm registry release or deployed production service is part of completion. The committed SDK folder and verified container build are the deliverables.
