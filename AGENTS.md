# AGENTS.md

## Project orientation

Feature Rollout Service manages versioned flag configuration and evaluates it locally through SDKs. Determinism, safe defaults, cache behavior, and explainable decisions are the core product.

Read `README.md` and `ROADMAP.md` before changing scope. Keep implemented behavior separate from planned capabilities.

## Product rules

- The same flag version and evaluation context must produce the same result in every implementation.
- Define canonical serialization and hashing before implementing percentage rollouts.
- Rule order is part of the contract. Preserve it and test it explicitly.
- SDK evaluation must not require a network request per flag check.
- Every flag has a declared default for missing, invalid, or stale configuration.
- Configuration changes are versioned and auditable. Never rewrite history in place.
- Evaluation details must explain which rule, rollout, or default produced the result without leaking sensitive attributes.

## Keep server and SDK concerns separate

The service owns configuration, validation, publication, and audit history. SDKs own caching and local evaluation. Share a versioned contract and conformance fixtures instead of coupling SDKs to server internals.

Begin with the Node.js 24 TypeScript SDK recorded in ADR 0001. Do not add more languages until the evaluation contract and conformance suite are stable.

## Verification

Use Node.js 24 and pnpm 11. Run these commands from the repository root:

- `pnpm format:check` verifies formatting.
- `pnpm lint` runs ESLint.
- `pnpm typecheck` builds required evaluator declarations, then runs strict TypeScript project checks. No prior build is required.
- `pnpm test` runs the focused Vitest suite and conformance fixtures against maintained source, including SDK imports of the evaluator. No prior build is required.
- `pnpm check` runs source tests before type checking, formatting, and linting, matching the fresh-checkout CI gate.
- `pnpm test:e2e` verifies installed package artifacts in an external consumer.
- `pnpm test:watch` watches focused source tests and follows evaluator changes into SDK tests.
- `pnpm dev:db` starts owned local PostgreSQL. Test databases must use disposable native clusters, never a deployment `DATABASE_URL`.
- `pnpm verify` is the full gate, including real PostgreSQL/HTTP and installed SDK tests.
- `pnpm artifacts:check` detects stale SDK files and portable schemas without replacing them. `pnpm test:sdk-copy` tests the existing folder. Run these before SDK regeneration in CI.
- `pnpm schemas:generate` refreshes portable schemas after contract changes. Include generated SDK and schema changes with their maintained source.
- `pnpm demo` runs the full localhost example; `pnpm dev` watches all three packages.
- `pnpm build` regenerates the copyable `sdk/` JavaScript, declarations, and notices. Edit maintained source, not those generated files. SDK distribution is repository-only, never npm publishing.

Build conformance fixtures for rule ordering, missing attributes, type mismatches, percentage boundaries, hash stability, stale configuration, and safe defaults. Run the same fixtures against every SDK implementation.

Use synthetic identities in examples and tests. Do not send evaluation attributes to analytics or external services without explicit user authorization.

## Documentation boundaries

Keep human setup, SDK usage, evaluation semantics, and limitations in `README.md`. Keep agent operating rules here. Treat changes to hashing, serialization, or rule evaluation as compatibility changes and document them.
