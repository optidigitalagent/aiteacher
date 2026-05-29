/**
 * Engagement is modelled conservatively — do not infer too much from one signal.
 * Updates: engagementLevel, noveltyNeed, activityFatigue, sessionStamina (§Phase 4).
 *
 * Note: per Phase 4 spec, engagement deltas are computed inside confidence-updater.ts
 * as part of the unified ConfidenceDeltas. This file provides helpers for engagement
 * signals that require session-level context (activity repetition counting, stamina decay).
 */

import type { SessionMemory } from '../contracts/session-memory.js';
import type { ActivityContext } from '../classification/classification-types.js';
import { clampSessionScore } from '../shared/score.js';
import { engineToSessionScore } from '../shared/score.js';

// Stamina decay per turn (base rate from §7.1: 0.05 per minute; approx per turn)
const STAMINA_BASE_DECAY_PER_TURN = engineToSessionScore(1); // 1/100 per turn ≈ 0.01

/**
 * Computes the session-stamina decay for this turn based on child state signals.
 * §7.1: 0.05 per minute base | ×1.5 if emotional_safety < 0.50 | ×0.8 if engagement ≥ 0.75
 */
export function computeStaminaDelta(
  emotionalSafety: number,
  engagementLevel: number,
): number {
  let rate = STAMINA_BASE_DECAY_PER_TURN;
  if (emotionalSafety < 0.50) rate *= 1.5;
  if (engagementLevel >= 0.75) rate *= 0.8;
  return -clampSessionScore(rate); // stamina decreases
}

/**
 * Determines if the activity switched compared to the previous activity in session.
 */
export function activityDidSwitch(
  sessionMemory: SessionMemory,
  activityContext: ActivityContext,
): boolean {
  return (
    sessionMemory.currentActivityId !== null &&
    activityContext.activityId !== sessionMemory.currentActivityId
  );
}

/**
 * Counts how many consecutive turns in activityHistory used the same activity type.
 * Used for the §7.1 "same activity type 3×" engagement penalty.
 */
export function consecutiveSameActivityCount(
  activityHistory: readonly string[],
  currentActivityId: string,
): number {
  let count = 1; // include current turn
  for (let i = activityHistory.length - 1; i >= 0; i--) {
    if (activityHistory[i] === currentActivityId) count++;
    else break;
  }
  return count;
}
