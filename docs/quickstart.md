# Integrate your first flag

This guide starts a fresh local service, publishes a flag, and runs the copied SDK in an application outside this repository. Use Node.js 24 and pnpm 11. Docker and npm publishing are not required.

The example uses public synthetic credentials scoped to `quickstart`. They are for localhost only. Generate different tokens for real installations and keep management credentials out of your application. See [operations](operations.md) for credential rotation and deployment.

## Start storage and the service

Use free ports 55432 and 3100. Do not stop an existing service to free them; configure different ports using the operations guide if needed.

From the repository root, in one terminal:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm dev:db
```

Leave PostgreSQL running. In another terminal at the repository root, apply migrations and start the service with the [example service settings](../examples/quickstart/service.env.example):

```sh
node --env-file=examples/quickstart/service.env.example packages/service/dist/main.js migrate
node --env-file=examples/quickstart/service.env.example packages/service/dist/main.js
```

The service listens at `http://127.0.0.1:3100`. Readiness is available at `/health/ready`. Migrations are explicit; starting the server does not apply them.

## Create and publish the flag

In a third terminal at the repository root:

```sh
node --env-file=examples/quickstart/service.env.example examples/quickstart/publish.mjs
```

The [publish script](../examples/quickstart/publish.mjs) makes ordinary authenticated HTTP requests. It creates `quickstart`, upserts the boolean flag `new-checkout` with its expected draft revision, and publishes using the expected active version and an idempotency key. The flag defaults to `false` and has a 100% `true` rollout for callers with a targeting key.

The command prints publication version 1. Rerunning reuses matching published content without publishing pending draft changes. It refuses to overwrite a different example definition. The script contains the full request bodies; [API documentation](api.md) describes updates, kill, rollback, and audit access.

## Copy the SDK into an application

From the repository root, create a new sibling application directory:

```sh
node examples/quickstart/copy.mjs ../rollout-quickstart
cd ../rollout-quickstart
node --env-file=.env app.mjs
```

The copy command requires a new directory and refuses to overwrite an existing application. It copies the entire `sdk/` folder to `vendor/feature-rollout`, the [application example](../examples/quickstart/app.mjs), and [read-only application settings](../examples/quickstart/application.env.example). It does not copy management credentials. No package installation or workspace links are needed in this application.

The application imports `./vendor/feature-rollout/index.js`, starts one client, and evaluates `new-checkout` for `synthetic-user-42`. The result contains `value: true`, `reasonCode: "PERCENTAGE_MATCH"`, and `configurationVersion: 1`. It closes the client in `finally` and exits.

For a server application, keep the client alive across requests and close it on shutdown. See [SDK integration](sdk.md) for initialization failures, refresh, defaults, and callbacks. A declared default applies after cached configuration becomes stale; a caller fallback applies before configuration is available.

## Stop the example

Stop the service and PostgreSQL with Ctrl+C in their terminals. Development data stays in `.local/postgres`; the copied application stays in your chosen directory. Remove that application only when you no longer need it. The automated quickstart test instead uses disposable storage and removes its temporary application after completion.
