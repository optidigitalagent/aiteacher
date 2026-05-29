import { RecoveryState } from '../shared/enums.js';
import { clampSessionScore } from '../shared/score.js';
import type { ChildState } from '../state/child-state.js';
import type { ConfidenceDeltas } from './state-engine-types.js';

/**
 * Applies immutable confidence and engagement deltas to ChildState.
 * Returns a new ChildState — input is never mutated.
 *
 * recentSuccessCount and recentFailureCount are NOT updated here;
 * they are recalculated from the turn history in session-memory-updater.ts
 * after the new TurnRecord is appended.
 */
export function applyChildStateDeltas(
  childState: ChildState,
  deltas: ConfidenceDeltas,
  newRecoveryState: RecoveryState,
): ChildState {
  return {
    comprehensionConfidence: clampSessionScore(childState.comprehensionConfidence + deltas.comprehensionDelta),
    productionConfidence: clampSessionScore(childState.productionConfidence + deltas.productionDelta),
    pronunciationConfidence: clampSessionScore(childState.pronunciationConfidence + deltas.pronunciationDelta),
    emotionalSafety: clampSessionScore(childState.emotionalSafety + deltas.emotionalSafetyDelta),
    engagementLevel: clampSessionScore(childState.engagementLevel + deltas.engagementDelta),
    frustrationRisk: clampSessionScore(childState.frustrationRisk + deltas.frustrationRiskDelta),
    sessionStamina: clampSessionScore(childState.sessionStamina + deltas.sessionStaminaDelta),
    activityFatigue: clampSessionScore(childState.activityFatigue + deltas.activityFatigueDelta),
    l1Dependency: clampSessionScore(childState.l1Dependency + deltas.l1DependencyDelta),
    noveltyNeed: clampSessionScore(childState.noveltyNeed + deltas.noveltyNeedDelta),
    refusalRisk: clampSessionScore(childState.refusalRisk + deltas.refusalRiskDelta),
    recoveryLevel: newRecoveryState,
    // success/failure counts are set by session-memory-updater after turn appended
    recentSuccessCount: childState.recentSuccessCount,
    recentFailureCount: childState.recentFailureCount,
  };
}

/** Creates the initial ChildState with spec-defined defaults (§7.1). */
export function createInitialChildState(productionConfidenceBaseline = 0.30): ChildState {
  return {
    comprehensionConfidence: 0.50,
    productionConfidence: productionConfidenceBaseline,
    pronunciationConfidence: 0.40,
    emotionalSafety: 0.75,
    engagementLevel: 0.65,
    frustrationRisk: 0.05,
    sessionStamina: 1.0,
    activityFatigue: 0.0,
    l1Dependency: 0.20,
    noveltyNeed: 0.0,
    refusalRisk: 0.0,
    recentSuccessCount: 0,
    recentFailureCount: 0,
    recoveryLevel: RecoveryState.NORMAL,
  };
}
