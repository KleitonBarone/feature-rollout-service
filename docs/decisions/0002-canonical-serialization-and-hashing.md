# 0002: Canonical serialization and percentage hashing

Status: accepted, 2026-08-26

## Decision

Validate a configuration before serializing it. Serialize valid configurations with the JSON Canonicalization Scheme from RFC 8785 and UTF-8 encoding. Object keys are sorted by the scheme. Array order stays intact because flag, rule, variant, and allocation order can affect evaluation.

Percentage assignment uses 100,000 integer buckets numbered 0 through 99,999. Allocation weights are integers and must total 100,000. The lower bound is inclusive and the upper bound is exclusive.

Build the hash input as the canonical JSON array below. The last value keeps its JSON scalar type.

```json
["frs-percentage-v1", "<rollout salt>", "<flag key>", "<bucket value>"]
```

Hash its UTF-8 bytes with SHA-256. Read the first eight digest bytes as one unsigned, big-endian 64-bit integer, then take the value modulo 100,000. The result is the bucket.

Keep a rollout's salt unchanged to preserve assignment across configuration versions. Change the salt when a rollout intentionally needs a new assignment population.

## Consequences

- String concatenation cannot create ambiguous hash inputs.
- `42`, `"42"`, and `true` produce separate assignments.
- Rules and rollouts use no floating-point percentages.
- A serialization, tuple, digest, byte-order, or bucket-count change is a compatibility change. It requires a new schema or hash algorithm identifier and new conformance fixtures.
