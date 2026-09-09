import { canonicalize } from "json-canonicalize";

import type { Configuration } from "./model.js";
import { parseConfiguration } from "./validation.js";

/** Validates and serializes configuration using RFC 8785 JSON Canonicalization Scheme. */
export function serializeConfiguration(input: unknown): string {
  const configuration: Configuration = parseConfiguration(input);
  return canonicalize(configuration);
}

export function serializeHashTuple(values: readonly unknown[]): string {
  return canonicalize(values);
}
