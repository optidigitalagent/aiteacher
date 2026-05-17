// ── Partial Validator ─────────────────────────────────────────────────────────
// Word-overlap scoring for partial correctness.
// Score 30–89 → isPartiallyCorrect true; allowProgression always false.

import { normalize } from './normalizer.js'
import type { ValidationMistake } from './types.js'

export interface PartialValidationResult {
  isPartiallyCorrect: boolean
  score: number  // 0–100
  overlapRatio: number
  mistakes: ValidationMistake[]
}

export function computePartialScore(
  studentAnswer: string,
  expectedAnswer: string,
): PartialValidationResult {
  const studentNorm  = normalize(studentAnswer)
  const expectedNorm = normalize(expectedAnswer)

  if (!studentNorm || !expectedNorm) {
    return { isPartiallyCorrect: false, score: 0, overlapRatio: 0, mistakes: [] }
  }

  const studentWords  = new Set(studentNorm.split(' ').filter(Boolean))
  const expectedWords = expectedNorm.split(' ').filter(Boolean)

  if (expectedWords.length === 0) {
    return { isPartiallyCorrect: false, score: 0, overlapRatio: 0, mistakes: [] }
  }

  const matchedWords  = expectedWords.filter(w => studentWords.has(w))
  const overlapRatio  = matchedWords.length / expectedWords.length
  const score         = Math.round(overlapRatio * 100)

  const mistakes: ValidationMistake[] = []
  const missingWords = expectedWords.filter(w => !studentWords.has(w))
  if (missingWords.length > 0) {
    mistakes.push({
      type:     'incomplete',
      message:  `Your answer is missing: ${missingWords.slice(0, 3).join(', ')}`,
      expected: expectedAnswer,
      actual:   studentAnswer,
    })
  }

  // Partial: meaningful overlap but not complete (30–89%)
  const isPartiallyCorrect = score >= 30 && score < 100

  return { isPartiallyCorrect, score, overlapRatio, mistakes }
}
