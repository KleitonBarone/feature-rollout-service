import { RolloutClient } from "./vendor/feature-rollout/index.js";

const flags = new RolloutClient({
  url: process.env.ROLLOUT_URL ?? "http://127.0.0.1:3100",
  token: process.env.ROLLOUT_READ_TOKEN ?? "",
  environment: process.env.ROLLOUT_ENVIRONMENT ?? "quickstart",
});
try {
  await flags.start();
  console.log(
    JSON.stringify(
      flags.booleanDetails(
        "new-checkout",
        { targetingKey: "synthetic-user-42" },
        false,
      ),
    ),
  );
} finally {
  await flags.close();
}
