export enum AgeBand {
  SIX_SEVEN = '6-7',
  EIGHT_NINE = '8-9',
}

export enum ActivityType {
  LISTEN_AND_POINT = 'listen_and_point',
  REPEAT_AFTER_ME = 'repeat_after_me',
  FORCED_CHOICE_2 = 'forced_choice_2',
  FORCED_CHOICE_4 = 'forced_choice_4',
  SUPPORTED_PRODUCTION = 'supported_production',
  SENTENCE_FRAME_PRODUCTION = 'sentence_frame_production',
  SENTENCE_PRODUCTION = 'sentence_production',
  REVIEW_PRODUCTION = 'review_production',
}

export enum MasteryLevel {
  EMERGING = 'emerging',
  DEVELOPING = 'developing',
  SECURE = 'secure',
  AUTOMATIC = 'automatic',
}

export enum RecoveryState {
  NORMAL = 'normal',
  MILD_CONFUSION = 'mild_confusion',
  REPEATED_FAILURE = 'repeated_failure',
  FRUSTRATION_RISK = 'frustration_risk',
  DISENGAGEMENT = 'disengagement',
  REFUSAL = 'refusal',
  EMOTIONAL_SHUTDOWN = 'emotional_shutdown',
  REPAIRED_SUCCESS = 'repaired_success',
}

/** All canonical classification labels (spec §6.1). */
export enum ClassificationLabel {
  // Correct group
  CORRECT_CONFIDENT = 'correct_confident',
  CORRECT_HESITANT = 'correct_hesitant',
  NEAR_CORRECT = 'near_correct',
  PRONUNCIATION_VARIANT = 'pronunciation_variant',
  PARTIAL_ANSWER = 'partial_answer',
  REPEATED_AFTER_MODEL = 'repeated_after_model',

  // Wrong group
  WRONG_SEMANTIC = 'wrong_semantic',
  WRONG_BUT_RELATED = 'wrong_but_related',

  // Nonsense group
  RANDOM_NONSENSE = 'random_nonsense',
  PLAYFUL_NONSENSE = 'playful_nonsense',
  AVOIDANCE_NONSENSE = 'avoidance_nonsense',

  // Silence group
  SILENCE_SHORT = 'silence_short',
  SILENCE_MEDIUM = 'silence_medium',
  SILENCE_LONG = 'silence_long',
  NO_RESPONSE = 'no_response',

  // L1 group
  L1_TRANSLATION = 'l1_translation',
  L1_HELP_REQUEST = 'l1_help_request',
  L1_REFUSAL = 'l1_refusal',
  CODE_SWITCH = 'code_switch',

  // Refusal / Disengagement group
  I_DONT_KNOW = 'i_dont_know',
  REFUSAL = 'refusal',
  DISTRACTION = 'distraction',
  OFF_TOPIC_STORY = 'off_topic_story',

  // Safety group (hard deterministic override)
  UNSAFE_OR_SENSITIVE = 'unsafe_or_sensitive',

  // Engagement / state labels (Phase 3)
  OVEREXCITED = 'overexcited',
  EMOTIONAL_SHUTDOWN = 'emotional_shutdown',
  TEST_THE_AI = 'test_the_ai',

  // Clarification / readiness-in-exercise
  CLARIFICATION_REQUEST = 'clarification_request',

  // Social / conversational speech (greetings, acknowledgements, stalling)
  // Child spoke meaningfully but not the target word — redirect warmly.
  SOCIAL_SPEECH = 'social_speech',

  // Fallback
  UNKNOWN_UNCERTAIN = 'unknown_uncertain',
}

/** Closed enum for teacher action codes emitted in ActionPacket (Patch 12). */
export enum TeacherActionCode {
  // Progression actions
  PRAISE_AND_PROGRESS = 'praise_and_progress',
  WARM_PRAISE_CONFIRM = 'warm_praise_confirm',
  RECAST_AND_CONFIRM = 'recast_and_confirm',
  PRAISE_ECHO_THEN_CHECK = 'praise_echo_then_check',
  COMPLETE_ANSWER_MODEL = 'complete_answer_model',
  MOVE_TO_NEXT_ITEM = 'move_to_next_item',
  HOLD_CURRENT_ITEM = 'hold_current_item',

  // Scaffolding actions
  MODEL_ANSWER = 'model_answer',
  ASK_FORCED_CHOICE = 'ask_forced_choice',
  SIMPLIFY = 'simplify',
  USE_L1_ANCHOR = 'use_l1_anchor',

  // Recovery actions
  GIVE_EASIEST_WIN = 'give_easiest_win',
  SWITCH_ACTIVITY = 'switch_activity',
  PLAY_ALONG_BRIEFLY = 'play_along_briefly',
  WARM_REDIRECT = 'warm_redirect',
  PAUSE_AND_CHECK_IN = 'pause_and_check_in',
  BACK_OFF_OFFER_CHOICE = 'back_off_offer_choice',

  // Session lifecycle actions
  END_SESSION = 'end_session',
  ESCALATE_TO_SAFETY = 'escalate_to_safety',

  // Lesson structure actions
  OPEN_LESSON = 'open_lesson',
  CLOSE_LESSON = 'close_lesson',
  PHASE_TRANSITION = 'phase_transition',
  REWARD_MOMENT = 'reward_moment',
}

export enum FeedbackTone {
  NEUTRAL = 'neutral',
  WARM = 'warm',
  CELEBRATORY = 'celebratory',
  GENTLE_CORRECTION = 'gentle_correction',
}

export enum LessonPhase {
  WARM_UP = 'warm_up',
  INTRODUCTION = 'introduction',
  PRACTICE = 'practice',
  CONSOLIDATION = 'consolidation',
  CLOSE = 'close',
}

export enum ClassificationPath {
  FAST_PATH = 'fast_path',
  LLM_PATH = 'llm_path',
  TIMEOUT_FALLBACK = 'timeout_fallback',
}

export enum L1Script {
  CYRILLIC = 'cyrillic',
  LATIN_LOANWORD = 'latin_loanword',
  AMBIGUOUS = 'ambiguous',
}

export enum L1IntentHint {
  TRANSLATION = 'translation',
  HELP_REQUEST = 'help_request',
  REFUSAL = 'refusal',
  I_DONT_KNOW = 'i_dont_know',
  UNKNOWN = 'unknown',
}

export enum LogSeverity {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export enum ProgressionDecision {
  ADVANCE = 'advance',
  STAY = 'stay',
  REPEAT = 'repeat',
  SCAFFOLD = 'scaffold',
  LOWER_DIFFICULTY = 'lower_difficulty',
  REVIEW = 'review',
  STOP = 'stop',
}

export enum PromptType {
  FORCED_CHOICE = 'forced_choice',
  YES_NO = 'yes_no',
  OPEN_PRODUCTION = 'open_production',
  REPEAT_AFTER_ME = 'repeat_after_me',
  LISTEN_ONLY = 'listen_only',
}

export enum SessionStopReason {
  NORMAL = 'normal',
  TIMEOUT = 'timeout',
  EMOTIONAL = 'emotional',
  ENGAGEMENT = 'engagement',
  REFUSAL = 'refusal',
  SAFETY = 'safety',
}

// ── Phase 5: Learning Engine ──────────────────────────────────────────────────

/** Additional activity types used by the Learning Engine (Phase 5). */
export enum LearningActivityType {
  YES_NO_COMPREHENSION = 'yes_no_comprehension',
  TPR_ACTION = 'tpr_action',
  REVIEW_LOOP = 'review_loop',
  EASIEST_WIN = 'easiest_win',
  RECOVERY_PROMPT = 'recovery_prompt',
}

/**
 * All learning decision types emitted by the Learning Engine (Phase 5).
 * Represents the high-level pedagogical action to take this turn.
 */
export enum LearningDecisionType {
  STAY_CURRENT_ITEM = 'stay_current_item',
  REPEAT_CURRENT_ACTIVITY = 'repeat_current_activity',
  SCAFFOLD_CURRENT_ITEM = 'scaffold_current_item',
  LOWER_DIFFICULTY = 'lower_difficulty',
  ADVANCE_ACTIVITY = 'advance_activity',
  ADVANCE_ITEM = 'advance_item',
  TRIGGER_REVIEW = 'trigger_review',
  TRIGGER_EASIEST_WIN = 'trigger_easiest_win',
  CONTINUE_RECOVERY = 'continue_recovery',
  REPAIRED_SUCCESS = 'repaired_success',
  CLOSE_SUCCESS = 'close_success',
  CLOSE_SAFETY = 'close_safety',
  CLOSE_TIMEOUT = 'close_timeout',
  HOLD_UNCERTAIN = 'hold_uncertain',
}
