export {
  serializeConfiguration,
  serializeConfigurationV2,
} from "./canonical.js";
export { prepareSnapshot, type EvaluationSnapshot } from "./snapshot.js";
export {
  evaluateBoolean,
  evaluateMultivariate,
  reasonCodes,
  type EvaluationDetails,
  type EvaluationOptions,
  type ReasonCode,
} from "./evaluate.js";
export {
  assignmentBucket,
  BUCKET_COUNT,
  selectAllocation,
  type AssignmentInput,
} from "./hash.js";
export {
  BooleanFlagSchema,
  ConfigurationSchema,
  ConfigurationV2Schema,
  EvaluationContextSchema,
  FlagSchema,
  MultivariateFlagSchema,
  type AttributeValue,
  type BooleanFlag,
  type Configuration,
  type ConfigurationV2,
  type EvaluationContext,
  type Flag,
  type MultivariateFlag,
} from "./model.js";
export {
  ContractValidationError,
  parseConfiguration,
  parseConfigurationV2,
  parseEvaluationContext,
} from "./validation.js";
