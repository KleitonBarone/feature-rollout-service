import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  assignmentBucket,
  evaluateBoolean,
  evaluateMultivariate,
  selectAllocation,
  type AssignmentInput,
  type EvaluationDetails,
} from "../src/index.js";

type HashingFixtures = {
  schemaVersion: "hashing-conformance-v1";
  cases: readonly {
    name: string;
    input: AssignmentInput;
    expectedBucket: number;
  }[];
};

type BucketingFixtures = {
  schemaVersion: "bucketing-conformance-v1";
  allocations: readonly { name: string; weight: number }[];
  cases: readonly { name: string; bucket: number; expected: string }[];
};

type EvaluationCase = {
  name: string;
  operation: "boolean" | "multivariate";
  configuration: string;
  flagKey: string;
  context: unknown;
  fallbackValue: boolean | string;
  now: string;
  expected: EvaluationDetails<boolean | string>;
};

type EvaluationFixtures = {
  schemaVersion: "evaluation-conformance-v1";
  configurations: Readonly<Record<string, unknown>>;
  cases: readonly EvaluationCase[];
};

function readFixture(name: string): unknown {
  const fixtureUrl = new URL(
    `../../../conformance/v1/${name}`,
    import.meta.url,
  );
  return JSON.parse(readFileSync(fixtureUrl, "utf8")) as unknown;
}

describe("language-neutral conformance fixtures", () => {
  const hashing = readFixture("hashing.json") as HashingFixtures;
  for (const fixture of hashing.cases) {
    it(`hashing: ${fixture.name}`, () => {
      expect(assignmentBucket(fixture.input)).toBe(fixture.expectedBucket);
    });
  }

  const bucketing = readFixture("bucketing.json") as BucketingFixtures;
  for (const fixture of bucketing.cases) {
    it(`bucketing: ${fixture.name}`, () => {
      expect(selectAllocation(bucketing.allocations, fixture.bucket).name).toBe(
        fixture.expected,
      );
    });
  }

  const evaluation = readFixture("evaluation.json") as EvaluationFixtures;
  for (const fixture of evaluation.cases) {
    it(`evaluation: ${fixture.name}`, () => {
      const configuration = evaluation.configurations[fixture.configuration];
      const common = {
        configuration,
        context: fixture.context,
        flagKey: fixture.flagKey,
        now: new Date(fixture.now),
      };
      const result =
        fixture.operation === "boolean"
          ? evaluateBoolean({
              ...common,
              fallbackValue: fixture.fallbackValue as boolean,
            })
          : evaluateMultivariate({
              ...common,
              fallbackValue: fixture.fallbackValue as string,
            });

      expect(result).toEqual(fixture.expected);
    });
  }
});
