# Node.js integration

Use Node.js 24 with ESM. Run `pnpm pack:release` to create local tarballs in `.local/artifacts`. Public registry publication is pending credentials and namespace confirmation.

```ts
import { RolloutClient } from "@feature-rollout/sdk-node";

const flags = new RolloutClient({
  url: "http://127.0.0.1:3100",
  token: process.env.ROLLOUT_READ_TOKEN ?? "",
  environment: "demo",
});
await flags.start();
const enabled = flags.boolean(
  "new-checkout",
  { targetingKey: "synthetic-user-42" },
  false,
);
await flags.close(); // On application shutdown.
```

Create one client per environment at startup, not per request. `start()` waits up to five seconds and rejects if configuration remains unavailable. Catch that error if the application should continue with its supplied fallbacks; background retries continue. `waitForReady()` can wait again. `refresh()` coalesces concurrent requests and reports success as a boolean. `close()` aborts refresh, cancels timers, and rejects readiness waiters.

`boolean` returns a boolean, `multivariate` a string. `booleanDetails` and `multivariateDetails` explain the rule, variant, rollout, bucket, and publication used. Context contains a targeting key and optional scalar attributes. The SDK adds the schema version. Checks are synchronous and send no evaluation identities or attributes to the service.

Default polling is 30 seconds with 10% jitter, a two-second request timeout, and a five-minute freshness limit. Override `refreshIntervalMs`, `requestTimeoutMs`, `initializationTimeoutMs`, or `maxAgeMs` explicitly. Retries use bounded exponential backoff. Matching authenticated `304` responses renew validation age without changing publication bytes. Failed, oversized, malformed, older, or changed equal-version responses never renew freshness.

Before usable configuration, for absent flags, or for wrong typed access, the caller fallback wins. At maximum age or with invalid context, declared defaults win. `401`, `403`, and `410` immediately mark cached configuration stale. After close, cached flag definitions still provide declared defaults; without them caller fallbacks apply.

`status()` reports idle/loading/ready/stale/closed, version, and safe last error. Optional `onStatus` and `onEvaluation` callbacks run locally; callback failures cannot change decisions. `status()` observes expiry even between refreshes.

`exportSnapshot()` provides caller-managed bootstrap data and its last validation time. `bootstrap` requires a matching environment and recent timestamp. It does not renew age; there is no implicit disk cache. Rotate credentials by constructing a new client.

Remote kills arrive after polling and cannot immediately reach disconnected applications. Feature flags must not replace application authorization.
