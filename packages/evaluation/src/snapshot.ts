import { parseConfigurationV2 } from "./validation.js";
import {
  evaluateBooleanFlag,
  evaluateMultivariateFlag,
  type EvaluationDetails,
} from "./evaluate.js";

function freeze(value: object): void {
  const children: unknown[] = Object.values(value);
  for (const child of children)
    if (child && typeof child === "object") freeze(child);
  Object.freeze(value);
}

export function prepareSnapshot(input: unknown) {
  const configuration = structuredClone(parseConfigurationV2(input));
  freeze(configuration);
  const flags = new Map(configuration.flags.map((flag) => [flag.key, flag]));
  function fallback<T>(
    key: string,
    value: T,
    wrongType: boolean,
  ): EvaluationDetails<T> {
    return {
      flagKey: key,
      value,
      configurationVersion: configuration.configurationVersion,
      reasonCode: wrongType
        ? "FALLBACK_FLAG_TYPE_MISMATCH"
        : "FALLBACK_FLAG_NOT_FOUND",
    };
  }
  return Object.freeze({
    configuration,
    boolean(
      key: string,
      context: unknown,
      fallbackValue: boolean,
      stale = false,
    ): EvaluationDetails<boolean> {
      const flag = flags.get(key);
      return flag?.type === "boolean"
        ? evaluateBooleanFlag(
            flag,
            context,
            configuration.configurationVersion,
            stale,
          )
        : fallback(key, fallbackValue, flag !== undefined);
    },
    multivariate(
      key: string,
      context: unknown,
      fallbackValue: string,
      stale = false,
    ): EvaluationDetails<string> {
      const flag = flags.get(key);
      return flag?.type === "multivariate"
        ? evaluateMultivariateFlag(
            flag,
            context,
            configuration.configurationVersion,
            stale,
          )
        : fallback(key, fallbackValue, flag !== undefined);
    },
  });
}
export type EvaluationSnapshot = ReturnType<typeof prepareSnapshot>;
