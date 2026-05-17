// ── Exact Validator ───────────────────────────────────────────────────────────
// Normalized exact-match comparison: student answer vs expected + alternatives.
// Returns isCorrect and which answer was matched.

import { normalize } from './normalizer.js'

export interface ExactMatchOptions {
  caseSensitive?: boolean
  stripPunctuation?: boolean
  acceptedAnswers?: string[]
  teacherBookAnswer?: string
}

export interface ExactMatchResult {
  isCorrect: boolean
  matchedAnswer?: string
  normalizedStudent: string
  normalizedExpected: string
}

export function validateExact(
  studentAnswer: string,
  expectedAnswer: string,
  options: ExactMatchOptions = {},
): ExactMatchResult {
  const normOpts = {
    lowercase:        !options.caseSensitive,
    stripPunctuation: options.stripPunctuation !== false,
  }

  const studentNorm  = normalize(studentAnswer, normOpts)
  const expectedNorm = normalize(expectedAnswer, normOpts)

  if (studentNorm === expectedNorm) {
    return { isCorrect: true, matchedAnswer: expectedAnswer, normalizedStudent: studentNorm, normalizedExpected: expectedNorm }
  }

  // Check accepted alternatives
  const alternatives: string[] = [
    ...(options.acceptedAnswers ?? []),
    ...(options.teacherBookAnswer ? [options.teacherBookAnswer] : []),
  ]

  for (const alt of alternatives) {
    const altNorm = normalize(alt, normOpts)
    if (studentNorm === altNorm) {
      return { isCorrect: true, matchedAnswer: alt, normalizedStudent: studentNorm, normalizedExpected: expectedNorm }
    }
  }

  return { isCorrect: false, normalizedStudent: studentNorm, normalizedExpected: expectedNorm }
}
