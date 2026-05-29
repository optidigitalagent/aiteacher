import { ActivityType, LearningDecisionType } from '../shared/enums.js';
import type { ProgressionOutcome } from './learning-engine-types.js';
import { COMPREHENSION_FLOOR_E } from './learning-constants.js';

// ── Activity demand ladder (spec §9.1, activity-selection-engine.yaml) ──────────
// Index 0 = level 1 (lowest demand), index 7 = level 8 (highest demand).

const DEMAND_LADDER: ActivityType[] = [
  ActivityType.LISTEN_AND_POINT,             // level 1
  ActivityType.REPEAT_AFTER_ME,              // level 2
  ActivityType.FORCED_CHOICE_2,              // level 3
  ActivityType.FORCED_CHOICE_4,              // level 4
  ActivityType.SUPPORTED_PRODUCTION,         // level 5
  ActivityType.SENTENCE_FRAME_PRODUCTION,    // level 6
  ActivityType.SENTENCE_PRODUCTION,          // level 7
  ActivityType.REVIEW_PRODUCTION,            // level 8
];

const DEMAND_LADDER_MIN = 1;
const DEMAND_LADDER_MAX = 8;

/** Returns the 1-based demand level for an activity (1 = lowest). */
export function activityDemandLevel(activity: ActivityType): number {
  const idx = DEMAND_LADDER.indexOf(activity);
  return idx >= 0 ? idx + 1 : 1;
}

/** Returns the activity at a given 1-based demand level (clamped). */
export function activityAtLevel(level: number): ActivityType {
  const clamped = Math.max(DEMAND_LADDER_MIN, Math.min(DEMAND_LADDER_MAX, level));
  return DEMAND_LADDER[clamped - 1];
}

/**
 * Returns the highest demand activity whose confidence thresholds are met
 * by the current child state (spec §9.1, activity-selection-engine.yaml level conditions).
 */
export function highestFeasibleActivity(
  prodConf: number,
  compConf: number,
  frustration: number,
): ActivityType {
  if (prodConf >= 70 && compConf >= 70 && frustration < 70) {
    return ActivityType.SENTENCE_PRODUCTION;
  }
  if (prodConf >= 60 && compConf >= 65) {
    return ActivityType.SENTENCE_FRAME_PRODUCTION;
  }
  if (prodConf >= 45 && compConf >= 60) {
    return ActivityType.SUPPORTED_PRODUCTION;
  }
  if (compConf >= 55) {
    return ActivityType.FORCED_CHOICE_4;
  }
  if (compConf >= 40) {
    return ActivityType.FORCED_CHOICE_2;
  }
  if (compConf >= 30) {
    return ActivityType.REPEAT_AFTER_ME;
  }
  return ActivityType.LISTEN_AND_POINT;
}

/**
 * Selects the next activity given a progression outcome and current performance signals.
 *
 * Rules:
 * - TRIGGER_EASIEST_WIN → handled by caller (easiest-win-selector)
 * - TRIGGER_REVIEW → REVIEW_PRODUCTION (demand matched to mastery by caller)
 * - ADVANCE_ACTIVITY → one level up, capped at highest feasible
 * - ADVANCE_ITEM → reset to feasible level for new item (usually level 2–3)
 * - SCAFFOLD_CURRENT_ITEM → one level down
 * - LOWER_DIFFICULTY → two levels down
 * - REPEAT_CURRENT_ACTIVITY / STAY_CURRENT_ITEM / HOLD_UNCERTAIN → same activity
 * - CLOSE_* → same activity (session ending)
 */
export function selectNextActivity(
  outcome: ProgressionOutcome,
  currentActivity: ActivityType,
  prodConf: number,
  compConf: number,
  frustration: number,
): ActivityType {
  const currentLevel = activityDemandLevel(currentActivity);

  switch (outcome.decisionType) {
    case LearningDecisionType.ADVANCE_ACTIVITY: {
      // Move up but only to the highest feasible activity
      const proposed = activityAtLevel(currentLevel + 1);
      const feasible = highestFeasibleActivity(prodConf, compConf, frustration);
      const feasibleLevel = activityDemandLevel(feasible);
      return activityAtLevel(Math.min(currentLevel + 1, feasibleLevel));
    }

    case LearningDecisionType.ADVANCE_ITEM:
      // Reset to introduction level for new item (repeat_after_me or forced_choice_2)
      return compConf >= 40 ? ActivityType.FORCED_CHOICE_2 : ActivityType.REPEAT_AFTER_ME;

    case LearningDecisionType.SCAFFOLD_CURRENT_ITEM:
      return activityAtLevel(currentLevel - 1);

    case LearningDecisionType.LOWER_DIFFICULTY:
      // demandLevelDelta carries exact steps (-1 or -2); default to -2 for lower_difficulty
      return activityAtLevel(currentLevel + (outcome.demandLevelDelta !== 0 ? outcome.demandLevelDelta : -2));

    case LearningDecisionType.TRIGGER_REVIEW:
      return ActivityType.REVIEW_PRODUCTION;

    case LearningDecisionType.TRIGGER_EASIEST_WIN:
    case LearningDecisionType.CONTINUE_RECOVERY:
      // Easiest-win/recovery activities are at low demand to guarantee success
      return ActivityType.FORCED_CHOICE_2;

    case LearningDecisionType.REPAIRED_SUCCESS:
      // After recovery success, stay on current; slight upward move only if safe
      return currentActivity;

    case LearningDecisionType.CLOSE_SAFETY:
    case LearningDecisionType.CLOSE_TIMEOUT:
    case LearningDecisionType.CLOSE_SUCCESS:
      return currentActivity;

    case LearningDecisionType.REPEAT_CURRENT_ACTIVITY:
    case LearningDecisionType.STAY_CURRENT_ITEM:
    case LearningDecisionType.HOLD_UNCERTAIN:
    default:
      return currentActivity;
  }
}

/**
 * Checks whether advancing from one activity to another is permitted
 * per the global forbidden transition rules (spec §8.3).
 */
export function isAdvanceForbidden(
  frustration: number,
  consecutiveCorrect: number,
  compConf: number,
): boolean {
  if (frustration > 70) return true;
  if (consecutiveCorrect < 2) return true;
  if (compConf < COMPREHENSION_FLOOR_E) return true;
  return false;
}
