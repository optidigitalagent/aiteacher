import { AgeBand } from './enums.js';
import {
  MAX_SESSION_SECONDS_6_7,
  MAX_SESSION_SECONDS_8_9,
  MAX_DAILY_MINUTES_6_7,
  MAX_DAILY_MINUTES_8_9,
  STT_CHILD_SPEECH_PRIOR_6_7,
  STT_CHILD_SPEECH_PRIOR_8_9,
} from './constants.js';

/** Opaque ID types — used to prevent accidental ID cross-assignment. */
export type SessionId = string & { readonly __brand: 'SessionId' };
export type ChildId = string & { readonly __brand: 'ChildId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type ItemId = string & { readonly __brand: 'ItemId' };
export type UnitId = string & { readonly __rand: 'UnitId' };
export type ActivityId = string;
export type LessonId = string;
export type CharacterId = string;

/** Age-band profile: constants derived from the child's age band. */
export interface AgeProfile {
  ageBand: AgeBand;
  maxSessionSeconds: number;
  maxDailyMinutes: number;
  sttChildSpeechPrior: number;
  maxSilenceBeforeActMs: number;
  maxWordsPerSentence: number;
  maxClauses: number;
}

export const AGE_PROFILE_6_7: AgeProfile = {
  ageBand: AgeBand.SIX_SEVEN,
  maxSessionSeconds: MAX_SESSION_SECONDS_6_7,
  maxDailyMinutes: MAX_DAILY_MINUTES_6_7,
  sttChildSpeechPrior: STT_CHILD_SPEECH_PRIOR_6_7,
  maxSilenceBeforeActMs: 3000,
  maxWordsPerSentence: 10,
  maxClauses: 1,
};

export const AGE_PROFILE_8_9: AgeProfile = {
  ageBand: AgeBand.EIGHT_NINE,
  maxSessionSeconds: MAX_SESSION_SECONDS_8_9,
  maxDailyMinutes: MAX_DAILY_MINUTES_8_9,
  sttChildSpeechPrior: STT_CHILD_SPEECH_PRIOR_8_9,
  maxSilenceBeforeActMs: 5000,
  maxWordsPerSentence: 15,
  maxClauses: 2,
};

/** Cost counters for token budget tracking per session (§14.3, Phase 4). */
export interface CostCounters {
  tokensGenerated: number;
  llmCallsClassification: number;
  llmCallsTeacherResponse: number;
  // ── Added by Phase 4 (State Engine) ──
  sttSeconds: number;
  ttsCharacters: number;
  turnCount: number;
}

/** Minimal context passed to LLM for teacher response generation (§12.2). */
export interface LlmTeacherContext {
  childFirstName: string;
  ageBand: AgeBand;
  currentActivity: string;
  targetItem: string;
  sttTextNormalized: string;
  promptType: string;
  attemptNumber: number;
  recentClassificationLabels: string[];
  teacherCharacter: string;
}

/** Session summary written at session end (§12.6, Patch 3 §3A.3). */
export interface SessionSummary {
  sessionId: string;
  childId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  stopReason: string;
  lessonId: string | null;
  lessonPhaseReached: string | null;
  itemsAttemptedCount: number;
  itemsMasteredIds: string[];
  recoveryEventCount: number;
  l1RescueUsed: boolean;
  speakingTurnsCount: number;
  completionRate: number | null;
  finalEmotionalSafety: number | null;
  parentReviewFlagged: boolean;
}

/** Safety event for the isolated audit log (Patch 3 §3A.4). */
export interface SafetyEvent {
  sessionId: string;
  childId: string;
  eventType: string;
  confidenceScore: number;
  detectionMethod: 'keyword_list' | 'safety_classifier' | 'pattern_rule';
  reviewStatus: 'pending' | 'reviewed' | 'dismissed';
  occurredAt: string;
  reviewerId?: string;
  reviewedAt?: string;
}
