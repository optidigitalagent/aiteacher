import type { ExerciseRuntimeMode } from './teacher-brain.types.js'

export const SUPPORTED_DETERMINISTIC_TYPES = [
  'fill_gap',
  'error_correction',
  'form_transformation',
  'grammar_transform',
  'multiple_choice',
  'reconstruction',
] as const

export const SUPPORTED_READING_TYPES = [
  'gapped_text',
  'find_in_text',
  'read_and_answer',
  'read_and_write_names',
  'phrase_classification',
] as const

export const SUPPORTED_MATCHING_TYPES = [
  'matching',
  'vocabulary_matching',
  'collocations',
  'find_opposites',
] as const

export const SUPPORTED_SPEAKING_TYPES = [
  'speaking_prompt',
  'discussion',
  'roleplay',
  'brainstorm',
  'interview',
  'show_interest_agree_disagree',
  'show_what_you_know',
  'write_sentences_from_prompts',
  'free_production',
] as const

export const SUPPORTED_GRAMMAR_TYPES = [
  'grammar_focus',
  'remember_this',
] as const

export const UNSUPPORTED_EXERCISE_TYPES = [
  'listening',
  'audio_reconstruction',
  'photo_task',
  'image_task',
  'hidden_context',
  'textbook_reference',
  'external_reading',
  'essay_writing',
  'email_writing',
  'pairwork_hidden',
  'hidden_answer_dependent',
] as const

export const FORBIDDEN_AI_BEHAVIORS = [
  'reopen_completed_exercise',
  'invent_new_exercise',
  'change_exercise_type',
  'hallucinate_hidden_content',
  'go_back_to_item',
  'repeat_completed_exercise',
  'skip_supported_exercise_without_backend_signal',
  'invent_vocabulary_after_skip',
  'reconstruct_hidden_listening_content',
  'pre_explain_grammar_before_student_attempts',
  'restart_correction_ladder_at_turn_a',
  'accept_wrong_answer_as_correct',
  'adapt_unsupported_exercise',
  'continue_past_skip_without_next_exercise',
] as const

export const TEACHER_COMMUNICATION_PRINCIPLES = [
  'Lead the lesson — always announce what comes next, never wait to be asked',
  'Correction turn is backend-authoritative — never re-derive from conversation history',
  'Item text is backend-authoritative — never paraphrase, simplify, or invent',
  'Exercise cursor moves only forward — never backward',
  'One item per turn — never stack multiple questions in one response',
  'Side questions get one turn maximum — then return to exact current item',
  'Skip announcements are one sentence — include next exercise in the same response',
  'After any skip: next textbook exercise only — never invented content',
  'Never say Wrong or Incorrect — use guiding correction language',
  'Praise the thinking not the person — avoid hollow effusive praise',
] as const

export const EXERCISE_RUNTIME_MODE_MAP: Record<string, ExerciseRuntimeMode> = {
  fill_gap:                     'deterministic_sequential',
  error_correction:             'deterministic_sequential',
  form_transformation:          'deterministic_sequential',
  grammar_transform:            'deterministic_sequential',
  multiple_choice:              'deterministic_sequential',
  reconstruction:               'deterministic_sequential',
  matching:                     'matching_sequential',
  vocabulary_matching:          'matching_sequential',
  collocations:                 'matching_sequential',
  find_opposites:               'matching_sequential',
  speaking_prompt:              'soft_speaking',
  discussion:                   'soft_speaking',
  roleplay:                     'soft_speaking',
  brainstorm:                   'soft_speaking',
  interview:                    'soft_speaking',
  show_interest_agree_disagree: 'soft_speaking',
  show_what_you_know:           'soft_speaking',
  write_sentences_from_prompts: 'soft_speaking',
  free_production:              'soft_speaking',
  grammar_focus:                'grammar_explanation',
  remember_this:                'grammar_explanation',
  gapped_text:                  'reading_text',
  find_in_text:                 'reading_text',
  read_and_answer:              'reading_text',
  read_and_write_names:         'reading_text',
  phrase_classification:        'reading_text',
  listening:                    'unsupported',
  audio_reconstruction:         'unsupported',
  photo_task:                   'unsupported',
  image_task:                   'unsupported',
  essay_writing:                'unsupported',
  email_writing:                'unsupported',
  pairwork_hidden:              'unsupported',
  hidden_context:               'unsupported',
  textbook_reference:           'unsupported',
  external_reading:             'unsupported',
  hidden_answer_dependent:      'unsupported',
}

export const SKIP_POLICY = {
  ANNOUNCEMENT_MAX_SENTENCES: 1,
  NEXT_EXERCISE_IN_SAME_RESPONSE: true,
  ADAPTATION_FORBIDDEN: true,
  POST_SKIP_INVENTION_FORBIDDEN: true,
  VOCABULARY_AFTER_SKIP_FORBIDDEN: true,
  PRONUNCIATION_AFTER_SKIP_FORBIDDEN: true,
  GRAMMAR_LECTURE_AFTER_SKIP_FORBIDDEN: true,
} as const

export const CORRECTION_LADDER_DESCRIPTIONS = {
  A: 'Ask ONE guiding question. Give ZERO part of the answer. Target the specific knowledge gap.',
  B: 'Give ONE small hint. Do not reveal the full answer. Narrow the student\'s search space.',
  C: 'Give a STRONGER hint. The answer is nearly deducible from this hint.',
  D: 'REVEAL the full correct answer. Explain why briefly. Ask student to repeat the correct form.',
} as const

export const ANTI_HALLUCINATION_RULES = [
  'Never generate item text that was not provided in the backend context',
  'Never invent a correct answer for an item not received from backend',
  'Never claim to know what the textbook page looks like',
  'Never fabricate the content of a listening track or image',
  'Never refer to previous lesson data not provided in this session context',
] as const

export const TOKEN_BUDGET = {
  TOTAL_SYSTEM_PROMPT: 4000,
  RAG_CONTEXT: 800,
  CONVERSATION_HISTORY_EXCHANGES: 8,
  STUDENT_PROFILE_MAX_TOKENS: 200,
  CONTEXT_COMPOSER_MAX: 1200,
  BEHAVIOR_POLICY_MAX: 600,
  EXAMPLES_MAX: 800,
  BASE_PERSONA_MAX: 400,
} as const
