// QA Type Definitions
// Core structures for the Exercise Runtime QA Matrix.
// Each scenario defines expected behavior across all runtime dimensions.

import type { RuntimeMode, ValidationMode, ProgressionMode } from '../protocols/exercise-protocols.js'
import type { BehaviorProfile } from '../teacher-behaviors/teacher-behavior-types.js'

export type QAResult = 'pass' | 'fail' | 'skip'

export type CorrectionTurnLabel = 'TURN_A' | 'TURN_B' | 'TURN_C' | 'TURN_D'

// ── Scenario answer fixtures ──────────────────────────────────────────────────

export interface AnswerFixture {
  studentAnswer: string
  isCorrect: boolean
  note?: string
}

// ── Expected runtime behaviors per dimension ──────────────────────────────────

export interface ExpectedRuntimeBehavior {
  protocolName: string
  runtimeMode: RuntimeMode
  locksItemUntilCorrect: boolean
  usesSoftFeedback: boolean
  allowsRetry: boolean
}

export interface ExpectedValidationBehavior {
  validationMode: ValidationMode
  acceptsLetterAnswer?: boolean
  acceptsTextAnswer?: boolean
  rejectsBlankAnswer: boolean
  noExactMatchForSpeaking: boolean
}

export interface ExpectedProgressionBehavior {
  progressionMode: ProgressionMode
  advancesOnCorrect: boolean
  blocksOnIncorrect: boolean
  noRepeatCompletedItems: boolean
  noAdvanceBeforeCorrect: boolean
}

export interface ExpectedTeacherBehavior {
  profile: BehaviorProfile
  givesHintBeforeReveal: boolean
  revealsAnswerAtFinalStage: boolean
  neverSaysWrong: boolean
  alwaysEndsWithQuestion: boolean
  maxSentencesPerTurn: number
  noLectureMode?: boolean
}

export interface ExpectedResumeBehavior {
  resumesFromCurrentItem: boolean
  noLessonRestart: boolean
  preservesCorrectionTurn: boolean
  preservesMatchingOptions: boolean
  noItemRegression: boolean
  noDuplicateProgression: boolean
}

export interface ExpectedOffTopicRecovery {
  redirectsToCurrentItem: boolean
  preservesCorrectionState: boolean
  noAccidentalAdvancement: boolean
  noExerciseRestart: boolean
}

export interface ExpectedCorrectionFlow {
  turns: CorrectionTurnLabel[]
  revealOnlyAtFinalTurn: boolean
  speakingExercisesSkipStrictLadder: boolean
  retryCountPreservedOnReconnect: boolean
}

// ── Sample exercise shape ──────────────────────────────────────────────────────

export interface SampleExercise {
  type: string
  instruction: string
  items?: string[]
  options?: string[]
  correctAnswer?: string | string[]
}

// ── Failure modes ─────────────────────────────────────────────────────────────

export type ForbiddenBehavior =
  | 'restart_lesson_on_reconnect'
  | 'advance_before_correct'
  | 'repeat_completed_item'
  | 'exact_match_on_speaking'
  | 'reveal_on_first_hint'
  | 'run_without_options'
  | 'ask_all_pairs_at_once'
  | 'enter_validator_when_unsupported'
  | 'hallucinate_audio_content'
  | 'hallucinate_image_content'
  | 'run_writing_as_voice'
  | 'break_cursor_on_unsupported'
  | 'matching_uses_transform_protocol'
  | 'skip_correction_turn'
  | 'ignore_off_topic_redirect'
  | 'advance_during_off_topic'

// ── Master QA Scenario ────────────────────────────────────────────────────────

export interface QAScenario {
  readonly scenarioId: string
  readonly exerciseType: string
  readonly protocolType: string
  readonly title: string
  readonly instruction: string
  readonly sampleExercise: SampleExercise
  readonly answerFixtures: AnswerFixture[]
  readonly expectedRuntimeBehavior: ExpectedRuntimeBehavior
  readonly expectedTeacherBehavior: ExpectedTeacherBehavior
  readonly expectedValidationBehavior: ExpectedValidationBehavior
  readonly expectedProgressionBehavior: ExpectedProgressionBehavior
  readonly expectedResumeBehavior: ExpectedResumeBehavior
  readonly expectedOffTopicRecovery: ExpectedOffTopicRecovery
  readonly expectedCorrectionFlow: ExpectedCorrectionFlow
  readonly allowedFailureModes: string[]
  readonly forbiddenBehaviors: ForbiddenBehavior[]
}

// ── QA Run Result ─────────────────────────────────────────────────────────────

export interface QACheckResult {
  scenarioId: string
  check: string
  result: QAResult
  detail?: string
}

export interface QAScenarioReport {
  scenarioId: string
  exerciseType: string
  checks: QACheckResult[]
  passed: number
  failed: number
  skipped: number
}
