import { performance } from "node:perf_hooks";
import {
  prepareSnapshot,
  serializeConfigurationV2,
} from "../packages/evaluation/dist/index.js";
for (const count of [10, 100, 1000]) {
  const configuration = {
    schemaVersion: "configuration-v2",
    environment: "benchmark",
    configurationVersion: 1,
    generatedAt: "2026-10-14T00:00:00.000Z",
    flags: Array.from({ length: count }, (_, i) => ({
      key: `flag-${i}`,
      type: "boolean",
      defaultValue: false,
      rules: [],
      rollout: {
        id: "half",
        salt: "benchmark-v1",
        bucketBy: "targetingKey",
        allocations: [
          { serve: true, weight: 50000 },
          { serve: false, weight: 50000 },
        ],
      },
    })),
  };
  const start = performance.now();
  const snapshot = prepareSnapshot(configuration);
  const preparationMs = performance.now() - start;
  const runs = 10000;
  let enabled = 0;
  const evaluationStart = performance.now();
  for (let i = 0; i < runs; i++)
    if (
      snapshot.boolean(
        `flag-${i % count}`,
        {
          schemaVersion: "evaluation-context-v1",
          targetingKey: `synthetic-${i}`,
        },
        false,
      ).value
    )
      enabled++;
  console.log(
    JSON.stringify({
      flags: count,
      bytes: Buffer.byteLength(serializeConfigurationV2(configuration)),
      preparationMs: Number(preparationMs.toFixed(2)),
      evaluationMicroseconds: Number(
        (((performance.now() - evaluationStart) * 1000) / runs).toFixed(2),
      ),
      enabled,
      runs,
    }),
  );
}
