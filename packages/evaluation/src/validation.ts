import { Value } from "@sinclair/typebox/value";

import {
  ConfigurationSchema,
  EvaluationContextSchema,
  type Configuration,
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
  schema: typeof ConfigurationSchema | typeof EvaluationContextSchema,
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

function semanticConfigurationIssues(configuration: Configuration): string[] {
  const issues: string[] = [];
  const generatedAt = canonicalTimestamp(configuration.generatedAt);
  const expiresAt = canonicalTimestamp(configuration.expiresAt);

  if (generatedAt === undefined) {
    issues.push("generatedAt must be a canonical UTC timestamp");
  }
  if (expiresAt === undefined) {
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
  const issues = structuralIssues(EvaluationContextSchema, input);
  if (issues.length > 0) {
    throw new ContractValidationError("Invalid evaluation context", issues);
  }

  return input as EvaluationContext;
}
