import type {
  AttributeValue,
  BooleanFlag,
  Configuration,
  EvaluationContext,
  Flag,
  MultivariateFlag,
} from "./model.js";
import { assignmentBucket, selectAllocation } from "./hash.js";
import {
  ContractValidationError,
  parseConfiguration,
  parseEvaluationContext,
} from "./validation.js";

export const reasonCodes = [
  "TARGETING_MATCH",
  "PERCENTAGE_MATCH",
  "DEFAULT_NO_MATCH",
  "DEFAULT_MISSING_BUCKET_ATTRIBUTE",
  "DEFAULT_STALE_CONFIGURATION",
  "FALLBACK_INVALID_CONFIGURATION",
  "DEFAULT_INVALID_CONTEXT",
  "FALLBACK_FLAG_NOT_FOUND",
  "FALLBACK_FLAG_TYPE_MISMATCH",
] as const;

export type ReasonCode = (typeof reasonCodes)[number];

export type EvaluationDetails<T> = {
  value: T;
  flagKey: string;
  reasonCode: ReasonCode;
  configurationVersion?: number;
  ruleId?: string;
  rolloutId?: string;
  bucket?: number;
  variantKey?: string;
};

export type EvaluationOptions<T> = {
  configuration: unknown;
  context: unknown;
  fallbackValue: T;
  flagKey: string;
  now?: Date;
};

function matchesCondition(
  context: EvaluationContext,
  condition: {
    attribute: string;
    operator: "equals" | "not-equals";
    value: AttributeValue;
  },
): boolean {
  const actual = context.attributes?.[condition.attribute];
  if (actual === undefined || typeof actual !== typeof condition.value) {
    return false;
  }
  const equal = actual === condition.value;
  return condition.operator === "equals" ? equal : !equal;
}

function matchesRule(
  context: EvaluationContext,
  rule: { conditions: readonly Parameters<typeof matchesCondition>[1][] },
): boolean {
  return rule.conditions.every((condition) =>
    matchesCondition(context, condition),
  );
}

function bucketValue(
  context: EvaluationContext,
  bucketBy: string,
): AttributeValue | undefined {
  return bucketBy === "targetingKey"
    ? context.targetingKey
    : context.attributes?.[bucketBy];
}

function baseDetails<T>(
  value: T,
  flagKey: string,
  reasonCode: ReasonCode,
  configurationVersion?: number,
): EvaluationDetails<T> {
  return configurationVersion === undefined
    ? { value, flagKey, reasonCode }
    : { value, flagKey, reasonCode, configurationVersion };
}

function prepare<T, F extends Flag>(
  options: EvaluationOptions<T>,
  isExpectedType: (flag: Flag) => flag is F,
):
  { configuration: Configuration; flag: F } | { result: EvaluationDetails<T> } {
  let configuration: Configuration;
  try {
    configuration = parseConfiguration(options.configuration);
  } catch (error) {
    if (!(error instanceof ContractValidationError)) throw error;
    return {
      result: baseDetails(
        options.fallbackValue,
        options.flagKey,
        "FALLBACK_INVALID_CONFIGURATION",
      ),
    };
  }

  const flag = configuration.flags.find(
    (candidate) => candidate.key === options.flagKey,
  );
  if (!flag) {
    return {
      result: baseDetails(
        options.fallbackValue,
        options.flagKey,
        "FALLBACK_FLAG_NOT_FOUND",
        configuration.configurationVersion,
      ),
    };
  }
  if (!isExpectedType(flag)) {
    return {
      result: baseDetails(
        options.fallbackValue,
        options.flagKey,
        "FALLBACK_FLAG_TYPE_MISMATCH",
        configuration.configurationVersion,
      ),
    };
  }

  return { configuration, flag };
}

function validContext(input: unknown): EvaluationContext | undefined {
  try {
    return parseEvaluationContext(input);
  } catch (error) {
    if (!(error instanceof ContractValidationError)) throw error;
    return undefined;
  }
}

function variantValue(flag: MultivariateFlag, variantKey: string): string {
  const variant = flag.variants.find(
    (candidate) => candidate.key === variantKey,
  );
  if (!variant) {
    throw new Error(
      `Validated flag ${flag.key} is missing variant ${variantKey}`,
    );
  }
  return variant.value;
}

function isStale(configuration: Configuration, now: Date): boolean {
  return now.getTime() >= Date.parse(configuration.expiresAt);
}

export function evaluateBoolean(
  options: EvaluationOptions<boolean>,
): EvaluationDetails<boolean> {
  const prepared = prepare(
    options,
    (flag): flag is BooleanFlag => flag.type === "boolean",
  );
  if ("result" in prepared) return prepared.result;

  const { configuration, flag } = prepared;
  const context = validContext(options.context);
  if (!context) {
    return baseDetails(
      flag.defaultValue,
      flag.key,
      "DEFAULT_INVALID_CONTEXT",
      configuration.configurationVersion,
    );
  }
  if (isStale(configuration, options.now ?? new Date())) {
    return baseDetails(
      flag.defaultValue,
      flag.key,
      "DEFAULT_STALE_CONFIGURATION",
      configuration.configurationVersion,
    );
  }

  for (const rule of flag.rules) {
    if (matchesRule(context, rule)) {
      return {
        ...baseDetails(
          rule.serve,
          flag.key,
          "TARGETING_MATCH",
          configuration.configurationVersion,
        ),
        ruleId: rule.id,
      };
    }
  }

  if (flag.rollout) {
    const value = bucketValue(context, flag.rollout.bucketBy);
    if (value === undefined) {
      return baseDetails(
        flag.defaultValue,
        flag.key,
        "DEFAULT_MISSING_BUCKET_ATTRIBUTE",
        configuration.configurationVersion,
      );
    }
    const bucket = assignmentBucket({
      flagKey: flag.key,
      salt: flag.rollout.salt,
      value,
    });
    const allocation = selectAllocation(flag.rollout.allocations, bucket);
    return {
      ...baseDetails(
        allocation.serve,
        flag.key,
        "PERCENTAGE_MATCH",
        configuration.configurationVersion,
      ),
      rolloutId: flag.rollout.id,
      bucket,
    };
  }

  return baseDetails(
    flag.defaultValue,
    flag.key,
    "DEFAULT_NO_MATCH",
    configuration.configurationVersion,
  );
}

export function evaluateMultivariate(
  options: EvaluationOptions<string>,
): EvaluationDetails<string> {
  const prepared = prepare(
    options,
    (flag): flag is MultivariateFlag => flag.type === "multivariate",
  );
  if ("result" in prepared) return prepared.result;

  const { configuration, flag } = prepared;
  const defaultVariant = flag.defaultVariant;
  const context = validContext(options.context);
  if (!context) {
    return {
      ...baseDetails(
        variantValue(flag, defaultVariant),
        flag.key,
        "DEFAULT_INVALID_CONTEXT",
        configuration.configurationVersion,
      ),
      variantKey: defaultVariant,
    };
  }
  if (isStale(configuration, options.now ?? new Date())) {
    return {
      ...baseDetails(
        variantValue(flag, defaultVariant),
        flag.key,
        "DEFAULT_STALE_CONFIGURATION",
        configuration.configurationVersion,
      ),
      variantKey: defaultVariant,
    };
  }

  for (const rule of flag.rules) {
    if (matchesRule(context, rule)) {
      return {
        ...baseDetails(
          variantValue(flag, rule.serve),
          flag.key,
          "TARGETING_MATCH",
          configuration.configurationVersion,
        ),
        ruleId: rule.id,
        variantKey: rule.serve,
      };
    }
  }

  if (flag.rollout) {
    const value = bucketValue(context, flag.rollout.bucketBy);
    if (value === undefined) {
      return {
        ...baseDetails(
          variantValue(flag, defaultVariant),
          flag.key,
          "DEFAULT_MISSING_BUCKET_ATTRIBUTE",
          configuration.configurationVersion,
        ),
        variantKey: defaultVariant,
      };
    }
    const bucket = assignmentBucket({
      flagKey: flag.key,
      salt: flag.rollout.salt,
      value,
    });
    const allocation = selectAllocation(flag.rollout.allocations, bucket);
    return {
      ...baseDetails(
        variantValue(flag, allocation.serve),
        flag.key,
        "PERCENTAGE_MATCH",
        configuration.configurationVersion,
      ),
      rolloutId: flag.rollout.id,
      bucket,
      variantKey: allocation.serve,
    };
  }

  return {
    ...baseDetails(
      variantValue(flag, defaultVariant),
      flag.key,
      "DEFAULT_NO_MATCH",
      configuration.configurationVersion,
    ),
    variantKey: defaultVariant,
  };
}
