// ── Flexible Validator ────────────────────────────────────────────────────────
// Contains / prefix matching and pragmatic sentence-transformation mistake analysis.
// Does not build a full grammar engine — keeps it simple and bounded.

import { normalize } from './normalizer.js'
import type { ValidationMistake } from './types.js'

export interface ContainsResult {
  isCorrect: boolean
  matchedAnswer?: string
}

export function validateContains(
  studentAnswer: string,
  expectedAnswer: string,
  acceptedAnswers: string[] = [],
): ContainsResult {
  const studentNorm  = normalize(studentAnswer)
  const expectedNorm = normalize(expectedAnswer)

  if (studentNorm.includes(expectedNorm)) {
    return { isCorrect: true, matchedAnswer: expectedAnswer }
  }

  for (const alt of acceptedAnswers) {
    const altNorm = normalize(alt)
    if (studentNorm.includes(altNorm)) {
      return { isCorrect: true, matchedAnswer: alt }
    }
  }

  return { isCorrect: false }
}

export function validatePrefix(
  studentAnswer: string,
  expectedAnswer: string,
  acceptedAnswers: string[] = [],
): ContainsResult {
  const studentNorm  = normalize(studentAnswer)
  const expectedNorm = normalize(expectedAnswer)

  if (studentNorm.startsWith(expectedNorm) || studentNorm === expectedNorm) {
    return { isCorrect: true, matchedAnswer: expectedAnswer }
  }

  for (const alt of acceptedAnswers) {
    const altNorm = normalize(alt)
    if (studentNorm.startsWith(altNorm) || studentNorm === altNorm) {
      return { isCorrect: true, matchedAnswer: alt }
    }
  }

  return { isCorrect: false }
}

// ── Sentence transformation mistake analysis ──────────────────────────────────
// Pragmatic: detect missing/extra words, wrong order, missing auxiliaries.
// Maximum 4 mistakes returned to avoid overwhelming the teacher feedback.

const AUXILIARIES = new Set([
  'do', 'does', 'did', 'have', 'has', 'had',
  'is', 'are', 'was', 'were', 'will', 'would',
  'can', 'could', 'should', 'must', 'may', 'might',
])

export function analyzeSentenceMistakes(
  studentAnswer: string,
  expectedAnswer: string,
): ValidationMistake[] {
  const mistakes: ValidationMistake[] = []

  const studentNorm  = normalize(studentAnswer)
  const expectedNorm = normalize(expectedAnswer)

  const studentWords  = studentNorm.split(' ').filter(Boolean)
  const expectedWords = expectedNorm.split(' ').filter(Boolean)

  const studentSet  = new Set(studentWords)
  const expectedSet = new Set(expectedWords)

  // Missing expected words
  for (const word of expectedWords) {
    if (!studentSet.has(word) && mistakes.length < 4) {
      const mistakeType: 'grammar' | 'missing_word' = AUXILIARIES.has(word) ? 'grammar' : 'missing_word'
      const message = AUXILIARIES.has(word)
        ? `Missing auxiliary verb: "${word}"`
        : `Missing word: "${word}"`
      mistakes.push({ type: mistakeType, message, expected: word })
    }
  }

  // Extra words in student answer
  for (const word of studentWords) {
    if (!expectedSet.has(word) && mistakes.length < 4) {
      mistakes.push({ type: 'extra_word', message: `Unexpected word: "${word}"`, actual: word })
    }
  }

  // Word order issue: all words present but in wrong order
  if (mistakes.length === 0 && studentNorm !== expectedNorm) {
    const sameWords = expectedWords.every(w => studentSet.has(w)) &&
                      studentWords.every(w => expectedSet.has(w))
    if (sameWords) {
      mistakes.push({
        type: 'word_order',
        message: 'The words are right but in the wrong order.',
        expected: expectedAnswer,
        actual: studentAnswer,
      })
    }
  }

  return mistakes.slice(0, 4)
}
