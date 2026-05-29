import type { SessionMemory } from '../contracts/session-memory.js';
import type { ChildState } from '../state/child-state.js';
import type { ItemState } from '../state/item-state.js';
import type { TurnRecord } from '../contracts/turn-record.js';
import type { CostCounters } from '../shared/types.js';
import { RecoveryState } from '../shared/enums.js';
import { recalculateSuccessFailureCounts } from './turn-history-updater.js';

/**
 * Assembles an updated SessionMemory from all the sub-module results.
 * Returns a new SessionMemory — input is never mutated.
 *
 * Handles:
 * - ChildState replacement (with recalculated success/failure counts)
 * - ItemState Map update (immutable copy)
 * - TurnRecord history with updated counts
 * - CostCounters replacement
 * - turnNumber increment
 */
export function buildUpdatedSessionMemory(
  original: SessionMemory,
  updates: {
    updatedChildState: ChildState;
    targetItemId: string | null;
    updatedItemState: ItemState | null;
    newRecentTurns: TurnRecord[];
    newCostCounters: CostCounters;
    newRecoveryState: RecoveryState;
    newActivityId: string | null;
  },
  timestamp: string,
): SessionMemory {
  // Recalculate rolling success/failure counts from the appended turn history
  const { recentSuccessCount, recentFailureCount } = recalculateSuccessFailureCounts(
    updates.newRecentTurns,
  );

  const childStateWithCounts: ChildState = {
    ...updates.updatedChildState,
    recentSuccessCount,
    recentFailureCount,
  };

  // Immutably update itemState Map
  let newItemState: Map<string, ItemState>;
  if (updates.targetItemId !== null && updates.updatedItemState !== null) {
    newItemState = new Map(original.itemState);
    newItemState.set(updates.targetItemId, updates.updatedItemState);
  } else {
    newItemState = new Map(original.itemState);
  }

  return {
    ...original,
    childState: childStateWithCounts,
    recoveryState: updates.newRecoveryState,
    itemState: newItemState,
    recentTurns: updates.newRecentTurns,
    costCounters: updates.newCostCounters,
    currentActivityId: updates.newActivityId !== null
      ? (updates.newActivityId as SessionMemory['currentActivityId'])
      : original.currentActivityId,
    turnNumber: original.turnNumber + 1,
    updatedAt: timestamp,
  };
}
