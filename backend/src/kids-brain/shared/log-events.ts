import type { LogSeverity } from './enums.js';

/** All named log event constants for Kids Brain (Patch 13 §14A.2 + Phase 1). */
export const LOG_EVENTS = {
  // Session lifecycle
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_ENDED_NORMAL: 'SESSION_ENDED_NORMAL',
  SESSION_ENDED_TIMEOUT: 'SESSION_ENDED_TIMEOUT',
  SESSION_ENDED_EMOTIONAL: 'SESSION_ENDED_EMOTIONAL',
  SESSION_ENDED_REFUSAL: 'SESSION_ENDED_REFUSAL',
  SESSION_RECONNECTED: 'SESSION_RECONNECTED',
  SESSION_EXPIRED_NEW_STARTED: 'SESSION_EXPIRED_NEW_STARTED',
  SESSION_REDIS_WRITE_FAILURE: 'SESSION_REDIS_WRITE_FAILURE',
  SESSION_REDIS_UNAVAILABLE: 'SESSION_REDIS_UNAVAILABLE',

  // Phase 1 additional session events
  KIDS_SESSION_STARTED: 'kids_session_started',
  KIDS_TURN_STARTED: 'kids_turn_started',
  PERCEPTION_COMPLETED: 'perception_completed',
  CLASSIFICATION_COMPLETED: 'classification_completed',
  CLASSIFICATION_TIMEOUT_FALLBACK: 'classification_timeout_fallback',
  RECOVERY_STATE_CHANGED: 'recovery_state_changed',
  LEARNING_DECISION_MADE: 'learning_decision_made',
  TEACHER_RESPONSE_BUILT: 'teacher_response_built',
  VOCABULARY_GUARD_BLOCKED: 'vocabulary_guard_blocked',
  SESSION_AUTOSAVED: 'session_autosaved',
  SESSION_RECONNECTED_KIDS: 'session_reconnected',
  SESSION_COMPLETED: 'session_completed',
  SAFETY_EVENT_CREATED: 'safety_event_created',

  // Classification events (Phase 3 additions)
  CLASSIFICATION_STARTED: 'classification_started',
  LLM_CLASSIFIER_REQUESTED: 'llm_classifier_requested',
  SAFETY_CLASSIFICATION_OVERRIDE: 'safety_classification_override',

  // Classification events
  CLASSIFICATION_FAST_PATH: 'CLASSIFICATION_FAST_PATH',
  CLASSIFICATION_LLM_PATH: 'CLASSIFICATION_LLM_PATH',
  LLM_CLASSIFIER_TIMEOUT: 'LLM_CLASSIFIER_TIMEOUT',
  LLM_CLASSIFIER_CIRCUIT_OPEN: 'LLM_CLASSIFIER_CIRCUIT_OPEN',
  CLASSIFICATION_POSSIBLE_GUESS: 'CLASSIFICATION_POSSIBLE_GUESS',

  // Perception events (Patch 13 §14A.2 — uppercase)
  PERCEPTION_NULL_TEXT: 'PERCEPTION_NULL_TEXT',
  PERCEPTION_NULL_CONFIDENCE: 'PERCEPTION_NULL_CONFIDENCE',
  PERCEPTION_NULL_DURATION: 'PERCEPTION_NULL_DURATION',
  PERCEPTION_NULL_ENERGY: 'PERCEPTION_NULL_ENERGY',
  PERCEPTION_NULL_LANG: 'PERCEPTION_NULL_LANG',
  PERCEPTION_STT_TIMEOUT: 'PERCEPTION_STT_TIMEOUT',

  // Perception events (Phase 2 additions — lowercase style)
  PERCEPTION_STARTED: 'perception_started',
  STT_CONFIDENCE_MISSING: 'stt_confidence_missing',
  L1_DETECTED: 'l1_detected',
  SILENCE_DETECTED: 'silence_detected',
  LOW_INPUT_QUALITY: 'low_input_quality',

  // Recovery and safety events
  RECOVERY_OVERRIDE: 'RECOVERY_OVERRIDE',
  SAFETY_FLAG: 'SAFETY_FLAG',
  EASY_WIN_TRIGGERED: 'EASY_WIN_TRIGGERED',
  EASIEST_WIN_COLD_START: 'EASIEST_WIN_COLD_START',
  L1_ANCHOR_USED: 'L1_ANCHOR_USED',
  L1_BUDGET_EXHAUSTED_ITEM_DEFERRED: 'L1_BUDGET_EXHAUSTED_ITEM_DEFERRED',

  // Vocabulary guard events
  VOCAB_GUARD_BLOCK: 'VOCAB_GUARD_BLOCK',
  VOCAB_GUARD_TEMPLATE_FALLBACK: 'VOCAB_GUARD_TEMPLATE_FALLBACK',

  // Progression and mastery events
  ITEM_ADVANCE: 'ITEM_ADVANCE',
  MASTERY_LEVEL_ADVANCE: 'MASTERY_LEVEL_ADVANCE',
  PROGRESSION_FORBIDDEN_TRANSITION_BLOCKED: 'PROGRESSION_FORBIDDEN_TRANSITION_BLOCKED',

  // Parent review
  PARENT_REVIEW_TRIGGERED: 'PARENT_REVIEW_TRIGGERED',

  // State Engine events (Phase 4)
  STATE_UPDATE_STARTED: 'state_update_started',
  STATE_UPDATE_COMPLETED: 'state_update_completed',
  CHILD_STATE_CHANGED: 'child_state_changed',
  ITEM_STATE_CHANGED: 'item_state_changed',
  ENGAGEMENT_CHANGED: 'engagement_changed',
  CONFIDENCE_CHANGED: 'confidence_changed',
  SAFE_TO_CONTINUE_FALSE: 'safe_to_continue_false',

  // Learning Engine events (Phase 5)
  LEARNING_DECISION_STARTED: 'learning_decision_started',
  PROGRESSION_RULE_FIRED: 'progression_rule_fired',
  MASTERY_CANDIDATE_CREATED: 'mastery_candidate_created',
  REVIEW_CANDIDATE_CREATED: 'review_candidate_created',
  ACTIVITY_TRANSITION_SELECTED: 'activity_transition_selected',
  EASIEST_WIN_SELECTED: 'easiest_win_selected',
  SESSION_CLOSE_DECISION: 'session_close_decision',
} as const;

export type LogEventName = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS];

/** Base schema for all structured log events (Patch 13 §14A.2). */
export interface LogEvent {
  event: LogEventName;
  severity: LogSeverity;
  sessionId: string;
  turnNumber: number | null;
  timestamp: string; // ISO 8601
  childId?: string;
  userId?: string;
  payload: Record<string, unknown>;
}
