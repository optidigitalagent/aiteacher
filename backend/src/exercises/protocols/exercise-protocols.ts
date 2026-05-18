// Exercise Policy Protocol Types
// Source of truth for all exercise type behavior definitions.

export type SupportStatus = 'supported' | 'partial' | 'postponed' | 'unsupported'

export type RuntimeMode =
  | 'deterministic_sequential'
  | 'matching_sequential'
  | 'soft_speaking'
  | 'teacher_explanation'
  | 'warmup_activation'
  | 'grammar_explanation'
  | 'reading_text'
  | 'skipped'
  | 'future_reading_mode'
  | 'future_listening_mode'
  | 'future_writing_mode'
  | 'future_pronunciation_mode'

export type ValidationMode =
  | 'deterministic_exact'
  | 'deterministic_normalized'
  | 'matching_letter_or_text'
  | 'ai_semantic'
  | 'soft_ai_feedback'
  | 'no_validation'
  | 'unsupported'

export type ProgressionMode =
  | 'locked_item'
  | 'one_match_at_a_time'
  | 'soft_completion'
  | 'explanation_then_check'
  | 'skip'
  | 'future'

export type DowngradeStrategy =
  | 'none'
  | 'teacher_explanation'
  | 'speaking_prompt'
  | 'skip'
  | 'future_only'

export type VoiceFriendliness = 'high' | 'medium' | 'low' | 'not_applicable'

export interface TeacherBehavior {
  introRule: string
  answerFormatRule: string
  correctionRule: string
  hintRule: string
  progressionRule: string
  offTopicRule: string
  forbiddenBehaviors: string[]
}

export interface ExercisePolicy {
  canonicalType: string
  aliases: string[]
  detectionSignals: string[]
  supportStatus: SupportStatus
  runtimeMode: RuntimeMode
  validationMode: ValidationMode
  progressionMode: ProgressionMode
  voiceFriendliness: VoiceFriendliness
  requiresOptions: boolean
  requiresCorrectAnswer: boolean
  requiresAudio: boolean
  requiresImage: boolean
  requiresLongText: boolean
  allowInCurrentRuntime: boolean
  downgradeStrategy: DowngradeStrategy
  teacherBehavior: TeacherBehavior
}

export interface SnapshotValidationResult {
  ok: boolean
  reason?: string
}
