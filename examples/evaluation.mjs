import { readFileSync } from "node:fs";
import { prepareSnapshot } from "../packages/evaluation/dist/index.js";

const { configuration } = JSON.parse(
  readFileSync(
    new URL("../conformance/v2/evaluation.json", import.meta.url),
    "utf8",
  ),
);
console.log(
  prepareSnapshot(configuration).boolean(
    "conjunction",
    {
      schemaVersion: "evaluation-context-v1",
      attributes: { region: "BR", plan: "pro" },
    },
    false,
    false,
  ),
);
