# 0004: Immutable content and transport freshness

Status: accepted, 2026-10-14

`configuration-v2` retains flag semantics, generation time, environment, and monotonically increasing publication version. It removes `expiresAt`. The SHA-256 assignment tuple stays unchanged. Existing v1 parsing and absolute expiry remain supported by the evaluator.

The SDK tracks successful authenticated validation with a monotonic clock. Valid `200` or matching `304` responses renew local freshness. Errors never extend it. At maximum age the SDK returns declared defaults from its last validated snapshot. Missing snapshots and flags use required caller fallbacks.

Prepared snapshots defensively clone and freeze validated configuration and index flags. Flag checks validate only context, require no network access, and never revalidate all configuration. Reproducing a decision requires publication content, context, and explicit freshness state.

Default refresh interval is 30 seconds, request timeout 2 seconds, initialization deadline 5 seconds, and maximum validation age 5 minutes. Applications can choose shorter bounds. Kill changes arrive after polling; disconnected applications cannot receive an immediate remote kill.
