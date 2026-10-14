# Conformance fixtures

The `v1` directory defines portable JSON inputs and expected outputs for every evaluation implementation. A conforming implementation must run these files without changing their values or ordering.

- `evaluation.json` covers ordered rules, missing and mismatched attributes, rollouts, stale configuration, declared defaults, and caller fallbacks.
- `hashing.json` fixes the exact percentage hash input and resulting bucket.
- `bucketing.json` fixes allocation boundary behavior. Buckets are zero-based and allocation upper bounds are exclusive.

Fixtures use synthetic identities. JSON object key order is never significant. Array order is significant for rules, variants, and rollout allocations.

`v2/evaluation.json` covers prepared snapshots, conjunctions, strict inequality, rule precedence, complete allocations, and multivariate rollout/default behavior. It takes explicit stale state instead of an embedded expiry timestamp. Existing v1 fixtures remain unchanged except for additional hash vectors.
