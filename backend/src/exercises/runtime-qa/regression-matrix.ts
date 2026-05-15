// Regression Matrix
// Single source of truth: supported types, their expected runtime/validation/teacher mode,
// and forbidden regressions that must never happen in production.

import type { RuntimeMode, ValidationMode, ProgressionMode } from '../protocols/exercise-protocols.js'
import type { BehaviorProfile } from '../teacher-behaviors/teacher-behavior-types.js'

export interface RegressionEntry {
  readonly exerciseType: string
  readonly supportStatus: 'supported' | 'postponed' | 'unsupported'
  readonly expectedProtocol: string
  readonly expectedRuntimeMode: RuntimeMode
  readonly expectedValidationMode: ValidationMode
  readonly expectedProgressionMode: ProgressionMode
  readonly expectedTeacherProfile: BehaviorProfile
  readonly allowedInCurrentRuntime: boolean
  readonly forbiddenRegressions: readonly string[]
}

// ── Deterministic exercises ───────────────────────────────────────────────────

const DETERMINISTIC_REGRESSIONS = [
  'must not enter soft_speaking protocol',
  'must not use soft_ai_feedback validation',
  'must not advance before correct answer',
  'must not reveal answer before TURN_D',
  'must not repeat completed items',
  'must not restart exercise on reconnect',
] as const

const MATCHING_REGRESSIONS = [
  'must never use deterministic/transform protocol',
  'must never run without visible options',
  'must never ask all pairs at once',
  'must not advance before correct pair confirmed',
  'must not repeat completed pairs',
] as const

const SPEAKING_REGRESSIONS = [
  'must never use exact-match validation',
  'must never run TURN_D answer reveal',
  'must never lock item until exact correct answer',
  'must never use deterministic correction ladder',
] as const

const UNSUPPORTED_REGRESSIONS = [
  'must never enter the exercise validator',
  'must never hallucinate audio content',
  'must never hallucinate image content',
  'must never run writing as voice exercise',
  'must never break exercise cursor',
  'must never throw unhandled exception on unsupported type',
] as const

// ── Full regression matrix ─────────────────────────────────────────────────────

export const REGRESSION_MATRIX: RegressionEntry[] = [

  // ── Supported: deterministic ──────────────────────────────────────────────

  {
    exerciseType: 'fill_gap',
    supportStatus: 'supported',
    expectedProtocol: 'deterministic',
    expectedRuntimeMode: 'deterministic_sequential',
    expectedValidationMode: 'deterministic_normalized',
    expectedProgressionMode: 'locked_item',
    expectedTeacherProfile: 'deterministic',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: DETERMINISTIC_REGRESSIONS,
  },
  {
    exerciseType: 'choose_from_box',
    supportStatus: 'supported',
    expectedProtocol: 'deterministic',
    expectedRuntimeMode: 'deterministic_sequential',
    expectedValidationMode: 'deterministic_normalized',
    expectedProgressionMode: 'locked_item',
    expectedTeacherProfile: 'deterministic',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: DETERMINISTIC_REGRESSIONS,
  },
  {
    exerciseType: 'complete_correct_form',
    supportStatus: 'supported',
    expectedProtocol: 'deterministic',
    expectedRuntimeMode: 'deterministic_sequential',
    expectedValidationMode: 'deterministic_normalized',
    expectedProgressionMode: 'locked_item',
    expectedTeacherProfile: 'deterministic',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: DETERMINISTIC_REGRESSIONS,
  },
  {
    exerciseType: 'form_transformation',
    supportStatus: 'supported',
    expectedProtocol: 'deterministic',
    expectedRuntimeMode: 'deterministic_sequential',
    expectedValidationMode: 'deterministic_normalized',
    expectedProgressionMode: 'locked_item',
    expectedTeacherProfile: 'deterministic',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: DETERMINISTIC_REGRESSIONS,
  },
  {
    exerciseType: 'rewrite_sentence',
    supportStatus: 'supported',
    expectedProtocol: 'deterministic',
    expectedRuntimeMode: 'deterministic_sequential',
    expectedValidationMode: 'ai_semantic',
    expectedProgressionMode: 'locked_item',
    expectedTeacherProfile: 'deterministic',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: DETERMINISTIC_REGRESSIONS,
  },
  {
    exerciseType: 'write_questions',
    supportStatus: 'supported',
    expectedProtocol: 'deterministic',
    expectedRuntimeMode: 'deterministic_sequential',
    expectedValidationMode: 'ai_semantic',
    expectedProgressionMode: 'locked_item',
    expectedTeacherProfile: 'deterministic',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: DETERMINISTIC_REGRESSIONS,
  },
  {
    exerciseType: 'error_correction',
    supportStatus: 'supported',
    expectedProtocol: 'deterministic',
    expectedRuntimeMode: 'deterministic_sequential',
    expectedValidationMode: 'deterministic_normalized',
    expectedProgressionMode: 'locked_item',
    expectedTeacherProfile: 'deterministic',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: DETERMINISTIC_REGRESSIONS,
  },
  {
    exerciseType: 'true_false',
    supportStatus: 'supported',
    expectedProtocol: 'deterministic',
    expectedRuntimeMode: 'deterministic_sequential',
    expectedValidationMode: 'deterministic_exact',
    expectedProgressionMode: 'locked_item',
    expectedTeacherProfile: 'deterministic',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: DETERMINISTIC_REGRESSIONS,
  },
  {
    exerciseType: 'multiple_choice',
    supportStatus: 'supported',
    expectedProtocol: 'deterministic',
    expectedRuntimeMode: 'deterministic_sequential',
    expectedValidationMode: 'matching_letter_or_text',
    expectedProgressionMode: 'locked_item',
    expectedTeacherProfile: 'matching',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: [
      ...DETERMINISTIC_REGRESSIONS,
      'must never run without options payload',
    ],
  },
  {
    exerciseType: 'reconstruction',
    supportStatus: 'supported',
    expectedProtocol: 'deterministic',
    expectedRuntimeMode: 'deterministic_sequential',
    expectedValidationMode: 'ai_semantic',
    expectedProgressionMode: 'locked_item',
    expectedTeacherProfile: 'deterministic',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: DETERMINISTIC_REGRESSIONS,
  },
  {
    exerciseType: 'replace_substitute_words',
    supportStatus: 'supported',
    expectedProtocol: 'deterministic',
    expectedRuntimeMode: 'deterministic_sequential',
    expectedValidationMode: 'deterministic_normalized',
    expectedProgressionMode: 'locked_item',
    expectedTeacherProfile: 'deterministic',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: DETERMINISTIC_REGRESSIONS,
  },
  {
    exerciseType: 'tick_cross',
    supportStatus: 'supported',
    expectedProtocol: 'deterministic',
    expectedRuntimeMode: 'deterministic_sequential',
    expectedValidationMode: 'deterministic_exact',
    expectedProgressionMode: 'locked_item',
    expectedTeacherProfile: 'deterministic',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: DETERMINISTIC_REGRESSIONS,
  },
  {
    exerciseType: 'write_sentences_from_prompts',
    supportStatus: 'supported',
    expectedProtocol: 'speaking',
    expectedRuntimeMode: 'soft_speaking',
    expectedValidationMode: 'soft_ai_feedback',
    expectedProgressionMode: 'soft_completion',
    expectedTeacherProfile: 'speaking',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: SPEAKING_REGRESSIONS,
  },

  // ── Supported: matching ───────────────────────────────────────────────────

  {
    exerciseType: 'matching',
    supportStatus: 'supported',
    expectedProtocol: 'matching',
    expectedRuntimeMode: 'matching_sequential',
    expectedValidationMode: 'matching_letter_or_text',
    expectedProgressionMode: 'one_match_at_a_time',
    expectedTeacherProfile: 'matching',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: MATCHING_REGRESSIONS,
  },
  {
    exerciseType: 'vocabulary_matching',
    supportStatus: 'supported',
    expectedProtocol: 'matching',
    expectedRuntimeMode: 'matching_sequential',
    expectedValidationMode: 'matching_letter_or_text',
    expectedProgressionMode: 'one_match_at_a_time',
    expectedTeacherProfile: 'matching',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: MATCHING_REGRESSIONS,
  },
  {
    exerciseType: 'collocations',
    supportStatus: 'supported',
    expectedProtocol: 'matching',
    expectedRuntimeMode: 'matching_sequential',
    expectedValidationMode: 'deterministic_normalized',
    expectedProgressionMode: 'one_match_at_a_time',
    expectedTeacherProfile: 'matching',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: MATCHING_REGRESSIONS,
  },
  {
    exerciseType: 'find_opposites',
    supportStatus: 'supported',
    expectedProtocol: 'matching',
    expectedRuntimeMode: 'matching_sequential',
    expectedValidationMode: 'deterministic_normalized',
    expectedProgressionMode: 'one_match_at_a_time',
    expectedTeacherProfile: 'matching',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: MATCHING_REGRESSIONS,
  },

  // ── Supported: speaking ───────────────────────────────────────────────────

  {
    exerciseType: 'speaking_prompt',
    supportStatus: 'supported',
    expectedProtocol: 'speaking',
    expectedRuntimeMode: 'soft_speaking',
    expectedValidationMode: 'soft_ai_feedback',
    expectedProgressionMode: 'soft_completion',
    expectedTeacherProfile: 'speaking',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: SPEAKING_REGRESSIONS,
  },
  {
    exerciseType: 'discussion',
    supportStatus: 'supported',
    expectedProtocol: 'speaking',
    expectedRuntimeMode: 'soft_speaking',
    expectedValidationMode: 'soft_ai_feedback',
    expectedProgressionMode: 'soft_completion',
    expectedTeacherProfile: 'speaking',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: SPEAKING_REGRESSIONS,
  },
  {
    exerciseType: 'roleplay',
    supportStatus: 'supported',
    expectedProtocol: 'speaking',
    expectedRuntimeMode: 'soft_speaking',
    expectedValidationMode: 'soft_ai_feedback',
    expectedProgressionMode: 'soft_completion',
    expectedTeacherProfile: 'speaking',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: SPEAKING_REGRESSIONS,
  },
  {
    exerciseType: 'show_interest_agree_disagree',
    supportStatus: 'supported',
    expectedProtocol: 'speaking',
    expectedRuntimeMode: 'soft_speaking',
    expectedValidationMode: 'soft_ai_feedback',
    expectedProgressionMode: 'soft_completion',
    expectedTeacherProfile: 'speaking',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: SPEAKING_REGRESSIONS,
  },
  {
    exerciseType: 'brainstorm_60_second',
    supportStatus: 'supported',
    expectedProtocol: 'speaking',
    expectedRuntimeMode: 'warmup_activation',
    expectedValidationMode: 'soft_ai_feedback',
    expectedProgressionMode: 'soft_completion',
    expectedTeacherProfile: 'speaking',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: SPEAKING_REGRESSIONS,
  },
  {
    exerciseType: 'show_what_you_know',
    supportStatus: 'supported',
    expectedProtocol: 'speaking',
    expectedRuntimeMode: 'warmup_activation',
    expectedValidationMode: 'soft_ai_feedback',
    expectedProgressionMode: 'soft_completion',
    expectedTeacherProfile: 'speaking',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: SPEAKING_REGRESSIONS,
  },

  // ── Supported: grammar explanation ───────────────────────────────────────

  {
    exerciseType: 'grammar_focus',
    supportStatus: 'supported',
    expectedProtocol: 'grammar_focus',
    expectedRuntimeMode: 'grammar_explanation',
    expectedValidationMode: 'soft_ai_feedback',
    expectedProgressionMode: 'explanation_then_check',
    expectedTeacherProfile: 'grammar_focus',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: [
      'must not turn into long lecture',
      'must always end with check question',
      'must transition to supported practice after explanation',
    ],
  },
  {
    exerciseType: 'remember_this',
    supportStatus: 'supported',
    expectedProtocol: 'grammar_focus',
    expectedRuntimeMode: 'teacher_explanation',
    expectedValidationMode: 'soft_ai_feedback',
    expectedProgressionMode: 'explanation_then_check',
    expectedTeacherProfile: 'grammar_focus',
    allowedInCurrentRuntime: true,
    forbiddenRegressions: [
      'must not turn into long lecture',
      'must always end with check question',
    ],
  },

  // ── Postponed / Unsupported ───────────────────────────────────────────────

  {
    exerciseType: 'listening',
    supportStatus: 'postponed',
    expectedProtocol: 'unsupported',
    expectedRuntimeMode: 'future_listening_mode',
    expectedValidationMode: 'unsupported',
    expectedProgressionMode: 'skip',
    expectedTeacherProfile: 'unsupported',
    allowedInCurrentRuntime: false,
    forbiddenRegressions: UNSUPPORTED_REGRESSIONS,
  },
  {
    exerciseType: 'gap_fill_from_audio',
    supportStatus: 'postponed',
    expectedProtocol: 'unsupported',
    expectedRuntimeMode: 'future_listening_mode',
    expectedValidationMode: 'unsupported',
    expectedProgressionMode: 'skip',
    expectedTeacherProfile: 'unsupported',
    allowedInCurrentRuntime: false,
    forbiddenRegressions: UNSUPPORTED_REGRESSIONS,
  },
  {
    exerciseType: 'listen_check_repeat',
    supportStatus: 'postponed',
    expectedProtocol: 'unsupported',
    expectedRuntimeMode: 'future_listening_mode',
    expectedValidationMode: 'unsupported',
    expectedProgressionMode: 'skip',
    expectedTeacherProfile: 'unsupported',
    allowedInCurrentRuntime: false,
    forbiddenRegressions: UNSUPPORTED_REGRESSIONS,
  },
  {
    exerciseType: 'pronunciation_focus',
    supportStatus: 'postponed',
    expectedProtocol: 'unsupported',
    expectedRuntimeMode: 'future_pronunciation_mode',
    expectedValidationMode: 'unsupported',
    expectedProgressionMode: 'skip',
    expectedTeacherProfile: 'unsupported',
    allowedInCurrentRuntime: false,
    forbiddenRegressions: UNSUPPORTED_REGRESSIONS,
  },
  {
    exerciseType: 'reading_long_text',
    supportStatus: 'postponed',
    expectedProtocol: 'unsupported',
    expectedRuntimeMode: 'future_reading_mode',
    expectedValidationMode: 'unsupported',
    expectedProgressionMode: 'skip',
    expectedTeacherProfile: 'unsupported',
    allowedInCurrentRuntime: false,
    forbiddenRegressions: UNSUPPORTED_REGRESSIONS,
  },
  {
    exerciseType: 'gapped_text',
    supportStatus: 'postponed',
    expectedProtocol: 'unsupported',
    expectedRuntimeMode: 'future_reading_mode',
    expectedValidationMode: 'unsupported',
    expectedProgressionMode: 'skip',
    expectedTeacherProfile: 'unsupported',
    allowedInCurrentRuntime: false,
    forbiddenRegressions: UNSUPPORTED_REGRESSIONS,
  },
  {
    exerciseType: 'writing_task',
    supportStatus: 'postponed',
    expectedProtocol: 'unsupported',
    expectedRuntimeMode: 'future_writing_mode',
    expectedValidationMode: 'unsupported',
    expectedProgressionMode: 'skip',
    expectedTeacherProfile: 'unsupported',
    allowedInCurrentRuntime: false,
    forbiddenRegressions: UNSUPPORTED_REGRESSIONS,
  },
  {
    exerciseType: 'complete_table',
    supportStatus: 'postponed',
    expectedProtocol: 'unsupported',
    expectedRuntimeMode: 'skipped',
    expectedValidationMode: 'unsupported',
    expectedProgressionMode: 'skip',
    expectedTeacherProfile: 'unsupported',
    allowedInCurrentRuntime: false,
    forbiddenRegressions: UNSUPPORTED_REGRESSIONS,
  },
  {
    exerciseType: 'complete_cartoon_captions',
    supportStatus: 'postponed',
    expectedProtocol: 'unsupported',
    expectedRuntimeMode: 'skipped',
    expectedValidationMode: 'unsupported',
    expectedProgressionMode: 'skip',
    expectedTeacherProfile: 'unsupported',
    allowedInCurrentRuntime: false,
    forbiddenRegressions: UNSUPPORTED_REGRESSIONS,
  },
  {
    exerciseType: 'unknown',
    supportStatus: 'unsupported',
    expectedProtocol: 'unsupported',
    expectedRuntimeMode: 'skipped',
    expectedValidationMode: 'unsupported',
    expectedProgressionMode: 'skip',
    expectedTeacherProfile: 'unsupported',
    allowedInCurrentRuntime: false,
    forbiddenRegressions: [
      ...UNSUPPORTED_REGRESSIONS,
      'must never throw unhandled exception on unknown type',
      'must always fallback to unsupported protocol',
    ],
  },
]

// ── Global forbidden regressions (apply to ALL exercise types) ────────────────

export const GLOBAL_FORBIDDEN_REGRESSIONS = [
  'reload must never restart lesson',
  'reconnect must never restart lesson',
  'completed items must never repeat',
  'correction turn must not reset to 0 on reconnect',
  'matching must never become transform protocol',
  'speaking must never use exact-match validation',
  'unsupported types must never enter validator',
  'unsupported types must never break exercise cursor',
  'unsupported types must never hallucinate capabilities',
  'duplicate focus_lesson_start must not restart lesson',
] as const

// ── Helper: get regression entry by type ──────────────────────────────────────

export function getRegressionEntry(exerciseType: string): RegressionEntry | undefined {
  return REGRESSION_MATRIX.find(e => e.exerciseType === exerciseType)
}

export function getAllForbiddenRegressionsFor(exerciseType: string): readonly string[] {
  const entry = getRegressionEntry(exerciseType)
  if (!entry) return GLOBAL_FORBIDDEN_REGRESSIONS
  return [...GLOBAL_FORBIDDEN_REGRESSIONS, ...entry.forbiddenRegressions]
}
