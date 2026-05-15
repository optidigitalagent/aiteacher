// Exercise Protocols — public API
// Source of truth for exercise type policy, classification, and validation.

export type {
  SupportStatus,
  RuntimeMode,
  ValidationMode,
  ProgressionMode,
  DowngradeStrategy,
  VoiceFriendliness,
  TeacherBehavior,
  ExercisePolicy,
  SnapshotValidationResult,
} from './exercise-protocols.js'

export {
  SUPPORTED_EXERCISE_TYPES,
  POSTPONED_EXERCISE_TYPES,
  ALL_EXERCISE_TYPES,
  EXERCISE_TYPE_ALIASES,
} from './supported-exercise-types.js'

export type {
  SupportedExerciseType,
  PostponedExerciseType,
  CanonicalExerciseType,
} from './supported-exercise-types.js'

export { EXERCISE_POLICY_MAP } from './exercise-policy.js'

export {
  normalizeExerciseType,
  inferExerciseTypeFromInstruction,
  getExercisePolicy,
  isExerciseAllowedInCurrentRuntime,
  shouldDowngradeExercise,
  getDowngradeStrategy,
  validateExerciseSnapshotShape,
} from './exercise-type-classifier.js'

export {
  validateSnapshotShape,
  validateSnapshotShapeBatch,
} from './snapshot-validation.js'
