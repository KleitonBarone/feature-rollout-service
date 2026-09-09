# Feature Rollout Service

Feature Rollout Service defines and evaluates versioned feature-flag configuration. The first vertical slice implements the evaluation contract in TypeScript. It includes runtime schemas, ordered targeting, percentage rollouts, safe defaults, evaluation details, and language-neutral conformance fixtures.

The management service, persistence, configuration delivery, and SDK cache are milestone 2 work. Nothing in this repository currently fetches or publishes configuration.

> Status: milestones 0 and 1 are implemented. This is not a deployable service or published SDK.

## Why build this?

A boolean stored in a database is easy. Safe rollouts are harder. Teams need predictable user assignment, environment separation, quick kill switches, stale-cache behavior, and a way to explain why a user received a value.

The implemented evaluator provides:

- Boolean and multivariate flags
- Deterministic percentage rollouts
- Attribute-based targeting rules
- Versioned configuration and evaluation-context schemas
- Explicit declared defaults and typed caller fallbacks
- Evaluation details that contain reason, rule, rollout, variant, and bucket identifiers without copying context attributes
- Portable JSON conformance fixtures

Future milestones add separate environment management, immutable publication, audit history, and a server-side SDK cache.

## Install and verify

Node.js 24 and pnpm 11 are required.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

`pnpm check` runs formatting verification, linting, strict type checking, and the focused Vitest suite.

## Contract

`packages/evaluation` exports TypeBox schemas and derived TypeScript types for `configuration-v1` and `evaluation-context-v1`. A configuration has a positive safe-integer version, environment key, canonical UTC generation and expiry timestamps, and ordered flags. Timestamps use the exact `YYYY-MM-DDTHH:mm:ss.sssZ` form. A context has an optional targeting key and optional string, number, or boolean attributes.

Boolean flags serve boolean values. Multivariate flags map stable variant keys to string values. Every flag declares a default. Targeting conditions compare values without coercion. A missing attribute or a value of the wrong type does not match the rule. The first matching rule wins.

Percentage rollouts use 100,000 integer buckets. See [ADR 0002](docs/decisions/0002-canonical-serialization-and-hashing.md) for the exact canonical serialization and SHA-256 assignment contract.

## Usage

```ts
import {
  evaluateBoolean,
  type Configuration,
} from "@feature-rollout/evaluation";

const configuration: Configuration = {
  schemaVersion: "configuration-v1",
  configurationVersion: 1,
  environment: "production",
  generatedAt: "2026-08-26T00:00:00.000Z",
  expiresAt: "2026-08-27T00:00:00.000Z",
  flags: [
    {
      key: "new-checkout",
      type: "boolean",
      defaultValue: false,
      rules: [],
      rollout: {
        id: "checkout-10-percent",
        bucketBy: "targetingKey",
        salt: "checkout-v1",
        allocations: [
          { serve: true, weight: 10_000 },
          { serve: false, weight: 90_000 },
        ],
      },
    },
  ],
};

const result = evaluateBoolean({
  configuration,
  flagKey: "new-checkout",
  context: {
    schemaVersion: "evaluation-context-v1",
    targetingKey: "synthetic-user-42",
  },
  fallbackValue: false,
});
```

The evaluator uses the flag's declared default when a valid configuration cannot produce a decision. It uses the typed caller fallback only when the configuration is invalid, the flag is absent, or the caller uses the wrong typed evaluator.

## Reason codes

| Code                               | Meaning                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `TARGETING_MATCH`                  | The first matching ordered rule served the value.                              |
| `PERCENTAGE_MATCH`                 | A rollout allocation served the value.                                         |
| `DEFAULT_NO_MATCH`                 | No rule matched and no rollout applied.                                        |
| `DEFAULT_MISSING_BUCKET_ATTRIBUTE` | The rollout's bucket attribute was absent.                                     |
| `DEFAULT_STALE_CONFIGURATION`      | The configuration reached its `expiresAt` time.                                |
| `DEFAULT_INVALID_CONTEXT`          | The context failed schema validation.                                          |
| `FALLBACK_INVALID_CONFIGURATION`   | The configuration failed structural or semantic validation.                    |
| `FALLBACK_FLAG_NOT_FOUND`          | The configuration did not contain the requested flag.                          |
| `FALLBACK_FLAG_TYPE_MISMATCH`      | The caller used the boolean evaluator for a multivariate flag, or the reverse. |

Evaluation details never contain context keys or values.

## Design position

Evaluation must be deterministic. The same context and configuration must return the same result across processes.

The first release will have one server-side TypeScript SDK and a small management API. Client-side SDKs, experimentation statistics, and multi-region replication remain out of scope. [ADR 0001](docs/decisions/0001-foundation.md) records the workspace and service boundaries.

## License

[MIT](LICENSE)
