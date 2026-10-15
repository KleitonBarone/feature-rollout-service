# Local evaluation

The evaluator validates configuration and makes deterministic local decisions in Node.js. It has no API or database dependency. Published configuration uses `configuration-v2`, prepared once as an immutable indexed snapshot. The repository-only [SDK](sdk.md) bundles this evaluator and adds HTTP refresh and caching.

## Try the evaluator

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
```

Run `node examples/evaluation.mjs`, or run the following from the repository root. It reads synthetic v2 conformance data and supplies freshness explicitly.

```js
import { readFileSync } from "node:fs";
import { prepareSnapshot } from "./packages/evaluation/dist/index.js";

const { configuration } = JSON.parse(
  readFileSync("./conformance/v2/evaluation.json", "utf8"),
);

const snapshot = prepareSnapshot(configuration);
const result = snapshot.boolean(
  "conjunction",
  {
    schemaVersion: "evaluation-context-v1",
    attributes: { region: "BR", plan: "pro" },
  },
  false, // Caller fallback.
  false, // Configuration is not stale.
);

console.log(result.value, result.reasonCode);
// true TARGETING_MATCH
```

A workspace package that declares `@feature-rollout/evaluation` as a dependency can import it by name. Applications normally copy [sdk/](../sdk/README.md), which includes the evaluator without workspace dependencies. No npm package is published.

## Configuration and context

The package exports TypeBox schemas and derived TypeScript types for `configuration-v2` and `evaluation-context-v1`, plus compatible v1 configuration support. `parseConfigurationV2` and `parseEvaluationContext` validate unknown input and throw `ContractValidationError` with validation issues. `prepareSnapshot` validates, copies, freezes, and indexes v2 configuration; invalid input throws before creating a snapshot.

Portable JSON schemas are in [docs/schemas](schemas/configuration-v2.json). Schema validation covers structure; semantic validation additionally checks duplicate keys, variant references, allocation totals, safe numeric values, Unicode, and timestamp validity.

V2 configuration has a positive safe-integer version, environment key, generation timestamp, and ordered flags. It has no expiry timestamp. Timestamps use exactly `YYYY-MM-DDTHH:mm:ss.sssZ`. Context has an optional targeting key and optional string, number, or boolean attributes. Runtime data must be plain JSON without getters, cycles, malformed Unicode, or unsafe numbers. Validation bounds malformed nesting without changing the valid schemas.

Boolean flags serve booleans and declare `defaultValue`. Multivariate flags map variant keys to strings and declare `defaultVariant`. Rules and allocations refer to variant keys. Arbitrary JSON variant values are not supported.

Each rule joins its conditions with AND. Conditions support `equals` and `not-equals`, without coercion. A missing or differently typed attribute never matches either operator. The first matching rule wins, including when a rollout exists.

A rollout selects `targetingKey` or an attribute named by `bucketBy`. Allocations have positive integer weights totaling 100,000. A 10% allocation has weight 10,000. One allocation of weight 100,000 serves everyone; omit an allocation to serve no one that value. The [serialization and hashing decision](decisions/0002-canonical-serialization-and-hashing.md) defines bytes, hashing, and interval boundaries.

## Defaults and freshness

With a valid snapshot and the correct evaluation type, unmatched rules, a missing bucket attribute, invalid context, or explicit stale state uses the declared default. An absent flag or wrong typed accessor uses the required caller fallback. Before the SDK has a usable snapshot, it also uses caller fallbacks. A direct `prepareSnapshot` call instead throws on invalid configuration; callers must handle that initialization error.

Prepared snapshots do not read the clock or perform HTTP requests. Their `boolean` and `multivariate` methods take stale state as the fourth argument, defaulting to `false`. Replaying publication content, context, and freshness state reproduces a decision.

The [SDK](sdk.md) tracks age since authenticated validation using a monotonic clock. A valid `200` or matching `304` renews freshness; failed refreshes do not. Maximum age and observed credential rejection select declared defaults. See [ADR 0004](decisions/0004-publication-freshness.md).

## Compatible v1 evaluation

`parseConfiguration`, `serializeConfiguration`, `evaluateBoolean`, and `evaluateMultivariate` retain `configuration-v1` support. V1 embeds `expiresAt` in immutable content and becomes stale at `now >= expiresAt`. Its evaluators accept `now` for deterministic replay and otherwise use current time. Invalid v1 configuration returns the caller fallback. V1 parsing, percentage assignments, and [fixtures](../conformance/v1/evaluation.json) remain supported; the service and SDK use v2.

## Evaluation details

Snapshot methods, SDK detail methods, and v1 evaluators return a typed value, flag key, reason code, and applicable configuration version, rule ID, rollout ID, bucket, or variant key. Details do not copy context attributes or targeting keys.

| Code                               | Meaning                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `TARGETING_MATCH`                  | The first matching rule served the value.                               |
| `PERCENTAGE_MATCH`                 | A rollout allocation served the value.                                  |
| `DEFAULT_NO_MATCH`                 | No rule matched and no rollout applied.                                 |
| `DEFAULT_MISSING_BUCKET_ATTRIBUTE` | The bucket attribute was absent.                                        |
| `DEFAULT_STALE_CONFIGURATION`      | Explicit stale state, SDK freshness, or v1 expiry selected the default. |
| `DEFAULT_INVALID_CONTEXT`          | Context failed validation.                                              |
| `FALLBACK_INVALID_CONFIGURATION`   | Configuration failed structural or semantic validation.                 |
| `FALLBACK_FLAG_NOT_FOUND`          | The requested flag was absent.                                          |
| `FALLBACK_FLAG_TYPE_MISMATCH`      | The caller used the wrong typed evaluator.                              |

The [conformance fixtures](../conformance/README.md) provide portable inputs and expected outputs.
