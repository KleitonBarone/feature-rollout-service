# 0001: TypeScript workspace and service boundaries

Status: accepted, 2026-08-26

## Decision

Use a strict TypeScript pnpm workspace. Node.js 24 is the reference runtime and TypeScript is the first server-side SDK language. Keep the versioned data model, validation, serialization, and evaluation in `packages/evaluation` with no API or database imports.

For milestone 2, use a Node.js HTTP service backed by PostgreSQL. The exact HTTP framework and data-access library remain open until the management API work starts. PostgreSQL will store immutable configuration versions and audit records. The service will publish the language-neutral configuration contract consumed by SDKs.

Keep conformance inputs and expected outputs as JSON outside the TypeScript package. Each future SDK must run the same fixtures.

## Consequences

- TypeBox defines runtime JSON schemas and derives TypeScript types from them.
- Configuration versions use positive JSON safe integers. Timestamps use canonical UTC ISO strings with millisecond precision.
- The evaluator can ship independently of the management service and storage model.
- A future API translates its records into `configuration-v1`; it cannot expose database rows as the evaluation contract.
- Adding a second SDK waits until this contract and its fixtures have survived milestone 2.
