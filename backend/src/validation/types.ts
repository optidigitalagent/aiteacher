// ── Validation System — Core Types ────────────────────────────────────────────
// All correctness decisions flow through ValidationService → ValidationResult.
// GPT never sets isCorrect, score, or allowProgression.

export type ValidationMode =
  | 'strict'               // exact match only
  | 'flexible'             // contains / prefix match
  | 'beginner'             // allows minor spelling/punctuation errors
  | 'pronunciation_tolerant' // STT-aware, phonetic approximations accepted
  | 'open_ended'           // any non-empty response advances

export type InputMode =
  | 'text'
  | 'voice'
  | 'multiple_choice'
  | 'matching'

export type FeedbackCode =
  | 'CORRECT'
  | 'PARTIAL'
  | 'INCORRECT'
  | 'ACCEPTABLE_STT'
  | 'OPEN_ENDED_REVIEW_REQUIRED'

export type MistakeType =
  | 'spelling'
  | 'grammar'
  | 'word_order'
  | 'missing_word'
  | 'extra_word'
  | 'wrong_choice'
  | 'pronunciation'
  | 'incomplete'
  | 'unknown'

export interface ValidationMistake {
  type: MistakeType
  message: string
  expected?: string
  actual?: string
}

export interface ValidationInput {
  sessionId: string
  userId: string
  exerciseId: string
  exerciseType: string
  stepId: string
  studentAnswer: string
  expectedAnswer: string
  acceptedAnswers: string[]
  teacherBookAnswer?: string
  validationMode: ValidationMode
  studentLevel?: string
  inputMode: InputMode
  metadata?: Record<string, unknown>
}

export interface ValidationResult {
  isCorrect: boolean
  isPartiallyCorrect: boolean
  score: number               // 0–100
  allowProgression: boolean
  normalizedStudentAnswer: string
  normalizedExpectedAnswer: string
  matchedAnswer?: string
  mistakes: ValidationMistake[]
  feedbackCode: FeedbackCode
  recommendedHint?: string
  teacherExplanationData?: Record<string, unknown>
}
