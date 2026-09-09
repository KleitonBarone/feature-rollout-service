import { createHash } from "node:crypto";

import { serializeHashTuple } from "./canonical.js";
import type { AttributeValue } from "./model.js";

export const BUCKET_COUNT = 100_000;

export type AssignmentInput = {
  flagKey: string;
  salt: string;
  value: AttributeValue;
};

/** Returns an integer in the inclusive range 0..99,999. */
export function assignmentBucket(input: AssignmentInput): number {
  const hashInput = serializeHashTuple([
    "frs-percentage-v1",
    input.salt,
    input.flagKey,
    input.value,
  ]);
  const digest = createHash("sha256").update(hashInput, "utf8").digest();
  const prefix = digest.readBigUInt64BE(0);
  return Number(prefix % BigInt(BUCKET_COUNT));
}

export function selectAllocation<T extends { weight: number }>(
  allocations: readonly T[],
  bucket: number,
): T {
  if (!Number.isInteger(bucket) || bucket < 0 || bucket >= BUCKET_COUNT) {
    throw new RangeError(
      `Bucket must be an integer from 0 to ${String(BUCKET_COUNT - 1)}`,
    );
  }

  let upperBound = 0;
  for (const allocation of allocations) {
    upperBound += allocation.weight;
    if (bucket < upperBound) {
      return allocation;
    }
  }

  throw new RangeError("Allocation weights do not cover the bucket");
}
