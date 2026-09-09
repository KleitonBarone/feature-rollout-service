import { describe, expect, it } from "vitest";

import {
  ContractValidationError,
  parseConfiguration,
  selectAllocation,
  serializeConfiguration,
  type Configuration,
} from "../src/index.js";

const configuration: Configuration = {
  schemaVersion: "configuration-v1",
  configurationVersion: 1,
  environment: "test",
  generatedAt: "2025-01-01T00:00:00.000Z",
  expiresAt: "2030-01-01T00:00:00.000Z",
  flags: [
    {
      key: "enabled",
      type: "boolean",
      defaultValue: false,
      rules: [],
    },
  ],
};

describe("configuration contract", () => {
  it("canonicalizes object keys independently of insertion order", () => {
    const reordered = {
      flags: configuration.flags,
      expiresAt: configuration.expiresAt,
      generatedAt: configuration.generatedAt,
      environment: configuration.environment,
      configurationVersion: configuration.configurationVersion,
      schemaVersion: configuration.schemaVersion,
    };

    expect(serializeConfiguration(reordered)).toBe(
      serializeConfiguration(configuration),
    );
    expect(serializeConfiguration(configuration)).toBe(
      '{"configurationVersion":1,"environment":"test","expiresAt":"2030-01-01T00:00:00.000Z","flags":[{"defaultValue":false,"key":"enabled","rules":[],"type":"boolean"}],"generatedAt":"2025-01-01T00:00:00.000Z","schemaVersion":"configuration-v1"}',
    );
  });

  it("rejects rollout weights that do not cover every bucket", () => {
    const invalid = structuredClone(configuration);
    invalid.flags = [
      {
        key: "partial",
        type: "boolean",
        defaultValue: false,
        rules: [],
        rollout: {
          id: "partial-rollout",
          bucketBy: "targetingKey",
          salt: "salt",
          allocations: [{ serve: true, weight: 99_999 }],
        },
      },
    ];

    expect(() => parseConfiguration(invalid)).toThrow(ContractValidationError);
  });

  it("rejects unknown multivariate variant references", () => {
    const invalid = {
      ...configuration,
      flags: [
        {
          key: "theme",
          type: "multivariate",
          variants: [{ key: "control", value: "standard" }],
          defaultVariant: "missing",
          rules: [],
        },
      ],
    };

    expect(() => parseConfiguration(invalid)).toThrow(ContractValidationError);
  });

  it("rejects noncanonical and impossible timestamps", () => {
    expect(() =>
      parseConfiguration({
        ...configuration,
        generatedAt: "2025-02-30T00:00:00.000Z",
      }),
    ).toThrow(ContractValidationError);
    expect(() =>
      parseConfiguration({
        ...configuration,
        generatedAt: "2025-01-01T00:00:00Z",
      }),
    ).toThrow(ContractValidationError);
  });
});

describe("bucket contract", () => {
  it.each([-1, 100_000, 1.5])("rejects invalid bucket %s", (bucket) => {
    expect(() => selectAllocation([{ weight: 100_000 }], bucket)).toThrow(
      RangeError,
    );
  });
});
