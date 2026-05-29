import type {
  ClassificationLabel,
  ActivityType,
  MasteryLevel,
  TeacherActionCode,
  LessonPhase,
  RecoveryState,
  LearningDecisionType,
} from '../shared/enums.js';
import type { SessionMemory } from '../contracts/session-memory.js';
import type { MasteryRecord } from '../contracts/mastery-record.js';
import type { StateEngineOutput } from '../state-engine/state-update-result.js';
import type { ResponseClassificationResult } from '../classification/classification-result.js';
import type { PerceptionBundle } from '../perception/perception-bundle.js';
import type { ActivityContext } from '../classification/classification-types.js';

// ── Input types ────────────────────────────────────────────────────────────────

/** Per-item context for the current target item. */
export interface CurrentItemContext {
  itemId: string;
  /** null if item has never been seen before (first session). */
  masteryRecord: MasteryRecord | null;
  /** True if review_due_at has passed for this item. */
  isReviewDue: boolean;
}

/** Minimal info about each item available in the current session. */
export interface AvailableItem {
  itemId: string;
  masteryRecord: MasteryRecord | null;
  isCurrentItem: boolean;
}

/** An item in the review queue, ordered by priority. */
export interface ReviewQueueItem {
  itemId: string;
  masteryLevel: MasteryLevel;
  reviewDueAt: string | null; // ISO 8601
  priority: number; // 1 = highest priority
}

/** Full input contract for the Learning Engine (Phase 5). */
export interface LearningEngineInput {
  sessionMemory: SessionMemory;
  stateEngineOutput: StateEngineOutput;
  classificationResult: ResponseClassificationResult;
  perceptionBundle: PerceptionBundle;
  currentActivityContext: ActivityContext;
  currentItemContext: CurrentItemContext;
  availableActivities: ActivityType[];
  availableItems: AvailableItem[];
  reviewQueue?: ReviewQueueItem[];
  timestamp: string; // ISO 8601
}

// ── Output types ───────────────────────────────────────────────────────────────

/**
 * Mastery update candidate produced by the mastery engine.
 * Phase 5: computed only — not persisted. Persistence happens at session end (Phase 3).
 */
export interface MasteryUpdateCandidate {
  itemId: string;
  itemType: 'vocabulary' | 'pattern';
  proposedLevel: MasteryLevel;
  evidence: string[];
  /** True when evidence is strong enough to persist at session end. */
  eligibleForPersistence: boolean;
  blockedReasons: string[];
}

/** Review schedule candidate. Phase 5: computed only — not persisted. */
export interface ReviewScheduleCandidate {
  itemId: string;
  reviewType: 'same_session_review' | 'next_lesson_review' | 'weekly_review';
  /** Unix timestamp (ms) when review is due. */
  scheduledForMs: number;
  priority: number; // 1 = highest
  reasons: string[];
}

// ── Internal intermediate types ────────────────────────────────────────────────

/** Result of the easiest-win selector. */
export interface EasiestWinResult {
  /** null = use current item with cold-start floor. */
  itemId: string | null;
  activityType: ActivityType;
  isColdStart: boolean;
  coldStartLevel: 1 | 2 | 3;
  stayOnCurrentItem: boolean;
}

/** Internal output of the progression rule engine. */
export interface ProgressionOutcome {
  ruleFired: string;
  decisionType: LearningDecisionType;
  shouldStayOnCurrentItem: boolean;
  shouldAdvanceItem: boolean;
  shouldReview: boolean;
  shouldTriggerRecovery: boolean;
  shouldTriggerEasiestWin: boolean;
  /** Target item id for advancement; undefined = stay on current. */
  nextItemId: string | undefined;
  /** Demand-level delta for activity selection: -2, -1, 0, +1. */
  demandLevelDelta: number;
  /** Overall difficulty delta: negative = easier, positive = harder. */
  difficultyDelta: number;
  reasons: string[];
}

/** Internal decision from the session completion engine. */
export interface SessionCloseDecision {
  shouldClose: boolean;
  closeType: 'safety' | 'emotional' | 'timeout' | 'engagement';
  decisionType: LearningDecisionType;
  teacherAction: TeacherActionCode;
  reasons: string[];
}

/** Pre-computed engine-scale signals for use by all sub-engines. */
export interface DerivedSignals {
  frustration: number;            // 0–100
  engagement: number;             // 0–100
  activityFatigue: number;        // 0–100
  stamina: number;                // 0–100
  prodConf: number;               // 0–100
  compConf: number;               // 0–100
  emotionalSafety: number;        // 0–100
  consecutiveCorrect: number;
  consecutiveWrong: number;
  consecutiveSameActivity: number;
  noResponseCountLast3: number;
  sessionElapsedSeconds: number;
  label: ClassificationLabel;
  currentActivity: ActivityType;
  lessonPhase: LessonPhase;
  recoveryState: RecoveryState;
}

// Re-export types needed by consumers (avoids forcing them to know internals)
export type { SessionMemory, StateEngineOutput, ResponseClassificationResult, PerceptionBundle, ActivityContext };
