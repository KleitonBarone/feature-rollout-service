export { serializeConfiguration } from "./canonical.js";
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
  EvaluationContextSchema,
  FlagSchema,
  MultivariateFlagSchema,
  type AttributeValue,
  type BooleanFlag,
  type Configuration,
  type EvaluationContext,
  type Flag,
  type MultivariateFlag,
} from "./model.js";
export {
  ContractValidationError,
  parseConfiguration,
  parseEvaluationContext,
} from "./validation.js";
