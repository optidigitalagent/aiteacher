// ── Exercise-Type Validator ───────────────────────────────────────────────────
// Routes validation by exercise type with type-appropriate strategies.
// All functions return ValidationResult — no AI calls in this module.

import { normalize } from './normalizer.js'
import { validateExact } from './exact-validator.js'
import { validateContains, validatePrefix, analyzeSentenceMistakes } from './flexible-validator.js'
import { checkSTTTolerance } from './stt-tolerance.js'
import { computePartialScore } from './partial-validator.js'
import type { ValidationInput, ValidationResult, FeedbackCode, ValidationMistake } from './types.js'

// ── Shared result builder ─────────────────────────────────────────────────────

interface BuildArgs {
  isCorrect: boolean
  isPartiallyCorrect?: boolean
  score: number
  allowProgression: boolean
  normStudent: string
  normExpected: string
  feedbackCode: FeedbackCode
  matchedAnswer?: string
  mistakes?: ValidationMistake[]
  recommendedHint?: string
}

function build(args: BuildArgs): ValidationResult {
  return {
    isCorrect:               args.isCorrect,
    isPartiallyCorrect:      args.isPartiallyCorrect ?? false,
    score:                   args.score,
    allowProgression:        args.allowProgression,
    normalizedStudentAnswer: args.normStudent,
    normalizedExpectedAnswer: args.normExpected,
    matchedAnswer:           args.matchedAnswer,
    mistakes:                args.mistakes ?? [],
    feedbackCode:            args.feedbackCode,
    recommendedHint:         args.recommendedHint,
  }
}

// ── Fill-in-gap / grammar focus fill ─────────────────────────────────────────

function validateFillInGap(input: ValidationInput): ValidationResult {
  const { studentAnswer, expectedAnswer, acceptedAnswers, teacherBookAnswer, inputMode, validationMode } = input
  const normStudent  = normalize(studentAnswer)
  const normExpected = normalize(expectedAnswer)
  const allAccepted  = [...acceptedAnswers, ...(teacherBookAnswer ? [teacherBookAnswer] : [])]

  // Voice: STT tolerance first
  if (inputMode === 'voice') {
    const stt = checkSTTTolerance(studentAnswer, expectedAnswer)
    if (stt.matched) {
      return build({ isCorrect: true, feedbackCode: 'ACCEPTABLE_STT', score: Math.round(stt.confidence * 100), allowProgression: true, normStudent, normExpected, matchedAnswer: expectedAnswer })
    }
    for (const alt of allAccepted) {
      const altStt = checkSTTTolerance(studentAnswer, alt)
      if (altStt.matched) {
        return build({ isCorrect: true, feedbackCode: 'ACCEPTABLE_STT', score: Math.round(altStt.confidence * 100), allowProgression: true, normStudent, normExpected: normalize(alt), matchedAnswer: alt })
      }
    }
  }

  // Exact match
  const exact = validateExact(studentAnswer, expectedAnswer, { caseSensitive: false, stripPunctuation: true, acceptedAnswers: allAccepted })
  if (exact.isCorrect) {
    return build({ isCorrect: true, feedbackCode: 'CORRECT', score: 100, allowProgression: true, normStudent, normExpected, matchedAnswer: exact.matchedAnswer })
  }

  // Beginner mode: allow partial overlap ≥70%
  if (validationMode === 'beginner') {
    const partial = computePartialScore(studentAnswer, expectedAnswer)
    if (partial.score >= 70) {
      return build({ isCorrect: false, isPartiallyCorrect: true, feedbackCode: 'PARTIAL', score: partial.score, allowProgression: false, normStudent, normExpected, mistakes: partial.mistakes })
    }
  }

  return build({ isCorrect: false, feedbackCode: 'INCORRECT', score: 0, allowProgression: false, normStudent, normExpected })
}

// ── Grammar drill (contains match) ───────────────────────────────────────────

function validateGrammarDrill(input: ValidationInput): ValidationResult {
  const { studentAnswer, expectedAnswer, acceptedAnswers, teacherBookAnswer, inputMode } = input
  const normStudent  = normalize(studentAnswer)
  const normExpected = normalize(expectedAnswer)
  const allAccepted  = [...acceptedAnswers, ...(teacherBookAnswer ? [teacherBookAnswer] : [])]

  if (inputMode === 'voice') {
    const stt = checkSTTTolerance(studentAnswer, expectedAnswer)
    if (stt.matched) {
      return build({ isCorrect: true, feedbackCode: 'ACCEPTABLE_STT', score: Math.round(stt.confidence * 100), allowProgression: true, normStudent, normExpected, matchedAnswer: expectedAnswer })
    }
  }

  const result = validateContains(studentAnswer, expectedAnswer, allAccepted)
  if (result.isCorrect) {
    return build({ isCorrect: true, feedbackCode: 'CORRECT', score: 100, allowProgression: true, normStudent, normExpected, matchedAnswer: result.matchedAnswer })
  }

  const partial = computePartialScore(studentAnswer, expectedAnswer)
  return build({
    isCorrect: false,
    isPartiallyCorrect: partial.isPartiallyCorrect,
    feedbackCode:       partial.isPartiallyCorrect ? 'PARTIAL' : 'INCORRECT',
    score:              partial.score,
    allowProgression:   false,
    normStudent,
    normExpected,
    mistakes: partial.mistakes,
  })
}

// ── Multiple choice ───────────────────────────────────────────────────────────

function validateMultipleChoice(input: ValidationInput): ValidationResult {
  const { studentAnswer, expectedAnswer } = input
  const normStudent  = normalize(studentAnswer)
  const normExpected = normalize(expectedAnswer)
  const isCorrect    = normStudent === normExpected

  return build({
    isCorrect,
    feedbackCode: isCorrect ? 'CORRECT' : 'INCORRECT',
    score:        isCorrect ? 100 : 0,
    allowProgression: isCorrect,
    normStudent,
    normExpected,
    matchedAnswer: isCorrect ? expectedAnswer : undefined,
    mistakes: isCorrect ? [] : [{
      type:     'wrong_choice',
      message:  `Selected "${studentAnswer}" — expected "${expectedAnswer}"`,
      expected: expectedAnswer,
      actual:   studentAnswer,
    }],
  })
}

// ── Matching (same as multiple choice — letter/id comparison) ─────────────────

function validateMatching(input: ValidationInput): ValidationResult {
  return validateMultipleChoice(input)
}

// ── Sentence transformation ───────────────────────────────────────────────────

function validateSentenceTransformation(input: ValidationInput): ValidationResult {
  const { studentAnswer, expectedAnswer, acceptedAnswers, teacherBookAnswer, inputMode } = input
  const normStudent  = normalize(studentAnswer)
  const normExpected = normalize(expectedAnswer)
  const allAccepted  = [...acceptedAnswers, ...(teacherBookAnswer ? [teacherBookAnswer] : [])]

  if (inputMode === 'voice') {
    const stt = checkSTTTolerance(studentAnswer, expectedAnswer)
    if (stt.matched && stt.confidence >= 0.85) {
      return build({ isCorrect: true, feedbackCode: 'ACCEPTABLE_STT', score: Math.round(stt.confidence * 100), allowProgression: true, normStudent, normExpected, matchedAnswer: expectedAnswer })
    }
  }

  const exact = validateExact(studentAnswer, expectedAnswer, { acceptedAnswers: allAccepted })
  if (exact.isCorrect) {
    return build({ isCorrect: true, feedbackCode: 'CORRECT', score: 100, allowProgression: true, normStudent, normExpected, matchedAnswer: exact.matchedAnswer })
  }

  // Contains: student may include surrounding context text
  const contains = validateContains(studentAnswer, expectedAnswer, allAccepted)
  if (contains.isCorrect) {
    return build({ isCorrect: true, feedbackCode: 'CORRECT', score: 95, allowProgression: true, normStudent, normExpected, matchedAnswer: contains.matchedAnswer })
  }

  // Analyze mistakes for targeted Teacher Brain feedback
  const mistakes = analyzeSentenceMistakes(studentAnswer, expectedAnswer)
  const partial   = computePartialScore(studentAnswer, expectedAnswer)

  if (partial.isPartiallyCorrect) {
    const allMistakes = [...mistakes, ...partial.mistakes].slice(0, 4)
    return build({ isCorrect: false, isPartiallyCorrect: true, feedbackCode: 'PARTIAL', score: partial.score, allowProgression: false, normStudent, normExpected, mistakes: allMistakes })
  }

  return build({ isCorrect: false, feedbackCode: 'INCORRECT', score: partial.score, allowProgression: false, normStudent, normExpected, mistakes })
}

// ── Any-response (discussion, personal fill, speaking) ───────────────────────

function validateAnyResponse(input: ValidationInput): ValidationResult {
  const { studentAnswer } = input
  const normStudent = normalize(studentAnswer)
  const hasContent  = normStudent.length >= 2

  return build({
    isCorrect:        hasContent,
    feedbackCode:     hasContent ? 'CORRECT' : 'INCORRECT',
    score:            hasContent ? 100 : 0,
    allowProgression: hasContent,
    normStudent,
    normExpected:     '',
    mistakes: hasContent ? [] : [{
      type:    'incomplete',
      message: 'Please say something to continue.',
      actual:  studentAnswer,
    }],
  })
}

// ── Prefix match (conjugation drills) ─────────────────────────────────────────

function validatePrefixMatch(input: ValidationInput): ValidationResult {
  const { studentAnswer, expectedAnswer, acceptedAnswers } = input
  const normStudent  = normalize(studentAnswer)
  const normExpected = normalize(expectedAnswer)

  const result = validatePrefix(studentAnswer, expectedAnswer, acceptedAnswers)
  if (result.isCorrect) {
    return build({ isCorrect: true, feedbackCode: 'CORRECT', score: 100, allowProgression: true, normStudent, normExpected, matchedAnswer: result.matchedAnswer })
  }

  return build({ isCorrect: false, feedbackCode: 'INCORRECT', score: 0, allowProgression: false, normStudent, normExpected })
}

// ── Exercise type router ──────────────────────────────────────────────────────

type ValidatorFn = (input: ValidationInput) => ValidationResult

const VALIDATOR_MAP: Record<string, ValidatorFn> = {
  fill_in_the_gap:         validateFillInGap,
  grammar_focus_fill:      validateFillInGap,
  grammar_drill:           validateGrammarDrill,
  multiple_choice:         validateMultipleChoice,
  matching:                validateMatching,
  sentence_transformation: validateSentenceTransformation,
  // Open-ended types that accept any response
  discussion:              validateAnyResponse,
  personal_fill:           validateAnyResponse,
  pair_speaking:           validateAnyResponse,
  dialogue_practice:       validateAnyResponse,
  pronunciation_practice:  validateAnyResponse,
  reading_comprehension:   validateAnyResponse,
  paragraph_reading:       validateAnyResponse,
  // Translation goes through open-ended path in ValidationService
  translation:             validateAnyResponse,
}

export function validateByExerciseType(input: ValidationInput): ValidationResult {
  const validator = VALIDATOR_MAP[input.exerciseType]

  if (!validator) {
    // Unknown exercise type — auto-pass, no progression block
    return build({
      isCorrect:        true,
      feedbackCode:     'CORRECT',
      score:            100,
      allowProgression: true,
      normStudent:      normalize(input.studentAnswer),
      normExpected:     normalize(input.expectedAnswer),
    })
  }

  return validator(input)
}
