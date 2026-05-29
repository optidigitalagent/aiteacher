import { ActivityType, LearningDecisionType, ClassificationLabel, TeacherActionCode } from '../shared/enums.js';
import type { DerivedSignals, ProgressionOutcome } from './learning-engine-types.js';
import {
  ACTIVITY_FATIGUE_SWITCH_E,
  ENGAGEMENT_LOW_E,
  ENGAGEMENT_MEDIUM_LOW_E,
  ENGAGEMENT_NOVELTY_ELAPSED_S,
  RULE_R70,
  RULE_R71,
  RULE_R72,
  RULE_OVEREXCITED,
} from './learning-constants.js';

/** Result of the engagement adaptation evaluation. */
export interface EngagementAdaptation {
  /** True when the engagement engine overrides progression with a switch/novelty action. */
  overridesProgression: boolean;
  adaptedOutcome: ProgressionOutcome | null;
}

/**
 * Evaluates engagement signals and returns adaptation adjustments (Phase 5 spec,
 * engagement-adaptation-engine.yaml, progression-rules.yaml R70–R82).
 *
 * Engagement is NOT excitement.
 * Adaptations are deterministic — no LLM involvement.
 */
export function computeEngagementAdaptation(
  signals: DerivedSignals,
  currentOutcome: ProgressionOutcome,
  currentActivityDurationSeconds: number,
): EngagementAdaptation {
  const {
    engagement,
    activityFatigue,
    consecutiveSameActivity,
    sessionElapsedSeconds,
    label,
    frustration,
  } = signals;

  // R70: switch on low engagement + consecutive same activity
  if (engagement < ENGAGEMENT_LOW_E && consecutiveSameActivity >= 3) {
    return {
      overridesProgression: true,
      adaptedOutcome: {
        ruleFired: RULE_R70,
        decisionType: LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
        shouldStayOnCurrentItem: true,
        shouldAdvanceItem: false,
        shouldReview: false,
        shouldTriggerRecovery: false,
        shouldTriggerEasiestWin: false,
        nextItemId: undefined,
        demandLevelDelta: -1,
        difficultyDelta: -1,
        reasons: [
          `R70: engagement ${engagement} < ${ENGAGEMENT_LOW_E} AND consecutive_same >= 3`,
          'Switch to adjacent activity type for novelty',
        ],
      },
    };
  }

  // R72: reduce challenge on high fatigue
  if (activityFatigue >= ACTIVITY_FATIGUE_SWITCH_E) {
    return {
      overridesProgression: true,
      adaptedOutcome: {
        ruleFired: RULE_R72,
        decisionType: LearningDecisionType.LOWER_DIFFICULTY,
        shouldStayOnCurrentItem: true,
        shouldAdvanceItem: false,
        shouldReview: false,
        shouldTriggerRecovery: false,
        shouldTriggerEasiestWin: false,
        nextItemId: undefined,
        demandLevelDelta: -1,
        difficultyDelta: -1,
        reasons: [
          `R72: activity_fatigue ${activityFatigue} >= ${ACTIVITY_FATIGUE_SWITCH_E}`,
          'High activity fatigue: reduce challenge to restore engagement',
        ],
      },
    };
  }

  // R82: activity max duration switch (3 minutes on same activity)
  if (currentActivityDurationSeconds >= 180) {
    return {
      overridesProgression: true,
      adaptedOutcome: {
        ruleFired: RULE_R72, // reuse R72 pattern for duration-based switch
        decisionType: LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
        shouldStayOnCurrentItem: true,
        shouldAdvanceItem: false,
        shouldReview: false,
        shouldTriggerRecovery: false,
        shouldTriggerEasiestWin: false,
        nextItemId: undefined,
        demandLevelDelta: 0,
        difficultyDelta: 0,
        reasons: [
          `R82: activity duration ${currentActivityDurationSeconds}s >= 180s`,
          'Switch activity for variety (young learner attention)',
        ],
      },
    };
  }

  // R71: insert novelty on medium-low engagement + long session
  if (engagement < ENGAGEMENT_MEDIUM_LOW_E && sessionElapsedSeconds >= ENGAGEMENT_NOVELTY_ELAPSED_S) {
    // Don't override progression — annotate with novelty flag only
    return {
      overridesProgression: false,
      adaptedOutcome: {
        ...currentOutcome,
        ruleFired: RULE_R71,
        reasons: [
          ...currentOutcome.reasons,
          `R71: engagement ${engagement} < ${ENGAGEMENT_MEDIUM_LOW_E} at ${sessionElapsedSeconds}s — novelty needed`,
        ],
      },
    };
  }

  // Overexcited: slow down to grounding task
  if (label === ClassificationLabel.OVEREXCITED) {
    return {
      overridesProgression: true,
      adaptedOutcome: {
        ruleFired: RULE_OVEREXCITED,
        decisionType: LearningDecisionType.LOWER_DIFFICULTY,
        shouldStayOnCurrentItem: true,
        shouldAdvanceItem: false,
        shouldReview: false,
        shouldTriggerRecovery: false,
        shouldTriggerEasiestWin: false,
        nextItemId: undefined,
        demandLevelDelta: -2,
        difficultyDelta: -2,
        reasons: [
          'Overexcited: switch to quieter, grounding activity (listen_and_point or forced_choice)',
          'Do NOT increase reward frequency',
        ],
      },
    };
  }

  // No engagement override needed
  return { overridesProgression: false, adaptedOutcome: null };
}

/**
 * Returns true when high engagement and consecutive success permit a slight
 * difficulty increase (engagement-adaptation-engine.yaml: increase_challenge).
 */
export function shouldIncreaseDifficulty(
  engagement: number,
  consecutiveCorrect: number,
  prodConf: number,
): boolean {
  return engagement >= 70 && consecutiveCorrect >= 2 && prodConf >= 65;
}

/**
 * Returns true when low engagement + high frustration should decrease challenge.
 */
export function shouldDecreaseDifficulty(
  engagement: number,
  frustration: number,
  consecutiveWrong: number,
): boolean {
  return engagement < 40 && (frustration >= 50 || consecutiveWrong >= 2);
}
