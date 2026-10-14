import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  prepareSnapshot,
  parseConfigurationV2,
  ContractValidationError,
  serializeConfigurationV2,
} from "../src/index.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../conformance/v1/evaluation.json", import.meta.url),
    "utf8",
  ),
) as { configurations: { standard: Record<string, unknown> } };
const base = structuredClone(fixture.configurations.standard);
delete base.expiresAt;
const configuration = { ...base, schemaVersion: "configuration-v2" };

describe("prepared snapshots", () => {
  it("preserves ordered decisions, isolates mutation, and explicitly defaults on stale state", () => {
    const source: Record<string, unknown> = structuredClone(configuration);
    const snapshot = prepareSnapshot(source);
    source.flags = [];
    expect(
      snapshot.boolean(
        "ordered-rule",
        {
          schemaVersion: "evaluation-context-v1",
          attributes: { region: "BR", plan: "pro" },
        },
        false,
      ).ruleId,
    ).toBe("region-first");
    expect(
      snapshot.boolean(
        "ordered-rule",
        { schemaVersion: "evaluation-context-v1" },
        true,
        true,
      ).reasonCode,
    ).toBe("DEFAULT_STALE_CONFIGURATION");
    expect(Object.isFrozen(snapshot.configuration.flags)).toBe(true);
    expect(
      snapshot.multivariate(
        "theme",
        { schemaVersion: "evaluation-context-v1" },
        "fallback",
      ).value,
    ).toBe("standard");
  });
  it("rejects embedded transport expiry in v2", () => {
    expect(() =>
      parseConfigurationV2({
        ...configuration,
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
    ).toThrow(ContractValidationError);
  });
  it("rejects invalid Unicode and unsafe runtime objects", () => {
    expect(() =>
      serializeConfigurationV2({ ...configuration, environment: "\ud800" }),
    ).toThrow(ContractValidationError);
    const snapshot = prepareSnapshot(configuration);
    expect(
      snapshot.boolean(
        "ordered-rule",
        {
          schemaVersion: "evaluation-context-v1",
          attributes: Object.create({ region: "BR" }) as unknown,
        },
        false,
      ).reasonCode,
    ).toBe("DEFAULT_INVALID_CONTEXT");
  });
});
