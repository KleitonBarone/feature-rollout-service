# Feature Rollout Service

Feature Rollout Service is being built for teams that want to roll out features gradually in Node.js applications. The intended workflow is to publish flag configuration once, then evaluate it locally in your application with stable user assignment and explicit defaults during outages.

The evaluator works today. The configuration service and installable SDK are still planned, so this repository is currently for trying the evaluation model or contributing to its development.

## Try what works today

Use Node.js 24 and pnpm 11. From a checkout of this repository:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

The tests exercise targeting, percentage assignment, defaults, and configuration validation. Follow the [local evaluation example](docs/evaluation.md#try-the-evaluator) to run a flag check and inspect its reason.

There is no package-registry installation or running service quickstart yet. Those are requirements of the [completion plan](docs/implementation-plan.md).

## What does it do?

The current evaluator supports:

- Boolean flags and multivariate flags with string values.
- Ordered attribute rules with typed comparisons.
- Deterministic percentage rollouts for stable targeting keys.
- Declared flag defaults and typed caller fallbacks.
- Decision details that identify the rule, rollout, or default used.

The first release will add environment management, immutable publication, audit history, and a TypeScript SDK with local caching and background refresh. Your application will evaluate flags without a network request for each check.

## Where to go next

- [Evaluation reference and example](docs/evaluation.md) for the behavior implemented today.
- [Roadmap](ROADMAP.md) for status and the order of work.
- [Implementation plan](docs/implementation-plan.md) for the path to a usable first release, starting with development and end-to-end testing.

The first release focuses on one self-hosted service and one Node.js SDK. A management UI, experimentation statistics, browser SDKs, and multi-region replication are outside that scope.

## License

[MIT](LICENSE)
