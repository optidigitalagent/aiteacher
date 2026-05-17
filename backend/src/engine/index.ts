// ── Exercise Engine — Public Exports ─────────────────────────────────────────
// Import from this file only. Never import from sub-modules directly.

export { exerciseEngine, ExerciseEngine } from './exercise-engine.js'

export type {
  ExerciseSpec,
  ExerciseType,
  StepSpec,
  ValidationRule,
  ValidationMode,
  ProgressionCondition,
  EngineExerciseState,
  EngineLessonState,
  EngineValidationResult,
  EngineResult,
  EngineAction,
  AnswerSubmission,
  ExerciseMeta,
  StepAttempt,
  ExerciseStatus,
  TransitionContext,
} from './types.js'

export {
  loadExercisesForSection,
  filterAvailableExercises,
  loadFreeModePlaceholder,
} from './exercise-loader.js'

export {
  parseManifestEntry,
} from './exercise-parser.js'

export {
  validateStep,
} from './validation-hooks.js'

export {
  formatCursor,
  buildPromptContext,
} from './frontend-formatter.js'

export {
  initExerciseState,
  advanceStep,
  skipExercise,
  recordAttempt,
  getCurrentStep,
  isExerciseComplete,
  getExerciseStats,
} from './step-progression-manager.js'

export {
  findNextExercise,
  resolveEngineAction,
  isLessonComplete,
  shouldAutoSkip,
  canStartExercise,
  resolveCompletedExerciseNumbers,
} from './exercise-transitions.js'

export {
  loadEngineState,
  saveEngineState,
  deleteEngineState,
  engineStateKey,
} from './exercise-sync.js'

export {
  recoverEngineState,
  validateRecoveredState,
} from './exercise-recovery.js'
