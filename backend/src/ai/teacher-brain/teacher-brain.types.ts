export type CorrectionTurn = 'A' | 'B' | 'C' | 'D'

export type TeacherAction =
  | 'present_item'
  | 'continue_current_item'
  | 'confirm_correct'
  | 'transition_next_exercise'
  | 'skip_exercise'
  | 'complete_lesson'
  | 'clarify_item'
  | 'side_question_answered'
  | 'request_retry'
  | 'complete_item'
  | 'complete_exercise'
  | 'ask_clarification'
  | 'answer_side_question'
  | 'resume_current_item'

export type ForbiddenAction =
  | 'go_back_to_item'
  | 'repeat_completed_exercise'
  | 'invent_exercise'
  | 'skip_supported_exercise'
  | 'change_lesson_section'
  | 'reopen_completed_exercise'
  | 'invent_new_exercise'
  | 'change_exercise_type'
  | 'hallucinate_hidden_content'

export type ExerciseRuntimeMode =
  | 'deterministic_sequential'
  | 'matching_sequential'
  | 'soft_speaking'
  | 'grammar_explanation'
  | 'unsupported'

export type SupportedExerciseType =
  | 'fill_gap'
  | 'error_correction'
  | 'form_transformation'
  | 'grammar_transform'
  | 'multiple_choice'
  | 'reconstruction'
  | 'matching'
  | 'vocabulary_matching'
  | 'collocations'
  | 'find_opposites'
  | 'speaking_prompt'
  | 'discussion'
  | 'roleplay'
  | 'brainstorm'
  | 'interview'
  | 'show_interest_agree_disagree'
  | 'show_what_you_know'
  | 'write_sentences_from_prompts'
  | 'free_production'
  | 'grammar_focus'
  | 'remember_this'

export type UnsupportedExerciseType =
  | 'listening'
  | 'audio_reconstruction'
  | 'photo_task'
  | 'image_task'
  | 'hidden_context'
  | 'textbook_reference'
  | 'external_reading'
  | 'essay_writing'
  | 'email_writing'
  | 'pairwork_hidden'
  | 'hidden_answer_dependent'

export type UnsupportedReason =
  | 'requires_audio'
  | 'requires_image'
  | 'requires_hidden_context'
  | 'requires_written_composition'
  | 'requires_partner_card'
  | 'requires_previous_written_answer'

export type TeacherGuidanceMode =
  | 'correction_ladder'
  | 'soft_feedback'
  | 'skip_and_continue'
  | 'confusion_recovery'
  | 'side_question_recovery'

export type TeacherPersona = 'Alex' | 'Emma'

export interface StudentState {
  name: string
  level: string
  correctionTurn: CorrectionTurn | null
  itemRetryCount: number
  currentItem: string
  exerciseNum: number
  itemIndex: number
  remainingSeconds?: number
  recentErrors?: string[]
}

export interface ExerciseRuntimeState {
  exerciseNum: number
  exerciseType: string
  runtimeMode: ExerciseRuntimeMode
  itemIndex: number
  currentItem: string
  correctionTurn: CorrectionTurn | null
  completedItems: number[]
  isUnsupported: boolean
  unsupportedReason?: UnsupportedReason
}

export interface TeacherBrainContext {
  lessonId: string
  phase: string
  persona: TeacherPersona
  student: StudentState
  exercise: ExerciseRuntimeState
  guidanceMode: TeacherGuidanceMode
  completedExercises: number[]  // lesson-level completed exercise registry
}

export interface TeacherResponseContract {
  teacher_text: string
  action: TeacherAction
  exerciseNum?: number
  itemIndex?: number
  correctionTurn?: CorrectionTurn | null
  confidence?: number
  reasoning?: string
}

export type ExerciseBoundaryType =
  | 'item_correct'
  | 'item_turn_d_revealed'
  | 'exercise_complete'
  | 'exercise_skipped'
  | 'exercise_blocked'

export interface FewShotExample {
  id: string
  exerciseType: string
  correctionTurn?: CorrectionTurn
  isSkip?: boolean
  isSideQuestion?: boolean
  isConfusion?: boolean
  situation: string
  student_input: string
  bad_ai_response: string
  good_ai_response: string
  why: string
}

export interface RuleGroup {
  name: string
  description: string
  rules: readonly string[]
}

export interface ActionDefinition {
  action: TeacherAction
  description: string
  backendEffect: string
}

// Phase D: structured output contract parsed from <TEACHER_BRAIN_JSON> blocks
export interface TeacherBrainStructuredResponse {
  teacher_text: string
  action: TeacherAction
  exerciseNum?: number
  itemIndex?: number
  confidence?: number
  reason?: string
  targetExerciseNum?: number
  targetItemIndex?: number
  unsupportedReason?: string
}

export interface ParsedTeacherBrainResponse {
  visibleText: string
  structured?: TeacherBrainStructuredResponse
  parseError?: string
}

// Slim state projection passed to validateTeacherBrainAction — avoids importing LessonState
export interface TeacherBrainValidationState {
  completedExercises: number[]
  completedItems: number[]
  currentExerciseNum: number
  itemIndex: number
  correctionTurn: string | null
}

export interface TeacherBrainValidationResult {
  ok: boolean
  reason?: string
}
