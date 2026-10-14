# Implementation plan

This plan records the build order for the first complete version of Feature Rollout Service. The roadmap records completed work and verification evidence.

Implementation update, 2026-10-14: the service, SDK, operational tests, and development loop are implemented. Distribution changed at the user's request: the checked-in `sdk/` folder is copyable, with no npm publication. Public package names, registry credentials, and publishing workflows are no longer completion requirements. This document retains the original phased design; the roadmap records current verification evidence.

## Product and completion boundary

Build a small self-hosted feature-flag service for teams running Node.js applications. Users manage flags by environment, publish changes, and integrate one TypeScript SDK. Applications evaluate from local configuration, with stable percentage assignment and explicit failure behavior.

A complete first release lets a new user:

1. Start the service and PostgreSQL locally from documented commands.
2. Create an environment and a boolean or string-valued multivariate flag.
3. Configure ordered targeting and a percentage rollout, then publish it.
4. Copy the standalone SDK into an application outside this workspace and get a typed result.
5. Observe a published update without restarting the application.
6. Explain a decision, disable a rollout, restore a previous configuration, and inspect the audit history.
7. Keep serving requests during a service outage, then recover within documented bounds.
8. Run the same example and failure scenarios from a fresh checkout or release artifact.

This defines 100% implemented for v1. It excludes a management UI, additional SDK languages, browser evaluation, experimentation statistics, approval workflows, hosted accounts, and distributed infrastructure. One deployment owns one collection of environments. Management uses HTTP and documented request examples; a separate CLI is unnecessary for v1.

## Verified starting point

As of 2026-10-14, the repository contains:

- A strict Node.js 24 and pnpm 11 TypeScript workspace.
- One private evaluation package with boolean and string-valued multivariate definitions, runtime validation, ordered equality and inequality rules, canonical serialization, and deterministic SHA-256 bucketing.
- Declared defaults, required caller fallbacks, expiry handling, and evaluation reason codes.
- JSON conformance fixtures and 26 passing tests.
- Formatting, ESLint, type checking, builds, and CI on Ubuntu.

There is no management service, persistence, configuration transport, SDK lifecycle, sample application, published package, or end-to-end test. Tests import source files, so they do not yet prove that a consumer can install the emitted package. Each evaluation also validates the entire configuration and searches its flags. The SDK needs a validated snapshot to avoid repeating that work.

## Implementation decisions

Retain Node.js 24, pnpm, TypeScript, TypeBox, Vitest, canonical JSON, and the existing percentage hash algorithm. Use PostgreSQL as recorded in ADR 0001. Use Fastify with its TypeBox provider for HTTP and parameterized SQL through `pg` for storage. Keep migrations as reviewed SQL files. Pin compatible dependency and database versions when implementing them.

Fastify can infer request types from JSON schemas, which fits the existing definitions. See its [type-provider documentation](https://fastify.dev/docs/latest/Reference/Type-Providers/). Use schemas written by this project; users submit configuration data, never executable schemas.

Use polling with conditional HTTP requests. Start with a 30-second refresh interval, a 2-second request timeout, a 5-second initialization deadline, and a 5-minute maximum age since the last successful validation. These are proposed defaults, tested with an injected clock and documented before release. Streaming, Redis, and a message broker are unnecessary for v1.

Keep these responsibilities separate:

- `packages/evaluation` owns versioned semantics, validation, serialization, hashing, and prepared evaluation snapshots.
- `packages/service` owns HTTP, credentials, PostgreSQL, publication, and audit records.
- `packages/sdk-node` owns HTTP loading, refresh, snapshot replacement, lifecycle, and local evaluation.
- `examples/node-app` shows the public SDK in an ordinary HTTP application.
- `tests/e2e` exercises installed artifacts and running processes.

The SDK depends on the evaluator and documented JSON contracts. It never imports service code, SQL types, or database records. Add another shared package only if a real public contract requires it.

## Phase 1: Make development and verification dependable

Complete this phase before building management API or SDK behavior. Every command must do real work when introduced. Do not add passing placeholders for future suites.

### Work

- Pin the runtime and retain frozen-lockfile installs. Provide `.env.example` with local-only settings and clear errors for missing prerequisites.
- Add a small executable local-evaluation example using synthetic data and explicit time. It becomes the first development target, then switches to the public SDK in phase 5.
- Add Vitest watch mode and workspace-aware build watching so edits reach the example without manual rebuilds. `pnpm dev` initially runs the example and build watcher. Extend it to the service and SDK example when those exist.
- Add a database-only Compose setup with localhost binding, a health check, and bounded readiness waiting. `pnpm dev:db` starts a named development instance; `pnpm dev:stop` stops only that instance and owned processes. Normal restarts retain development data.
- Build an isolated test-database lifecycle. Integration and end-to-end suites create their own Compose project, credentials, database, and ephemeral ports. They never inherit a deployment `DATABASE_URL`. Cleanup removes only resources owned by the run.
- Add `pnpm test:e2e` now. Pack the evaluator, install its tarball into a fresh consumer outside the workspace, and run representative conformance cases through emitted JavaScript. Verify declarations with the consumer's TypeScript compiler and compare assignments across separate Node processes. This is the first end-to-end boundary available today.
- Add process setup for later service tests: bounded readiness polling, tracked child processes, shutdown, captured logs, and cleanup on success or failure. Avoid fixed sleeps and guessed ports.
- Extend CI with installed-package tests and fast checks on Ubuntu and Windows. Database suites can stay on Ubuntu. Run the same commands locally and in CI.
- Add `CONTRIBUTING.md` for setup, watch mode, running one test, debugging, logs, isolated databases, and cleanup. Keep the README focused on adoption.

### Exit conditions

From a clean checkout, a contributor can install dependencies, run the example, edit a rule, see its result change, and run the relevant test. A deliberately broken package export fails the external-consumer test. Tests leave no processes or test databases behind. Missing Docker produces an actionable error, not a silently skipped required suite.

Keep `pnpm check` fast. Introduce `pnpm verify` as the full gate when integration tests exist. Aim for focused feedback under five seconds and full CI under five minutes. Measure timings before enforcing a hard budget.

## Phase 2: Freeze the evaluation and freshness contracts

### Work

- Write a normative evaluation specification and export portable JSON schemas. Separate structural checks from semantic checks such as duplicate keys, variant references, and total allocation weight.
- Expand fixtures for inequality with missing or mismatched attributes, conjunctions, targeting before rollouts, reversed rule order, multivariate rollouts and defaults, 0% and 100% assignment, Unicode, escaped strings, numeric representation, and invalid input.
- Test canonicalization preserves array order and rejects unsupported JSON data. Audit inherited attributes, unsafe integers, non-finite numbers, invalid dates, and malformed Unicode rather than assuming library validation covers them.
- Validate and defensively copy or freeze configuration when preparing an indexed snapshot. Evaluate from it without validating every flag again. Preserve the public evaluator and existing fixtures.
- Resolve freshness before publication. In `configuration-v1`, `expiresAt` is part of immutable bytes. An unchanged HTTP response cannot extend it. Introduce an explicitly versioned next configuration schema that removes transport freshness from immutable content. Retain v1 parsing and absolute-expiry behavior for compatibility.
- Store publication version and generation time in immutable content. The SDK measures refresh age since successful authenticated validation against the active publication. A matching `304` renews that age only if the SDK already has the validated snapshot for its ETag. It does not mutate the publication.
- Treat freshness and evaluation time as explicit decision inputs. Prepared evaluation processes flag content; the SDK selects declared defaults when freshness expires. Replaying content, context, and freshness state must reproduce the decision. Preserve v1 time-dependent behavior.
- Keep the existing percentage tuple unchanged. Environment separation selects the correct snapshot and scoped credentials. Matching salts and keys intentionally preserve assignments across environments; another salt creates independent assignment.
- Record the schema, clock behavior, reason codes, and migration path in an ADR. Separate evaluation reasons from SDK readiness and refresh status.

### Exit conditions

The evaluator and prepared snapshot pass the same fixtures. Repeated flag checks do not revalidate configuration. Version changes alone do not change percentage assignment. Unchanged publications stay usable while the service is healthy, then return defaults when an outage exceeds maximum age. Boundary tests use deterministic clocks.

## Phase 3: Store, publish, and audit configuration

### Work

- Add SQL migrations for environments, editable drafts, draft revisions, publications, active publication pointers, and append-only audit events. Use database constraints and transactions, not process-local version counters.
- Namespace flags by environment. Allow archive and restore in drafts. Archived flags disappear from later snapshots; previous publications remain retrievable.
- Keep published bytes, digest, version, and creation metadata immutable. Versions increase monotonically within each environment.
- Require an expected draft revision for edits, and both the draft revision and its base publication version for publication. In one transaction, validate the draft, insert its canonical snapshot, update the active pointer, and append the audit event. Stale concurrent operations return conflicts.
- Accept publication idempotency keys. A retry with the same key and payload returns the original publication; reuse with another payload fails.
- Record authenticated actor, action, environment, revision or publication, timestamp, and bounded change details. Never trust a caller-supplied actor.
- Roll back by copying a historical publication's flag content into a new version. Preserve rollout salts and require the expected active version. Never move the active version backward or edit history.
- Kill a rollout by copying the active snapshot and serving its declared default with targeting and rollout removed. Require the expected active version and preserve other published flags. Kill and rollback must not publish unrelated draft changes. Keep pending drafts separate; their base-version conflict forces reconciliation before another publication can revive old behavior.

### Exit conditions

Real PostgreSQL tests prove migrations from an empty database, restart persistence, concurrent publication, idempotent retries, archive, rollback, and atomic audit writes. Failed publication creates no partial version or active-pointer change. Kill and rollback leave unpublished edits unpublished, and stale drafts cannot silently undo them. Historical bytes remain unchanged after later operations.

## Phase 4: Expose management and delivery APIs

### Work

- Add `/v1` routes for environments, draft flags, publication, version history, rollback, kill, and paginated audit history. Accept complete flag definitions as JSON; users do not need a builder DSL.
- Deliver one environment's validated canonical configuration with a strong ETag derived from its SHA-256 digest. Support `If-None-Match` and `304` without artificial versions.
- Separate management credentials from SDK read credentials. Begin with configured credentials carrying stable actor IDs and explicit environment scopes. Document generation and rotation. Read credentials cannot write or access another environment.
- Validate requests and responses. Reject unexpected fields and coercion in flag definitions. Set explicit body-size and collection limits.
- Return stable machine-readable errors, HTTP statuses, safe validation paths, and request IDs. Exclude tokens, SQL errors, and request bodies from logs.
- Generate OpenAPI from actual route schemas, including errors, concurrency and idempotency headers, pagination, and authentication. Export the specification for other integrations.
- Add liveness, readiness, graceful shutdown, bounded connection pools, and request timeouts. Document reverse-proxy TLS requirements.

### Exit conditions

HTTP tests use real sockets and PostgreSQL to prove authorization, validation, `200`/`304` delivery, conflicts, actor attribution, restart recovery, and errors. An external consumer fetches and evaluates configuration without service imports. The API specification matches those requests.

## Phase 5: Ship the SDK and complete integration

### Work

- Provide one client per environment with startup, bounded readiness waiting, synchronous typed evaluation, details, status inspection, explicit refresh, and idempotent close.
- Make normal usage compact: service URL, read token, environment, stable targeting key, and required typed fallback. Hide schema boilerplate inside the SDK. Maintain a type-checked usage example as its integration contract.
- Fetch at startup, validate and prepare configuration, then replace the active snapshot atomically. Poll using ETags, timeouts, bounded retry backoff, and jitter.
- Reject unsupported schemas, wrong environments, older versions, and equal versions with different content. Coalesce refresh calls and discard late responses that would regress state.
- Retain the last validated snapshot on transport or payload failures. Successful authenticated revalidation renews freshness; failed requests never do.
- Before the first usable snapshot, or for missing flags and wrong typed access, use the caller fallback. After a snapshot becomes stale, use its declared flag default. Invalid context uses declared defaults too. Report loading, ready, stale, and closed status separately.
- Avoid tight retry loops on authentication failure and expose the error. Specify behavior for archived environments and terminal credential revocation, including cached-state invalidation.
- Support optional explicit bootstrap with a caller-provided validated snapshot. Do not add a hidden disk cache. Expired or incompatible bootstrap cannot bypass defaults.
- Close aborts in-flight work and releases timers. Flag evaluation never makes an HTTP request or awaits refresh.
- Switch the example to the SDK and HTTP management workflow. Run it with installed tarballs outside the monorepo as well as in the development workspace.

### Exit conditions

The application starts, receives an update, observes a kill, and recovers after service restart. Request counts prove repeated checks make zero HTTP requests. Clock tests prove expiry at its exact boundary. Delayed responses cannot regress versions, malformed updates cannot replace valid state, and shutdown leaves no handles.

## Phase 6: Prove outages, recovery, and operation

Keep a small set of end-to-end scenarios crossing actual boundaries:

| Scenario                      | Required evidence                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| First integration             | Create environment and flag through HTTP, publish, install SDK, evaluate expected value and reason.    |
| Isolation                     | Identical keys in two environments return their own values; credentials cannot cross scopes.           |
| Targeting and rollout         | Rules take precedence; installed evaluator and SDK match fixed conformance assignments.                |
| Updates and unchanged refresh | Publication arrives within the polling bound; matching ETag refresh keeps a healthy snapshot current.  |
| Service outage                | Cached decisions last only within configured age; defaults start at its boundary; requests stay local. |
| Database failure              | Publication fails atomically; SDK checks remain local; reconnection restores delivery.                 |
| Kill and rollback             | A publication disables the rollout; rollback creates a higher version and audit event.                 |
| Bad or delayed response       | Invalid, oversized, incompatible, and older responses cannot replace valid current state.              |
| Restart and shutdown          | Publications survive restart; SDK reinitializes; processes, sockets, and timers close.                 |

Use injected clocks and a controlled HTTP server for exact scheduler cases. Use real service processes and PostgreSQL for critical workflows and failures. Controlled responses supplement real tests, not replace them. Avoid asserting exact elapsed delays in normal CI.

Add logs and metrics for publication failures, request errors, database readiness, and delivery. Offer optional local SDK callbacks for refresh state and aggregate reason counts. Never send evaluation attributes or targeting identities to the service. An external telemetry backend is outside v1.

Measure evaluation latency, allocation distribution, snapshot size, and refresh costs at a documented workload. Set supported limits from those measurements and avoid unmeasured throughput claims. Explain that a remote kill takes effect after polling and cannot immediately override an unreachable SDK.

### Exit conditions

`pnpm verify` runs formatting, linting, type checking, unit/conformance tests, builds, PostgreSQL integration tests, installed-artifact end-to-end tests, and documentation examples. CI retains useful failure logs. Scenarios require no production credentials or external services.

## Phase 7: Make adoption and operation straightforward

### Work

- Keep the README short: purpose, actual maturity, easiest working quickstart, compact SDK example, runtime support, and links. Its claims advance only as features ship.
- Write a quickstart with the service image, local PostgreSQL, a synthetic environment, publication, and a small app. Target a first correct result within ten minutes after prerequisites are installed.
- Add guides for lifecycle, targeting, weights, defaults, freshness, credential scopes/rotation, API requests, rollback, and troubleshooting. Keep architecture and full reason codes out of the README.
- Build a non-root service image. Document Compose deployment, durable volumes, health checks, environment validation, explicit migrations, backup/restore, and upgrades.
- Test a supported version upgrade and restore from a test backup. Publication and audit data must survive those operations.
- Generate a standalone repository SDK with bundled runtime code, declarations, license, and notices. Document ESM and Node.js 24 support and test that exact claim without workspace links or installed dependencies.
- Verify service images and the copyable SDK locally and in CI. Keep versioned Git history and a changelog. No npm publishing workflow or registry credential is needed.

### Exit conditions

A fresh external app follows the quickstart with the copied SDK and a locally built service image. Maintained examples exercise integration. Populated-schema upgrades, backup/restore, and container startup pass. Distribution is through this repository.

## Development commands to deliver

Only `check`, `test`, `build`, formatting, linting, and type checking exist today. Introduce these commands with their implementations in the listed phase, then document them in `CONTRIBUTING.md` and `AGENTS.md`.

| Command                 | Purpose                                                                | Phase                      |
| ----------------------- | ---------------------------------------------------------------------- | -------------------------- |
| `pnpm dev`              | Watch source and run the working example, later including the service. | 1, extended in 4 and 5     |
| `pnpm dev:db`           | Start and wait for local development PostgreSQL.                       | 1                          |
| `pnpm dev:stop`         | Stop owned development processes and Compose project.                  | 1                          |
| `pnpm test:watch`       | Rerun focused tests on edits.                                          | 1                          |
| `pnpm test:e2e`         | Test installed packages, then service and SDK workflows.               | 1, extended in 4 through 6 |
| `pnpm db:migrate`       | Apply reviewed migrations to explicitly selected local storage.        | 3                          |
| `pnpm test:integration` | Run PostgreSQL and HTTP tests in disposable infrastructure.            | 3 and 4                    |
| `pnpm verify`           | Run the complete release gate.                                         | 3, extended through 7      |

Test infrastructure must stay separate from the developer's persistent database. Document single-test execution and log inspection. No suite needs an account, npm publication, or deployed preview.

## Suggested delivery sequence

Start with watch tooling and installed evaluator tests, then isolated database support. Follow with the freshness ADR and fixtures, prepared evaluation, transactional publication, authenticated delivery, SDK loading, refresh and failures, operational scenarios, and release packaging.

For each change, state user-visible behavior, add the narrow relevant test, run affected gates, and update documentation and roadmap evidence. Scaffolding and mocked happy paths do not complete a phase. Dependencies need a specific job; new infrastructure needs evidence the simpler design cannot do it.

## Final release checklist

- [ ] Phases 1 through 7 pass their exit conditions.
- [ ] The v1 workflow works through installed artifacts.
- [ ] Evaluation compatibility and schema migration are documented and tested.
- [ ] Writes are authenticated, concurrent-safe, immutable after publication, and auditable.
- [ ] Flag checks stay synchronous and local through updates and outages.
- [ ] Defaults, freshness, polling delays, and kill limitations are clear to integrators.
- [ ] Windows and Ubuntu development commands work; required CI is green.
- [ ] Quickstart, backup/restore, upgrade, packaging, and image rehearsals pass.
- [ ] The local SDK entry point and runtime support are verified.
- [ ] The copyable folder is committed and a clean consumer uses it without installing dependencies.

The implementation followed this sequence. Refer to the roadmap for the current completion record.
