// ── Open-Ended Validator ──────────────────────────────────────────────────────
// For exercises where deterministic validation cannot decide full correctness.
// Backend always produces the final ValidationResult.
// AI may provide natural language feedback but CANNOT set allowProgression.
// Cost-safe: no AI call in this module. Returns OPEN_ENDED_REVIEW_REQUIRED as signal.

import { normalize } from './normalizer.js'
import type { ValidationInput, ValidationResult } from './types.js'

export function validateOpenEnded(input: ValidationInput): ValidationResult {
  const { studentAnswer } = input
  const trimmed     = studentAnswer.trim()
  const normStudent = normalize(trimmed)

  // Empty or too short — block progression
  if (normStudent.length < 2) {
    return {
      isCorrect:               false,
      isPartiallyCorrect:      false,
      score:                   0,
      allowProgression:        false,
      normalizedStudentAnswer: normStudent,
      normalizedExpectedAnswer: '',
      mistakes: [{
        type:    'incomplete',
        message: 'Please provide an answer to continue.',
        actual:  studentAnswer,
      }],
      feedbackCode: 'INCORRECT',
    }
  }

  // Has content — accept as open-ended participation
  // feedbackCode signals to Teacher Brain that it may provide natural feedback
  // allowProgression is set by backend here, never by AI
  return {
    isCorrect:               true,
    isPartiallyCorrect:      false,
    score:                   70,
    allowProgression:        true,
    normalizedStudentAnswer: normStudent,
    normalizedExpectedAnswer: '',
    mistakes:                [],
    feedbackCode:            'OPEN_ENDED_REVIEW_REQUIRED',
    teacherExplanationData: {
      stepId:            input.stepId,
      exerciseType:      input.exerciseType,
      studentAnswerRaw:  trimmed,
    },
  }
}
