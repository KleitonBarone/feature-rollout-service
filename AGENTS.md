# AGENTS.md

## Project orientation

Feature Rollout Service manages versioned flag configuration and evaluates it locally through SDKs. Determinism, safe defaults, cache behavior, and explainable decisions are the core product.

Read `README.md` and `ROADMAP.md` before changing scope. This repository is in planning, so never describe a planned capability as implemented.

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

Begin with one server-side SDK. Do not add more languages until the evaluation contract and conformance suite are stable. The initial runtime has not been selected; record the decision before scaffolding.

## Verification

There are no build or test commands yet. Add real commands here when the toolchain exists. Do not add placeholder scripts that always pass.

Build conformance fixtures for rule ordering, missing attributes, type mismatches, percentage boundaries, hash stability, stale configuration, and safe defaults. Run the same fixtures against every SDK implementation.

Use synthetic identities in examples and tests. Do not send evaluation attributes to analytics or external services without explicit user authorization.

## Documentation boundaries

Keep human setup, SDK usage, evaluation semantics, and limitations in `README.md`. Keep agent operating rules here. Treat changes to hashing, serialization, or rule evaluation as compatibility changes and document them.
