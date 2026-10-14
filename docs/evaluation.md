# Local evaluation

The current `@feature-rollout/evaluation` package evaluates supplied configuration in Node.js. It does not fetch configuration or maintain a cache, and it is not published to a package registry yet.

## Try the evaluator

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
```

Run this script from that directory or save it as an `.mjs` file in the repository root. It reads synthetic conformance data and uses explicit time for a reproducible result.

```js
import { readFileSync } from "node:fs";
import { evaluateBoolean } from "./packages/evaluation/dist/index.js";

const fixtures = JSON.parse(
  readFileSync("./conformance/v1/evaluation.json", "utf8"),
);

const result = evaluateBoolean({
  configuration: fixtures.configurations.standard,
  flagKey: "ordered-rule",
  context: {
    schemaVersion: "evaluation-context-v1",
    attributes: { region: "BR", plan: "pro" },
  },
  fallbackValue: false,
  now: new Date("2026-01-01T00:00:00.000Z"),
});

console.log(result.value, result.reasonCode);
// true TARGETING_MATCH
```

A workspace package that declares `@feature-rollout/evaluation` as a dependency can import it by name. Treat the current package as an early local experiment. The [implementation plan](implementation-plan.md) covers an installable SDK.

## Configuration and context

The package exports TypeBox schemas and derived TypeScript types for `configuration-v1` and `evaluation-context-v1`. `parseConfiguration` and `parseEvaluationContext` validate unknown input and throw `ContractValidationError` with validation issues.

Portable JSON schemas are in [docs/schemas](schemas/configuration-v2.json). Schema validation covers structure; semantic validation additionally checks duplicate keys, variant references, allocation totals, safe numeric values, Unicode, and timestamp validity.

Configuration has a positive safe-integer version, environment key, generation and expiry timestamps, and ordered flags. Timestamps use exactly `YYYY-MM-DDTHH:mm:ss.sssZ`. Context has an optional targeting key and optional string, number, or boolean attributes.

Boolean flags serve booleans and declare `defaultValue`. Multivariate flags map variant keys to strings and declare `defaultVariant`. Rules and allocations refer to variant keys. Arbitrary JSON variant values are not supported.

Each rule joins its conditions with AND. Conditions support `equals` and `not-equals`, without coercion. A missing or differently typed attribute never matches either operator. The first matching rule wins, including when a rollout exists.

A rollout selects `targetingKey` or an attribute named by `bucketBy`. Allocations have positive integer weights totaling 100,000. A 10% allocation has weight 10,000. One allocation of weight 100,000 serves everyone; omit an allocation to serve no one that value. The [serialization and hashing decision](decisions/0002-canonical-serialization-and-hashing.md) defines bytes, hashing, and interval boundaries.

## Defaults and time

With valid configuration and the correct evaluation type, unmatched rules, a missing bucket attribute, invalid context, or stale configuration uses the declared default. Invalid configuration, an absent flag, or the wrong typed evaluator uses the required caller fallback.

Configuration becomes stale at `now >= expiresAt`. Pass `now` when replaying decisions or testing boundaries. Otherwise evaluation uses current time, so reaching expiry can change a result even when flag content and attributes stay unchanged.

This describes the compatible v1 evaluator. Published `configuration-v2` omits `expiresAt`; `prepareSnapshot` validates, copies, freezes, and indexes it once. Explicit stale state controls default selection. The [SDK](sdk.md) tracks freshness since authenticated validation, including matching `304` responses. See [ADR 0004](decisions/0004-publication-freshness.md).

## Evaluation details

`evaluateBoolean` and `evaluateMultivariate` return a typed value, flag key, reason code, and applicable configuration version, rule ID, rollout ID, bucket, or variant key. Details do not copy context attributes or targeting keys.

| Code                               | Meaning                                                 |
| ---------------------------------- | ------------------------------------------------------- |
| `TARGETING_MATCH`                  | The first matching rule served the value.               |
| `PERCENTAGE_MATCH`                 | A rollout allocation served the value.                  |
| `DEFAULT_NO_MATCH`                 | No rule matched and no rollout applied.                 |
| `DEFAULT_MISSING_BUCKET_ATTRIBUTE` | The bucket attribute was absent.                        |
| `DEFAULT_STALE_CONFIGURATION`      | Configuration reached expiry.                           |
| `DEFAULT_INVALID_CONTEXT`          | Context failed validation.                              |
| `FALLBACK_INVALID_CONFIGURATION`   | Configuration failed structural or semantic validation. |
| `FALLBACK_FLAG_NOT_FOUND`          | The requested flag was absent.                          |
| `FALLBACK_FLAG_TYPE_MISMATCH`      | The caller used the wrong typed evaluator.              |

The [conformance fixtures](../conformance/README.md) provide portable inputs and expected outputs.
