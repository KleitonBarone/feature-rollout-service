# Feature Rollout Service

Feature Rollout Service is a self-hosted feature-flag service for Node.js applications. Publish a flag, target users or roll it out by percentage, and evaluate it locally through a TypeScript SDK. Flag checks keep working during outages and return explicit defaults when cached configuration becomes stale.

The service and SDK are implemented. The SDK lives in this repository as a copyable folder with JavaScript and TypeScript declarations. No npm package is published.

## Try it locally

Use Node.js 24 and pnpm 11. From a checkout of this repository:

```sh
pnpm install --frozen-lockfile
pnpm demo
```

Open `http://127.0.0.1:3101/?subject=synthetic-user-42`. The demo starts PostgreSQL, publishes a flag through the API, and runs an application using the SDK. Try another synthetic subject to see stable percentage assignment. Docker is optional. Stop with Ctrl+C; demonstration data stays in `.local/demo-postgres`.

## What does it do?

You can use:

- Boolean flags and multivariate flags with string values.
- Ordered attribute rules with typed comparisons.
- Deterministic percentage rollouts for stable targeting keys.
- Declared flag defaults and typed caller fallbacks.
- Decision details that identify the rule, rollout, or default used.
- Separate environments, scoped credentials, immutable publication, and audit history.
- Kill and rollback operations, SDK polling, and recovery after outages.

Your application makes no HTTP request for each flag check. Updates arrive through background polling; a disconnected client cannot receive an immediate remote kill.

## Where to go next

- Copy [sdk/](sdk/README.md) into your application, then follow [SDK integration](docs/sdk.md).
- [Management API](docs/api.md) for publishing and inspecting flags.
- [Running the service](docs/operations.md) for containers, credentials, upgrades, and backups.
- [Contributing](CONTRIBUTING.md) for the development loop and `pnpm verify`.
- [Roadmap](ROADMAP.md) for implementation and release status.

The first release focuses on one self-hosted service and one Node.js SDK. A management UI, experimentation statistics, browser SDKs, and multi-region replication are outside that scope.

## License

[MIT](LICENSE)
