// ── Validation Hooks ──────────────────────────────────────────────────────────
// Adapter: StepSpec + retryCount → ValidationInput → ValidationResult → EngineValidationResult.
// ValidationService owns all correctness decisions.
// GPT never makes pass/fail decisions — it only speaks based on the result.

import type { StepSpec, EngineValidationResult } from './types.js'
import type { ValidationMode as EngineValidationMode } from './types.js'
import { validationService } from '../validation/index.js'
import type { ValidationInput, ValidationMode } from '../validation/types.js'

// ── Map engine validation mode to new ValidationMode ─────────────────────────

function mapMode(engineMode: EngineValidationMode): ValidationMode {
  switch (engineMode) {
    case 'exact':
    case 'prefix_match':
    case 'contains':
      return 'strict'
    case 'soft_ai':
    case 'any_response':
    case 'not_applicable':
      return 'open_ended'
    default:
      return 'flexible'
  }
}

// ── Map engine validation mode to exercise type ───────────────────────────────

function mapExerciseType(engineMode: EngineValidationMode): string {
  switch (engineMode) {
    case 'exact':       return 'fill_in_the_gap'
    case 'prefix_match':
    case 'contains':    return 'grammar_drill'
    case 'soft_ai':     return 'translation'
    case 'any_response':return 'discussion'
    case 'not_applicable': return 'discussion'
    default:            return 'fill_in_the_gap'
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function validateStep(
  step: StepSpec,
  studentAnswer: string,
  retryCount: number,
): Promise<EngineValidationResult> {
  const rule       = step.validationRule
  const maxRetries = rule.maxRetries ?? 3

  // Auto-skip: always pass, no ValidationService call needed
  if (rule.mode === 'not_applicable') {
    return {
      correct:            true,
      score:              1.0,
      feedback:           'Exercise skipped.',
      hintsRemaining:     0,
      shouldRevealAnswer: false,
      correctAnswer:      '',
      allowProgression:   true,
      feedbackCode:       'CORRECT',
    }
  }

  const input: ValidationInput = {
    sessionId:       'engine',
    userId:          'engine',
    exerciseId:      step.stepId.split('_step_')[0] ?? step.stepId,
    exerciseType:    mapExerciseType(rule.mode),
    stepId:          step.stepId,
    studentAnswer,
    expectedAnswer:  step.expectedAnswer ?? '',
    acceptedAnswers: rule.allowedVariants ?? [],
    validationMode:  mapMode(rule.mode),
    inputMode:       'text',
    metadata:        {},
  }

  const result = validationService.validate(input)

  // Max retries exceeded → reveal answer and force-advance
  const shouldReveal = !result.isCorrect && retryCount >= maxRetries
  if (shouldReveal) {
    return {
      correct:            true,
      score:              0.0,
      feedback:           `The answer is "${step.expectedAnswer}". Let's keep going.`,
      hintsRemaining:     0,
      shouldRevealAnswer: true,
      correctAnswer:      step.expectedAnswer,
      allowProgression:   true,
      feedbackCode:       'INCORRECT',
    }
  }

  // Build human-readable feedback string for Teacher Brain
  const feedback = buildFeedback(result.isCorrect, result.isPartiallyCorrect ?? false, result.feedbackCode ?? 'INCORRECT', result.mistakes[0]?.message, step, retryCount)

  const hintsRemaining = Math.max(0, maxRetries - retryCount - 1)

  return {
    correct:            result.isCorrect,
    score:              result.score / 100,
    feedback,
    hintsRemaining,
    shouldRevealAnswer: false,
    correctAnswer:      step.expectedAnswer,
    allowProgression:   result.allowProgression,
    feedbackCode:       result.feedbackCode,
    isPartiallyCorrect: result.isPartiallyCorrect,
  }
}

// ── Feedback string builder ───────────────────────────────────────────────────

function buildFeedback(
  isCorrect: boolean,
  isPartiallyCorrect: boolean,
  feedbackCode: string,
  mistakeMessage: string | undefined,
  step: StepSpec,
  retryCount: number,
): string {
  if (isCorrect) {
    return feedbackCode === 'ACCEPTABLE_STT' ? 'Good — I understood you!' : 'Exactly right!'
  }

  if (isPartiallyCorrect && mistakeMessage) {
    return `Almost! ${mistakeMessage}`
  }

  // Use progressive hints from StepSpec
  const hintsUsed = Math.min(retryCount, step.hints.length)
  if (hintsUsed > 0 && step.hints[hintsUsed - 1]) {
    return step.hints[hintsUsed - 1]!
  }

  if (step.expectedAnswer) {
    return `Not quite — think about the answer again.`
  }

  return 'Try again.'
}
