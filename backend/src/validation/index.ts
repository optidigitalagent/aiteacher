// ── Validation Module — Public Exports ───────────────────────────────────────
// Import from this file only.

export { validationService, ValidationService } from './validation-service.js'
export { normalize, normalizeForVoice, normalizeStrict } from './normalizer.js'
export { validateExact } from './exact-validator.js'
export { validateContains, validatePrefix, analyzeSentenceMistakes } from './flexible-validator.js'
export { checkSTTTolerance } from './stt-tolerance.js'
export { computePartialScore } from './partial-validator.js'
export { validateByExerciseType } from './exercise-type-validator.js'
export { validateOpenEnded } from './open-ended-validator.js'

export type {
  ValidationInput,
  ValidationResult,
  ValidationMistake,
  FeedbackCode,
  ValidationMode,
  InputMode,
  MistakeType,
} from './types.js'
