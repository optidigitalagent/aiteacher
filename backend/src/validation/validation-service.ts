// ── Validation Service ────────────────────────────────────────────────────────
// Single entry point for all answer validation.
// GPT/Claude never calls this — only the backend engine calls it.
// Returns ValidationResult. allowProgression is set here only.

import { normalize } from './normalizer.js'
import { validateByExerciseType } from './exercise-type-validator.js'
import { validateOpenEnded } from './open-ended-validator.js'
import type { ValidationInput, ValidationResult } from './types.js'

// Exercise types that are always open-ended (any response acceptable)
const OPEN_ENDED_TYPES = new Set([
  'discussion',
  'personal_fill',
  'pair_speaking',
  'dialogue_practice',
  'pronunciation_practice',
  'reading_comprehension',
  'paragraph_reading',
])

// Exercise types that require teacher-book answer for correctness (soft AI path)
const SOFT_AI_TYPES = new Set([
  'translation',
])

export class ValidationService {

  validate(input: ValidationInput): ValidationResult {
    const { studentAnswer, expectedAnswer, acceptedAnswers, exerciseType, validationMode } = input

    // ── Edge case: empty / whitespace-only answer ─────────────────────────────
    const trimmed = studentAnswer.trim()
    if (!trimmed) {
      return {
        isCorrect:               false,
        isPartiallyCorrect:      false,
        score:                   0,
        allowProgression:        false,
        normalizedStudentAnswer: '',
        normalizedExpectedAnswer: normalize(expectedAnswer),
        mistakes: [{
          type:    'incomplete',
          message: 'No answer provided.',
          actual:  studentAnswer,
        }],
        feedbackCode: 'INCORRECT',
      }
    }

    // ── Edge case: open_ended mode explicitly set ─────────────────────────────
    if (validationMode === 'open_ended') {
      return validateOpenEnded(input)
    }

    // ── Edge case: open-ended exercise type ───────────────────────────────────
    if (OPEN_ENDED_TYPES.has(exerciseType)) {
      return validateOpenEnded(input)
    }

    // ── Edge case: soft AI exercise type (translation) ────────────────────────
    if (SOFT_AI_TYPES.has(exerciseType)) {
      // If exact expected answer provided, try exact match first (cheap path)
      if (expectedAnswer) {
        const normStudent  = normalize(trimmed)
        const normExpected = normalize(expectedAnswer)
        if (normStudent === normExpected) {
          return {
            isCorrect:               true,
            isPartiallyCorrect:      false,
            score:                   100,
            allowProgression:        true,
            normalizedStudentAnswer: normStudent,
            normalizedExpectedAnswer: normExpected,
            matchedAnswer:           expectedAnswer,
            mistakes:                [],
            feedbackCode:            'CORRECT',
          }
        }
      }
      // Fall through to open-ended
      return validateOpenEnded(input)
    }

    // ── Edge case: no expected answer and no accepted alternatives ─────────────
    if (!expectedAnswer && acceptedAnswers.length === 0 && !input.teacherBookAnswer) {
      return validateOpenEnded(input)
    }

    // ── Main path: route to exercise-type-specific deterministic validator ────
    return validateByExerciseType(input)
  }
}

export const validationService = new ValidationService()
