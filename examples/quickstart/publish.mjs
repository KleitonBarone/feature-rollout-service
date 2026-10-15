import { isDeepStrictEqual } from "node:util";

const url = process.env.ROLLOUT_URL ?? "http://127.0.0.1:3100";
const environment = process.env.ROLLOUT_ENVIRONMENT ?? "quickstart";
const token = process.env.ROLLOUT_MANAGEMENT_TOKEN;
if (!token) throw new Error("ROLLOUT_MANAGEMENT_TOKEN is required.");
const path = `/v1/environments/${encodeURIComponent(environment)}`;
const flag = {
  key: "new-checkout",
  type: "boolean",
  defaultValue: false,
  rules: [],
  rollout: {
    id: "checkout-all",
    salt: "checkout-v1",
    bucketBy: "targetingKey",
    allocations: [{ serve: true, weight: 100000 }],
  },
};

async function request(route, method = "GET", body, allowExisting = false) {
  const response = await fetch(url + route, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(5000),
  });
  const result = await response.json();
  if (!response.ok && !(allowExisting && response.status === 409))
    throw new Error(
      `HTTP ${response.status}: ${result.code ?? "request failed"}`,
    );
  return result;
}

await request("/v1/environments", "POST", { name: environment }, true);
let draft = await request(path + "/draft");
if (draft.activeVersion > 0) {
  const current = await request(path + "/configuration");
  if (!isDeepStrictEqual(current.flags, [flag]))
    throw new Error(
      "Existing publication differs from this example. No flags were changed.",
    );
  console.log(
    JSON.stringify({
      environment,
      version: current.configurationVersion,
      reused: true,
    }),
  );
} else {
  if (
    draft.archivedFlags.length ||
    (draft.flags.length && !isDeepStrictEqual(draft.flags, [flag]))
  )
    throw new Error(
      "Existing draft differs from this example. No flags were changed.",
    );
  if (!draft.flags.length)
    draft = await request(path + "/flags/" + flag.key, "PUT", {
      expectedRevision: draft.revision,
      flag,
    });
  const publication = await request(path + "/publish", "POST", {
    expectedRevision: draft.revision,
    expectedActiveVersion: 0,
    idempotencyKey: "quickstart-initial",
  });
  console.log(JSON.stringify(publication));
}
