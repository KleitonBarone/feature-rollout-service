import { Type, type Static } from "@sinclair/typebox";

const IdentifierSchema = Type.String({ minLength: 1, maxLength: 128 });
const CanonicalTimestampSchema = Type.String({
  pattern:
    "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$",
});
const AttributeValueSchema = Type.Union([
  Type.String(),
  Type.Number({ finite: true }),
  Type.Boolean(),
]);

export const EvaluationContextSchema = Type.Object(
  {
    schemaVersion: Type.Literal("evaluation-context-v1"),
    targetingKey: Type.Optional(Type.String({ minLength: 1 })),
    attributes: Type.Optional(
      Type.Record(IdentifierSchema, AttributeValueSchema),
    ),
  },
  { additionalProperties: false, $id: "EvaluationContextV1" },
);

export type EvaluationContext = Static<typeof EvaluationContextSchema>;
export type AttributeValue = Static<typeof AttributeValueSchema>;

const ConditionSchema = Type.Object(
  {
    attribute: IdentifierSchema,
    operator: Type.Union([Type.Literal("equals"), Type.Literal("not-equals")]),
    value: AttributeValueSchema,
  },
  { additionalProperties: false },
);

const BooleanRuleSchema = Type.Object(
  {
    id: IdentifierSchema,
    conditions: Type.Array(ConditionSchema, { minItems: 1 }),
    serve: Type.Boolean(),
  },
  { additionalProperties: false },
);

const MultivariateRuleSchema = Type.Object(
  {
    id: IdentifierSchema,
    conditions: Type.Array(ConditionSchema, { minItems: 1 }),
    serve: IdentifierSchema,
  },
  { additionalProperties: false },
);

const BooleanAllocationSchema = Type.Object(
  {
    serve: Type.Boolean(),
    weight: Type.Integer({ minimum: 1, maximum: 100_000 }),
  },
  { additionalProperties: false },
);

const MultivariateAllocationSchema = Type.Object(
  {
    serve: IdentifierSchema,
    weight: Type.Integer({ minimum: 1, maximum: 100_000 }),
  },
  { additionalProperties: false },
);

const BooleanRolloutSchema = Type.Object(
  {
    id: IdentifierSchema,
    bucketBy: IdentifierSchema,
    salt: Type.String({ minLength: 1 }),
    allocations: Type.Array(BooleanAllocationSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

const MultivariateRolloutSchema = Type.Object(
  {
    id: IdentifierSchema,
    bucketBy: IdentifierSchema,
    salt: Type.String({ minLength: 1 }),
    allocations: Type.Array(MultivariateAllocationSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

export const BooleanFlagSchema = Type.Object(
  {
    key: IdentifierSchema,
    type: Type.Literal("boolean"),
    defaultValue: Type.Boolean(),
    rules: Type.Array(BooleanRuleSchema),
    rollout: Type.Optional(BooleanRolloutSchema),
  },
  { additionalProperties: false, $id: "BooleanFlagV1" },
);

const VariantSchema = Type.Object(
  {
    key: IdentifierSchema,
    value: Type.String(),
  },
  { additionalProperties: false },
);

export const MultivariateFlagSchema = Type.Object(
  {
    key: IdentifierSchema,
    type: Type.Literal("multivariate"),
    variants: Type.Array(VariantSchema, { minItems: 1 }),
    defaultVariant: IdentifierSchema,
    rules: Type.Array(MultivariateRuleSchema),
    rollout: Type.Optional(MultivariateRolloutSchema),
  },
  { additionalProperties: false, $id: "MultivariateFlagV1" },
);

export const FlagSchema = Type.Union(
  [BooleanFlagSchema, MultivariateFlagSchema],
  {
    $id: "FlagV1",
  },
);

export const ConfigurationSchema = Type.Object(
  {
    schemaVersion: Type.Literal("configuration-v1"),
    configurationVersion: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    environment: IdentifierSchema,
    generatedAt: CanonicalTimestampSchema,
    expiresAt: CanonicalTimestampSchema,
    flags: Type.Array(FlagSchema),
  },
  { additionalProperties: false, $id: "ConfigurationV1" },
);

export type BooleanFlag = Static<typeof BooleanFlagSchema>;
export type MultivariateFlag = Static<typeof MultivariateFlagSchema>;
export type Flag = Static<typeof FlagSchema>;
export type Configuration = Static<typeof ConfigurationSchema>;
export const ConfigurationV2Schema = Type.Composite(
  [
    Type.Omit(ConfigurationSchema, ["schemaVersion", "expiresAt"]),
    Type.Object({ schemaVersion: Type.Literal("configuration-v2") }),
  ],
  { additionalProperties: false, $id: "ConfigurationV2" },
);
export type ConfigurationV2 = Static<typeof ConfigurationV2Schema>;
export type BooleanAllocation = NonNullable<
  BooleanFlag["rollout"]
>["allocations"][number];
export type MultivariateAllocation = NonNullable<
  MultivariateFlag["rollout"]
>["allocations"][number];
