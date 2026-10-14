# Roadmap

The goal is a usable self-hosted feature-flag service with one Node.js TypeScript SDK. Completion includes installation, publication, local evaluation, safe outage behavior, audit history, and tested operation. The [implementation plan](docs/implementation-plan.md) defines the work and exit conditions.

## Implemented foundation

- [x] Strict TypeScript pnpm workspace, Node.js runtime, and service/storage decisions.
- [x] Boolean and string-valued multivariate flag schemas.
- [x] Versioned configuration and evaluation context.
- [x] Canonical configuration serialization and stable percentage hashing.
- [x] Ordered targeting, declared defaults, and evaluation reason codes.
- [x] Language-neutral conformance fixtures and 26 focused tests.
- [x] Formatting, linting, type checking, builds, and baseline CI.

These complete the original milestones 0 and 1. They do not yet provide a configuration service, SDK cache, or installable release.

## Before milestone 2: Reliable development loop

[Plan phase 1](docs/implementation-plan.md#phase-1-make-development-and-verification-dependable) is the next implementation task and a prerequisite for further product development.

- [ ] Working local example with source watching and focused test watch mode.
- [ ] Isolated local PostgreSQL, readiness checks, and safe process cleanup.
- [ ] End-to-end tests through packed artifacts installed in an external consumer.
- [ ] Repeatable test infrastructure with ephemeral ports, isolated databases, and failure logs.
- [ ] Ubuntu and Windows fast checks, installed-package CI, and contributor instructions.

## 2. Configuration service and first SDK

Complete [plan phases 2 through 5](docs/implementation-plan.md#phase-2-freeze-the-evaluation-and-freshness-contracts) in order.

- [ ] Specify transport freshness separately from immutable configuration in a new schema version, with v1 compatibility.
- [ ] Expand conformance coverage and prepare immutable indexed evaluation snapshots.
- [ ] Add PostgreSQL migrations, environment drafts, and flag create/update/archive behavior.
- [ ] Publish immutable versions transactionally with concurrency checks and idempotent retries.
- [ ] Record authenticated audit history; implement rollback and kill through new publications.
- [ ] Provide authenticated management and conditional configuration-delivery APIs with OpenAPI documentation.
- [ ] Build the Node.js SDK with typed access, bounded startup, local evaluation, polling, and shutdown.
- [ ] Define and test stale/default behavior, invalid updates, version ordering, and recovery.
- [ ] Run a real application through service publication and installed SDK artifacts.

## 3. Operational proof

[Plan phase 6](docs/implementation-plan.md#phase-6-prove-outages-recovery-and-operation) verifies complete workflows.

- [ ] Prove environment isolation and zero HTTP requests per flag check.
- [ ] Test update delivery, unchanged refreshes, outages, expiry boundaries, and recovery.
- [ ] Test kill and rollback, concurrent publication, restart persistence, and atomic audit writes.
- [ ] Add local metrics and redacted logs without collecting evaluation identities or attributes.
- [ ] Measure evaluation and refresh costs; document supported limits and polling delays.
- [ ] Make `pnpm verify` run the complete integration and end-to-end gate in CI.

## 4. Adoption and release

[Plan phase 7](docs/implementation-plan.md#phase-7-make-adoption-and-operation-straightforward) completes the first release.

- [ ] Provide a short newcomer README and a tested service-to-SDK quickstart.
- [ ] Package the service image and public Node.js SDK with verified consumer imports and declarations.
- [ ] Document API use, SDK lifecycle, defaults, freshness, credential rotation, and troubleshooting.
- [ ] Test upgrades, migrations, backup/restore, and release artifacts.
- [ ] Confirm package names, supported runtime, release workflow, and changelog.
- [ ] Publish the authorized release and verify a clean consumer using its published artifacts.

## Later, if justified

- Additional server-side SDKs.
- Client-side SDKs with privacy constraints.
- A management UI or visual rule builder.
- Approval workflows and experiment exposure events.
- Statistical experimentation analysis or multi-region replication.

These are outside the v1 completion checklist. Arbitrary code in targeting rules remains out of scope.
