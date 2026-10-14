import { readFileSync } from "node:fs";
import { evaluateBoolean } from "../packages/evaluation/dist/index.js";

const { configurations } = JSON.parse(
  readFileSync(
    new URL("../conformance/v1/evaluation.json", import.meta.url),
    "utf8",
  ),
);
console.log(
  evaluateBoolean({
    configuration: configurations.standard,
    flagKey: "ordered-rule",
    context: {
      schemaVersion: "evaluation-context-v1",
      attributes: { region: "BR", plan: "pro" },
    },
    fallbackValue: false,
    now: new Date("2026-01-01T00:00:00.000Z"),
  }),
);
