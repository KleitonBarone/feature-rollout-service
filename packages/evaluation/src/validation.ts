import { Value } from "@sinclair/typebox/value";

import {
  ConfigurationSchema,
  ConfigurationV2Schema,
  EvaluationContextSchema,
  type Configuration,
  type ConfigurationV2,
  type EvaluationContext,
  type Flag,
} from "./model.js";

export class ContractValidationError extends Error {
  public constructor(
    message: string,
    public readonly issues: readonly string[],
  ) {
    super(message);
    this.name = "ContractValidationError";
  }
}

function structuralIssues(
  schema:
    | typeof ConfigurationSchema
    | typeof ConfigurationV2Schema
    | typeof EvaluationContextSchema,
  input: unknown,
): string[] {
  return [...Value.Errors(schema, input)].map(
    (error) => `${error.path || "/"}: ${error.message}`,
  );
}

function validateFlagReferences(flag: Flag): string[] {
  if (flag.type === "boolean") {
    return [];
  }

  const issues: string[] = [];
  const keys = new Set<string>();
  for (const variant of flag.variants) {
    if (keys.has(variant.key)) {
      issues.push(`flag ${flag.key}: duplicate variant ${variant.key}`);
    }
    keys.add(variant.key);
  }

  if (!keys.has(flag.defaultVariant)) {
    issues.push(
      `flag ${flag.key}: unknown default variant ${flag.defaultVariant}`,
    );
  }
  for (const rule of flag.rules) {
    if (!keys.has(rule.serve)) {
      issues.push(
        `flag ${flag.key}: rule ${rule.id} serves unknown variant ${rule.serve}`,
      );
    }
  }
  for (const allocation of flag.rollout?.allocations ?? []) {
    if (!keys.has(allocation.serve)) {
      issues.push(
        `flag ${flag.key}: rollout serves unknown variant ${allocation.serve}`,
      );
    }
  }

  return issues;
}

function semanticConfigurationIssues(
  configuration: Configuration | ConfigurationV2,
): string[] {
  const issues: string[] = [];
  const generatedAt = canonicalTimestamp(configuration.generatedAt);
  const expiresAt =
    "expiresAt" in configuration
      ? canonicalTimestamp(configuration.expiresAt)
      : undefined;

  if (generatedAt === undefined) {
    issues.push("generatedAt must be a canonical UTC timestamp");
  }
  if ("expiresAt" in configuration && expiresAt === undefined) {
    issues.push("expiresAt must be a canonical UTC timestamp");
  }
  if (
    generatedAt !== undefined &&
    expiresAt !== undefined &&
    expiresAt <= generatedAt
  ) {
    issues.push("expiresAt must be later than generatedAt");
  }

  const flagKeys = new Set<string>();
  for (const flag of configuration.flags) {
    if (flagKeys.has(flag.key)) {
      issues.push(`duplicate flag key ${flag.key}`);
    }
    flagKeys.add(flag.key);

    const ruleIds = new Set<string>();
    for (const rule of flag.rules) {
      if (ruleIds.has(rule.id)) {
        issues.push(`flag ${flag.key}: duplicate rule id ${rule.id}`);
      }
      ruleIds.add(rule.id);
    }

    if (flag.rollout) {
      const total = flag.rollout.allocations.reduce(
        (sum, allocation) => sum + allocation.weight,
        0,
      );
      if (total !== 100_000) {
        issues.push(
          `flag ${flag.key}: rollout weights must total 100000, got ${String(total)}`,
        );
      }
    }
    issues.push(...validateFlagReferences(flag));
  }

  return issues;
}

function canonicalTimestamp(value: string): number | undefined {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return undefined;
  return new Date(milliseconds).toISOString() === value
    ? milliseconds
    : undefined;
}

export function parseConfiguration(input: unknown): Configuration {
  assertJSON(input);
  const issues = structuralIssues(ConfigurationSchema, input);
  if (issues.length > 0) {
    throw new ContractValidationError("Invalid configuration", issues);
  }

  const configuration = input as Configuration;
  const semanticIssues = semanticConfigurationIssues(configuration);
  if (semanticIssues.length > 0) {
    throw new ContractValidationError("Invalid configuration", semanticIssues);
  }

  return configuration;
}

export function parseEvaluationContext(input: unknown): EvaluationContext {
  assertJSON(input);
  const issues = structuralIssues(EvaluationContextSchema, input);
  if (issues.length > 0) {
    throw new ContractValidationError("Invalid evaluation context", issues);
  }

  return input as EvaluationContext;
}

export function parseConfigurationV2(input: unknown): ConfigurationV2 {
  assertJSON(input);
  if (!Value.Check(ConfigurationV2Schema, input))
    throw new ContractValidationError(
      "Invalid configuration",
      structuralIssues(ConfigurationV2Schema, input),
    );
  const issues = semanticConfigurationIssues(input);
  if (issues.length)
    throw new ContractValidationError("Invalid configuration", issues);
  return input;
}

/** Rejects non-JSON runtime values and strings that RFC 8785 cannot serialize. */
export function assertJSON(input: unknown, parents = new Set<object>()): void {
  const invalid = () => {
    throw new ContractValidationError("Unsupported JSON value", [
      "Use plain JSON, finite safe numbers, and well-formed Unicode.",
    ]);
  };
  if (input === null || typeof input === "boolean") return;
  if (typeof input === "string") {
    if (!input.isWellFormed()) invalid();
    return;
  }
  if (typeof input === "number") {
    if (
      !Number.isFinite(input) ||
      (Number.isInteger(input) && !Number.isSafeInteger(input))
    )
      invalid();
    return;
  }
  if (typeof input !== "object") return invalid();
  if (
    !Array.isArray(input) &&
    Object.getPrototypeOf(input) !== Object.prototype &&
    Object.getPrototypeOf(input) !== null
  )
    invalid();
  if (parents.has(input)) return invalid();
  if (Object.getOwnPropertySymbols(input).length) return invalid();
  parents.add(input);
  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(input),
  )) {
    if (Array.isArray(input) && key === "length") continue;
    if (
      !key.isWellFormed() ||
      !("value" in descriptor) ||
      !descriptor.enumerable
    )
      invalid();
    assertJSON(descriptor.value as unknown, parents);
  }
  if (Array.isArray(input) && Object.keys(input).length !== input.length)
    invalid();
  parents.delete(input);
}
