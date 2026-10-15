# Copyable Node SDK

Copy this entire `sdk` folder into your application, for example as `vendor/feature-rollout`.

```ts
import { RolloutClient } from "./vendor/feature-rollout/index.js";

const client = new RolloutClient({
  url: "http://127.0.0.1:3100",
  token: process.env.ROLLOUT_READ_TOKEN ?? "",
  environment: "demo",
});
await client.start();
const enabled = client.boolean(
  "new-checkout",
  { targetingKey: "synthetic-user-42" },
  false,
);
await client.close();
```

Requires Node.js 24 and ESM. No runtime dependencies or registry installation are needed. JavaScript, TypeScript declarations, license, and third-party notices are included. Start with the repository's `docs/quickstart.md` for service setup and publication, then `docs/sdk.md` for lifecycle and failure behavior.

The maintained source is `packages/sdk-node` and `packages/evaluation`. `pnpm build` regenerates this folder's bundled code and declarations. Change the maintained source and rebuild rather than editing generated files.
