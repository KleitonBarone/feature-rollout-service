# Roadmap

Status: v1 implementation complete. Distribution is repository-only, including the copyable `sdk/` folder. See the [verification record](docs/verification.md).

The goal is a usable self-hosted feature-flag service with one Node.js TypeScript SDK. Completion includes installation, publication, local evaluation, safe outage behavior, audit history, and tested operation. The [implementation plan](docs/implementation-plan.md) defines the work and exit conditions.

## Implemented foundation

- [x] Strict TypeScript pnpm workspace, Node.js runtime, and service/storage decisions.
- [x] Boolean and string-valued multivariate flag schemas.
- [x] Versioned configuration and evaluation context.
- [x] Canonical configuration serialization and stable percentage hashing.
- [x] Ordered targeting, declared defaults, and evaluation reason codes.
- [x] Language-neutral conformance fixtures and focused tests.
- [x] Formatting, linting, type checking, builds, and baseline CI.

The original milestones 0 and 1 remain compatible. The configuration service and first SDK are now implemented as well.

## Before milestone 2: Reliable development loop

[Plan phase 1](docs/implementation-plan.md#phase-1-make-development-and-verification-dependable) was completed before service development.

- [x] Working local example with source watching and focused test watch mode.
- [x] Isolated local PostgreSQL, readiness checks, and safe process cleanup.
- [x] End-to-end tests through packed artifacts installed in an external consumer.
- [x] Repeatable test infrastructure with ephemeral ports, isolated databases, and failure logs.
- [x] Ubuntu and Windows fast checks, installed-package CI, and contributor instructions.

## 2. Configuration service and first SDK

Complete [plan phases 2 through 5](docs/implementation-plan.md#phase-2-freeze-the-evaluation-and-freshness-contracts) in order.

- [x] Specify transport freshness separately from immutable configuration in a new schema version, with v1 compatibility.
- [x] Expand conformance coverage and prepare immutable indexed evaluation snapshots.
- [x] Add PostgreSQL migrations, environment drafts, and flag create/update/archive behavior.
- [x] Publish immutable versions transactionally with concurrency checks and idempotent retries.
- [x] Record authenticated audit history; implement rollback and kill through new publications.
- [x] Provide authenticated management and conditional configuration-delivery APIs with OpenAPI documentation.
- [x] Build the Node.js SDK with typed access, bounded startup, local evaluation, polling, and shutdown.
- [x] Define and test stale/default behavior, invalid updates, version ordering, and recovery.
- [x] Run a real application through service publication and installed SDK artifacts.

## 3. Operational proof

[Plan phase 6](docs/implementation-plan.md#phase-6-prove-outages-recovery-and-operation) verifies complete workflows.

- [x] Prove environment isolation and zero HTTP requests per flag check.
- [x] Test update delivery, unchanged refreshes, outages, expiry boundaries, and recovery.
- [x] Test kill and rollback, concurrent publication, restart persistence, and atomic audit writes.
- [x] Add local metrics and redacted logs without collecting evaluation identities or attributes.
- [x] Measure evaluation and refresh costs; document supported limits and polling delays.
- [x] Make `pnpm verify` run the complete integration and end-to-end gate in CI.

## 4. Adoption and release

[Plan phase 7](docs/implementation-plan.md#phase-7-make-adoption-and-operation-straightforward) completes the first release.

- [x] Provide a short newcomer README and a tested service-to-SDK quickstart.
- [x] Build the service image and copyable repository SDK with verified consumer imports and declarations.
- [x] Document API use, SDK lifecycle, defaults, freshness, credential rotation, and troubleshooting.
- [x] Test upgrades, migrations, backup/restore, and release artifacts.
- [x] Verify local package entry points, supported runtime, reproducible builds, and changelog.
- [x] Commit the standalone SDK folder and verify a clean consumer without npm or workspace dependencies.

## Post-v1 review hardening

- [x] Verify copied SDK artifacts and exported schemas before regeneration.
- [x] Isolate observer callbacks, including rejected promises and readonly payloads.
- [x] Default unsafe and deeply nested invalid context without executing getters.
- [x] Align identifier limits, classify malformed requests, and describe audit responses.
- [x] Require completed migrations with matching checksums for readiness.
- [x] Test the documented publication and copied-application quickstart as an external consumer.
- [x] Lead evaluation guidance with v2 and explain observed revocation versus disconnected cache expiry.
- [ ] Rehearse the updated container and restore workflow locally through WSL, then confirm task-resource cleanup.

## Later, if justified

- Additional server-side SDKs.
- Client-side SDKs with privacy constraints.
- A management UI or visual rule builder.
- Approval workflows and experiment exposure events.
- Statistical experimentation analysis or multi-region replication.

These are outside the v1 completion checklist. Arbitrary code in targeting rules remains out of scope.
