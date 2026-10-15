import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { format } from "prettier";
import {
  ConfigurationSchema,
  ConfigurationV2Schema,
  EvaluationContextSchema,
} from "../packages/evaluation/dist/index.js";
const output = process.argv[2] ?? "docs/schemas";
await mkdir(output, { recursive: true });
for (const [name, schema] of Object.entries({
  "configuration-v1": ConfigurationSchema,
  "configuration-v2": ConfigurationV2Schema,
  "evaluation-context-v1": EvaluationContextSchema,
})) {
  const plain = JSON.parse(JSON.stringify(schema));
  function visit(value) {
    if (!value || typeof value !== "object") return;
    delete value.$id;
    delete value.finite;
    for (const child of Object.values(value)) visit(child);
  }
  visit(plain);
  plain.$schema = "http://json-schema.org/draft-07/schema#";
  plain.$id = `urn:feature-rollout:${name}`;
  await writeFile(
    join(output, `${name}.json`),
    await format(JSON.stringify(plain), { parser: "json" }),
  );
}
