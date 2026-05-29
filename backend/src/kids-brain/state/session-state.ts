import type { LessonPhase, ActivityType, RecoveryState } from '../shared/enums.js';
import type { TurnRecord } from '../contracts/turn-record.js';
import type { ItemState } from './item-state.js';
import type { ChildState } from './child-state.js';

/**
 * Full session tracking state (runtime view).
 * Stored in Redis as part of SessionMemory (Patch 1).
 * Distinguished from ChildState (psychological scores) by including
 * lesson logistics: phase, activity history, item lists.
 */
export interface SessionState {
  // Lesson position
  lessonPhase: LessonPhase;
  currentItemId: string | null;
  currentItemAttemptCount: number;
  currentActivityId: ActivityType | null;

  // History
  activityHistory: ActivityType[]; // Last N events for variety guard
  itemsAttempted: string[];
  itemsMastered: string[];
  recentTurns: TurnRecord[]; // Last 5 turns (circular buffer)
  recentPraisePhrases: string[]; // Last 3 used (rotation guard)

  // L1 tracking
  l1AnchorUsedItems: string[];
  l1BudgetUsed: boolean;

  // Engagement signals
  playAlongCount: number;

  // Child's internal learning state
  childState: ChildState;
  recoveryState: RecoveryState;

  // Per-item states for items in this session
  itemStates: Map<string, ItemState>;

  // Session timing
  sessionStartTime: string; // ISO 8601
  sessionElapsedMs: number;
  turnNumber: number;
}
