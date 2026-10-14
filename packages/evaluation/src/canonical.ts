import { canonicalize } from "json-canonicalize";

import type { Configuration } from "./model.js";
import {
  assertJSON,
  parseConfiguration,
  parseConfigurationV2,
} from "./validation.js";

/** Validates and serializes configuration using RFC 8785 JSON Canonicalization Scheme. */
export function serializeConfiguration(input: unknown): string {
  const configuration: Configuration = parseConfiguration(input);
  return canonicalize(configuration);
}

export function serializeHashTuple(values: readonly unknown[]): string {
  assertJSON(values);
  return canonicalize(values);
}

export function serializeConfigurationV2(input: unknown): string {
  return canonicalize(parseConfigurationV2(input));
}
