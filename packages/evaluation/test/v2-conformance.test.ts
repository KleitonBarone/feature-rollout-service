import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { prepareSnapshot } from "../src/index.js";
type Case = {
  name: string;
  key: string;
  context: unknown;
  stale: boolean;
  value: boolean | string;
  reasonCode: string;
} & (
  | { type: "boolean"; fallback: boolean }
  | { type: "multivariate"; fallback: string }
);
const fixtures = JSON.parse(
  readFileSync(
    new URL("../../../conformance/v2/evaluation.json", import.meta.url),
    "utf8",
  ),
) as { configuration: unknown; cases: Case[] };
const snapshot = prepareSnapshot(fixtures.configuration);
for (const fixture of fixtures.cases)
  it(fixture.name, () => {
    const result =
      fixture.type === "boolean"
        ? snapshot.boolean(
            fixture.key,
            fixture.context,
            fixture.fallback,
            fixture.stale,
          )
        : snapshot.multivariate(
            fixture.key,
            fixture.context,
            fixture.fallback,
            fixture.stale,
          );
    expect(result.value).toBe(fixture.value);
    expect(result.reasonCode).toBe(fixture.reasonCode);
  });
