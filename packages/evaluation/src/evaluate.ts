import type {
  BooleanFlag,
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
type Decision = {
  serve: boolean | string;
  reasonCode: ReasonCode;
  ruleId?: string;
  rolloutId?: string;
  bucket?: number;
};

function decide(flag: Flag, input: unknown, stale: boolean): Decision {
  const defaultServe =
    flag.type === "boolean" ? flag.defaultValue : flag.defaultVariant;
  let context: EvaluationContext;
  try {
    context = parseEvaluationContext(input);
  } catch (error) {
    if (!(error instanceof ContractValidationError)) throw error;
    return { serve: defaultServe, reasonCode: "DEFAULT_INVALID_CONTEXT" };
  }
  if (stale)
    return { serve: defaultServe, reasonCode: "DEFAULT_STALE_CONFIGURATION" };
  for (const rule of flag.rules) {
    if (
      rule.conditions.every((condition) => {
        const attributes = context.attributes;
        if (!attributes || !Object.hasOwn(attributes, condition.attribute))
          return false;
        const actual = attributes[condition.attribute];
        if (typeof actual !== typeof condition.value) return false;
        return condition.operator === "equals"
          ? actual === condition.value
          : actual !== condition.value;
      })
    )
      return {
        serve: rule.serve,
        reasonCode: "TARGETING_MATCH",
        ruleId: rule.id,
      };
  }
  if (!flag.rollout)
    return { serve: defaultServe, reasonCode: "DEFAULT_NO_MATCH" };
  const rollout = flag.rollout;
  const value =
    rollout.bucketBy === "targetingKey"
      ? context.targetingKey
      : context.attributes &&
          Object.hasOwn(context.attributes, rollout.bucketBy)
        ? context.attributes[rollout.bucketBy]
        : undefined;
  if (value === undefined)
    return {
      serve: defaultServe,
      reasonCode: "DEFAULT_MISSING_BUCKET_ATTRIBUTE",
    };
  const bucket = assignmentBucket({
    flagKey: flag.key,
    salt: rollout.salt,
    value,
  });
  const allocations: readonly { serve: boolean | string; weight: number }[] =
    rollout.allocations;
  return {
    serve: selectAllocation(allocations, bucket).serve,
    reasonCode: "PERCENTAGE_MATCH",
    rolloutId: rollout.id,
    bucket,
  };
}

export function evaluateBooleanFlag(
  flag: BooleanFlag,
  context: unknown,
  version: number,
  stale = false,
): EvaluationDetails<boolean> {
  const { serve, ...details } = decide(flag, context, stale);
  if (typeof serve !== "boolean")
    throw new Error("Invalid validated boolean decision");
  return {
    value: serve,
    flagKey: flag.key,
    configurationVersion: version,
    ...details,
  };
}

export function evaluateMultivariateFlag(
  flag: MultivariateFlag,
  context: unknown,
  version: number,
  stale = false,
): EvaluationDetails<string> {
  const { serve, ...details } = decide(flag, context, stale);
  const variant = flag.variants.find((candidate) => candidate.key === serve);
  if (!variant) throw new Error("Invalid validated variant decision");
  return {
    value: variant.value,
    variantKey: variant.key,
    flagKey: flag.key,
    configurationVersion: version,
    ...details,
  };
}

function evaluate<T, F extends Flag>(
  options: EvaluationOptions<T>,
  matches: (flag: Flag) => flag is F,
  evaluator: (
    flag: F,
    context: unknown,
    version: number,
    stale: boolean,
  ) => EvaluationDetails<T>,
): EvaluationDetails<T> {
  let configuration;
  try {
    configuration = parseConfiguration(options.configuration);
  } catch (error) {
    if (!(error instanceof ContractValidationError)) throw error;
    return {
      value: options.fallbackValue,
      flagKey: options.flagKey,
      reasonCode: "FALLBACK_INVALID_CONFIGURATION",
    };
  }
  const flag = configuration.flags.find(
    (candidate) => candidate.key === options.flagKey,
  );
  if (!flag || !matches(flag))
    return {
      value: options.fallbackValue,
      flagKey: options.flagKey,
      configurationVersion: configuration.configurationVersion,
      reasonCode: flag
        ? "FALLBACK_FLAG_TYPE_MISMATCH"
        : "FALLBACK_FLAG_NOT_FOUND",
    };
  const now = (options.now ?? new Date()).getTime();
  return evaluator(
    flag,
    options.context,
    configuration.configurationVersion,
    !Number.isFinite(now) || now >= Date.parse(configuration.expiresAt),
  );
}

export function evaluateBoolean(
  options: EvaluationOptions<boolean>,
): EvaluationDetails<boolean> {
  return evaluate(
    options,
    (flag): flag is BooleanFlag => flag.type === "boolean",
    evaluateBooleanFlag,
  );
}
export function evaluateMultivariate(
  options: EvaluationOptions<string>,
): EvaluationDetails<string> {
  return evaluate(
    options,
    (flag): flag is MultivariateFlag => flag.type === "multivariate",
    evaluateMultivariateFlag,
  );
}
