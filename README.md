# Feature Rollout Service

Feature Rollout Service will evaluate feature flags with deterministic targeting, percentage rollouts, and an audit trail of every configuration change.

Applications will fetch versioned configuration and evaluate flags locally through an SDK. Request handling will not depend on a network round trip to the flag service.

> Status: planning. There is no working release yet. See the [roadmap](ROADMAP.md) for the intended build order.

## Why build this?

A boolean stored in a database is easy. Safe rollouts are harder. Teams need predictable user assignment, environment separation, quick kill switches, stale-cache behavior, and a way to explain why a user received a value.

The first release will provide:

- Boolean and multivariate flags
- Deterministic percentage rollouts
- Attribute-based targeting rules
- Separate environments
- Versioned configuration and audit history
- A server-side SDK with local evaluation and caching
- Evaluation details that explain each decision

## Design position

Evaluation must be deterministic. The same context and configuration must return the same result across processes.

The first release will have one server-side SDK and a small management API. Client-side SDKs, experimentation statistics, and multi-region replication are out of scope.

## License

[MIT](LICENSE)
