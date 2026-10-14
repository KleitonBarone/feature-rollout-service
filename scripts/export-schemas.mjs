import { writeFile, mkdir } from "node:fs/promises";
import {
  ConfigurationSchema,
  ConfigurationV2Schema,
  EvaluationContextSchema,
} from "../packages/evaluation/dist/index.js";
await mkdir("docs/schemas", { recursive: true });
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
    `docs/schemas/${name}.json`,
    JSON.stringify(plain, null, 2) + "\n",
  );
}
