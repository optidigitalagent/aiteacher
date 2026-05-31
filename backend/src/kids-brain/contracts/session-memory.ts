import type { AgeBand, RecoveryState, LessonPhase, ActivityType } from '../shared/enums.js';
import type { TurnRecord } from './turn-record.js';
import type { ChildState } from '../state/child-state.js';
import type { ItemState } from '../state/item-state.js';
import type { AgeProfile, CostCounters } from '../shared/types.js';

/**
 * Full session memory stored in Redis (Patch 1 §1.2).
 * Key: `kids-brain:session:{sessionId}`
 * TTL: session duration + 15 minutes grace.
 *
 * mode is always "mentium_kids" — literal type enforces isolation from adult runtime.
 */
export interface SessionMemory {
  sessionId: string;
  userId: string;
  childId: string; // UUID reference only — no PII
  mode: 'mentium_kids'; // Literal type: never shared with adult runtime

  // Age profile snapshot (loaded from ChildProfile at session start)
  ageProfile: AgeProfile;
  ageBand: AgeBand;

  // Lesson position
  currentUnitId: string | null;
  currentActivityId: ActivityType | null;
  currentTargetItemId: string | null;
  currentItemAttemptCount: number;
  lessonPhase: LessonPhase;

  // Child's internal state
  childState: ChildState;
  recoveryState: RecoveryState;

  // Per-item state (for items in this session)
  itemState: Map<string, ItemState>;

  // History buffers
  recentTurns: TurnRecord[]; // Last 5 (circular buffer)
  activityHistory: ActivityType[]; // Last 10 events
  itemsAttempted: string[];
  itemsMastered: string[];
  recentPraisePhrases: string[]; // Last 3 used

  // L1 tracking
  l1AnchorUsedItems: string[];
  l1BudgetUsed: boolean;

  // Engagement signals
  playAlongCount: number;

  // Token / cost tracking (§14.3)
  costCounters: CostCounters;

  // Curriculum reference (Phase 10D)
  lessonId?: string | null;

  // Phase 11E: readiness handshake — false until first readiness phrase is confirmed.
  // Optional for backward compatibility with sessions created before Phase 11E.
  hasStartedFirstExercise?: boolean;

  // Autosave
  autosaveSequenceNumber: number; // Monotonic; increments on each write

  // Timing
  startedAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  sessionElapsedMs: number;
  turnNumber: number;
}
