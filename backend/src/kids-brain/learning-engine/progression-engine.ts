import { ClassificationLabel, ActivityType, LessonPhase, LearningDecisionType, TeacherActionCode, RecoveryState } from '../shared/enums.js';
import type { TurnRecord } from '../contracts/turn-record.js';
import type { DerivedSignals, ProgressionOutcome, ReviewQueueItem } from './learning-engine-types.js';
import {
  RULE_R10, RULE_R11, RULE_R20, RULE_R21, RULE_R22,
  RULE_R30, RULE_R31, RULE_R32,
  RULE_R40, RULE_R41, RULE_R42, RULE_R43,
  RULE_R50, RULE_R51, RULE_R52,
  RULE_R60, RULE_R61,
  RULE_R70, RULE_R71, RULE_R72,
  RULE_R80, RULE_R81,
  RULE_REFUSAL, RULE_REPAIRED_SUCCESS, RULE_L1_PRODUCTION_GAP,
  RULE_I_DONT_KNOW, RULE_SILENCE_SHORT, RULE_DEFAULT_STAY,
  ADVANCE_CONSECUTIVE_CORRECT, ADVANCE_CONSECUTIVE_CORRECT_TRIPLE,
  ADVANCE_PROD_MIN, ADVANCE_COMP_MIN,
  ADVANCE_PROD_MIN_HIGH, ADVANCE_COMP_MIN_HIGH,
  ADVANCE_FRUSTRATION_MAX, ADVANCE_FRUSTRATION_MAX_STRICT,
  SCAFFOLD_CONSECUTIVE_WRONG,
  LOWER_CONSECUTIVE_WRONG,
  NO_RESPONSE_STOP_COUNT,
  FRUSTRATION_SCAFFOLD_E, FRUSTRATION_EASIEST_WIN_E,
  ENGAGEMENT_LOW_E,
  COMPREHENSION_FLOOR_E,
  IMITATION_ONLY_SCAFFOLD_COUNT,
} from './learning-constants.js';

// ── Classification group sets ──────────────────────────────────────────────────

const CORRECT_GROUP = new Set<ClassificationLabel>([
  ClassificationLabel.CORRECT_CONFIDENT,
  ClassificationLabel.CORRECT_HESITANT,
  ClassificationLabel.NEAR_CORRECT,
  ClassificationLabel.PRONUNCIATION_VARIANT,
]);

const WRONG_GROUP = new Set<ClassificationLabel>([
  ClassificationLabel.WRONG_SEMANTIC,
  ClassificationLabel.WRONG_BUT_RELATED,
  ClassificationLabel.RANDOM_NONSENSE,
  ClassificationLabel.PLAYFUL_NONSENSE,
  ClassificationLabel.AVOIDANCE_NONSENSE,
]);

const SILENCE_GROUP = new Set<ClassificationLabel>([
  ClassificationLabel.SILENCE_SHORT,
  ClassificationLabel.SILENCE_MEDIUM,
  ClassificationLabel.SILENCE_LONG,
  ClassificationLabel.NO_RESPONSE,
]);

const PRODUCTION_ACTIVITIES = new Set<ActivityType>([
  ActivityType.SUPPORTED_PRODUCTION,
  ActivityType.SENTENCE_FRAME_PRODUCTION,
  ActivityType.SENTENCE_PRODUCTION,
]);

// ── Signal helpers (exported for test verification) ──────────────────────────

/**
 * Counts consecutive turns from the end where wasSuccess === true.
 * Silence labels with wasSuccess=false break the streak (they're not wins).
 */
export function computeConsecutiveCorrect(turns: TurnRecord[]): number {
  let count = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].wasSuccess) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Counts consecutive turns from the end where the label is in WRONG_GROUP.
 * Silence and L1 labels do NOT count as wrong (they break the streak).
 */
export function computeConsecutiveWrong(turns: TurnRecord[]): number {
  let count = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (WRONG_GROUP.has(turns[i].classificationLabel)) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Counts consecutive turns from end where activity matches the given activity.
 */
export function computeConsecutiveSameActivity(
  turns: TurnRecord[],
  currentActivityId: string,
): number {
  let count = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    if ((turns[i].activityId as string) === currentActivityId) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/** Counts occurrences of a label in the last n turns. */
export function countLabelInLastN(
  turns: TurnRecord[],
  label: ClassificationLabel,
  n: number,
): number {
  return turns.slice(-n).filter((t) => t.classificationLabel === label).length;
}

/** Returns the last N classification labels from turn history. */
export function lastNLabels(turns: TurnRecord[], n: number): ClassificationLabel[] {
  return turns.slice(-n).map((t) => t.classificationLabel);
}

/** Returns consecutive counts of imitation_only from the end. */
function consecutiveImitationOnly(turns: TurnRecord[]): number {
  let count = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].classificationLabel === ClassificationLabel.REPEATED_AFTER_MODEL) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ── Core progression rule engine ──────────────────────────────────────────────

/**
 * Evaluates progression rules in priority order (first match wins).
 * Rules are from progression-rules.yaml R10–R82 (R01–R03 handled by session-completion-engine).
 *
 * Priority order matches Phase 5 spec (items 4–11):
 * 4. Refusal recovery
 * 5. Frustration recovery
 * 6. Repeated failure recovery (handled in main engine before this function)
 * 7. Easiest win
 * 8. Uncertainty hold
 * 9. Review due
 * 10. Mastery/progression advance
 * 11. Normal practice
 */
export function computeProgressionDecision(
  signals: DerivedSignals,
  recentTurns: TurnRecord[],
  reviewQueue: ReviewQueueItem[],
): ProgressionOutcome {
  const {
    label,
    frustration,
    engagement,
    consecutiveCorrect,
    consecutiveWrong,
    lessonPhase,
    currentActivity,
    prodConf,
    compConf,
    activityFatigue,
    sessionElapsedSeconds,
    recoveryState,
  } = signals;

  // ── R10: Frustration easiest win ─────────────────────────────────────────────
  if (frustration >= FRUSTRATION_EASIEST_WIN_E &&
      (lessonPhase === LessonPhase.PRACTICE || lessonPhase === LessonPhase.CONSOLIDATION)) {
    return {
      ruleFired: RULE_R10,
      decisionType: LearningDecisionType.TRIGGER_EASIEST_WIN,
      shouldStayOnCurrentItem: false,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: true,
      nextItemId: undefined,
      demandLevelDelta: -2,
      difficultyDelta: -2,
      reasons: [`R10: frustration ${frustration} >= ${FRUSTRATION_EASIEST_WIN_E} in ${lessonPhase}`],
    };
  }

  // ── Refusal recovery ──────────────────────────────────────────────────────────
  if (label === ClassificationLabel.REFUSAL || label === ClassificationLabel.L1_REFUSAL) {
    return {
      ruleFired: RULE_REFUSAL,
      decisionType: LearningDecisionType.CONTINUE_RECOVERY,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: true,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: -1,
      difficultyDelta: -1,
      reasons: ['Refusal detected — backing off, offering choice (no advance)'],
    };
  }

  // ── Repaired success ──────────────────────────────────────────────────────────
  if (recoveryState === RecoveryState.REPAIRED_SUCCESS) {
    return {
      ruleFired: RULE_REPAIRED_SUCCESS,
      decisionType: LearningDecisionType.REPAIRED_SUCCESS,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: 0,
      difficultyDelta: 0,
      reasons: ['Repaired success state — warm praise, no new challenges yet'],
    };
  }

  // ── L1 translation: production gap ────────────────────────────────────────────
  if (label === ClassificationLabel.L1_TRANSLATION || label === ClassificationLabel.L1_HELP_REQUEST) {
    return {
      ruleFired: RULE_L1_PRODUCTION_GAP,
      decisionType: LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: -1,
      difficultyDelta: -1,
      reasons: ['L1 translation/help — comprehension present, scaffold to English production'],
    };
  }

  // ── i_dont_know: scaffold not punishment ─────────────────────────────────────
  if (label === ClassificationLabel.I_DONT_KNOW) {
    return {
      ruleFired: RULE_I_DONT_KNOW,
      decisionType: LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: -1,
      difficultyDelta: -1,
      reasons: ["i_dont_know — scaffold with support, no punishment, no shame"],
    };
  }

  // ── Silence short: hold without punishment ────────────────────────────────────
  if (label === ClassificationLabel.SILENCE_SHORT) {
    return {
      ruleFired: RULE_SILENCE_SHORT,
      decisionType: LearningDecisionType.HOLD_UNCERTAIN,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: 0,
      difficultyDelta: 0,
      reasons: ['silence_short — wait, no punishment, no failure signal'],
    };
  }

  // ── R80: off-task no mastery update ──────────────────────────────────────────
  if (label === ClassificationLabel.DISTRACTION || label === ClassificationLabel.OFF_TOPIC_STORY) {
    return {
      ruleFired: RULE_R80,
      decisionType: LearningDecisionType.STAY_CURRENT_ITEM,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: 0,
      difficultyDelta: 0,
      reasons: ['R80: off-task — stay on current, no mastery update'],
    };
  }

  // ── R61: Review due (warm_up or consolidation phase) ─────────────────────────
  if (
    (lessonPhase === LessonPhase.WARM_UP || lessonPhase === LessonPhase.CONSOLIDATION) &&
    reviewQueue.length > 0
  ) {
    return {
      ruleFired: RULE_R61,
      decisionType: LearningDecisionType.TRIGGER_REVIEW,
      shouldStayOnCurrentItem: false,
      shouldAdvanceItem: false,
      shouldReview: true,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: reviewQueue[0].itemId,
      demandLevelDelta: 0,
      difficultyDelta: 0,
      reasons: [`R61: review due in ${lessonPhase} — highest priority: ${reviewQueue[0].itemId}`],
    };
  }

  // ── R11 check: if frustration >= 60, advance is forbidden ────────────────────
  const advanceForbiddenByFrustration = frustration >= FRUSTRATION_SCAFFOLD_E;

  // ── R20/R21/R22: Advance rules ────────────────────────────────────────────────

  // R20: triple correct_confident + confidence thresholds
  if (!advanceForbiddenByFrustration) {
    const last3 = lastNLabels(recentTurns, 3);
    const allTripleConfident =
      last3.length === 3 &&
      last3.every((l) => l === ClassificationLabel.CORRECT_CONFIDENT);
    if (
      allTripleConfident &&
      consecutiveCorrect >= ADVANCE_CONSECUTIVE_CORRECT_TRIPLE &&
      prodConf >= ADVANCE_PROD_MIN &&
      compConf >= ADVANCE_COMP_MIN
    ) {
      return {
        ruleFired: RULE_R20,
        decisionType: LearningDecisionType.ADVANCE_ACTIVITY,
        shouldStayOnCurrentItem: true,
        shouldAdvanceItem: false,
        shouldReview: false,
        shouldTriggerRecovery: false,
        shouldTriggerEasiestWin: false,
        nextItemId: undefined,
        demandLevelDelta: +1,
        difficultyDelta: +1,
        reasons: [`R20: triple correct_confident, prod=${prodConf}, comp=${compConf}`],
      };
    }

    // R21: double correct_confident + higher confidence thresholds
    const last2 = lastNLabels(recentTurns, 2);
    const doubleConfident =
      last2.length === 2 &&
      last2.every((l) => l === ClassificationLabel.CORRECT_CONFIDENT);
    if (
      doubleConfident &&
      consecutiveCorrect >= ADVANCE_CONSECUTIVE_CORRECT &&
      prodConf >= ADVANCE_PROD_MIN_HIGH &&
      compConf >= ADVANCE_COMP_MIN_HIGH &&
      frustration < ADVANCE_FRUSTRATION_MAX_STRICT
    ) {
      return {
        ruleFired: RULE_R21,
        decisionType: LearningDecisionType.ADVANCE_ACTIVITY,
        shouldStayOnCurrentItem: true,
        shouldAdvanceItem: false,
        shouldReview: false,
        shouldTriggerRecovery: false,
        shouldTriggerEasiestWin: false,
        nextItemId: undefined,
        demandLevelDelta: +1,
        difficultyDelta: +1,
        reasons: [`R21: double correct_confident, prod=${prodConf}, comp=${compConf}`],
      };
    }

    // R22: advance to next item after sentence_production mastery
    if (
      currentActivity === ActivityType.SENTENCE_PRODUCTION &&
      doubleConfident &&
      consecutiveCorrect >= ADVANCE_CONSECUTIVE_CORRECT &&
      prodConf >= ADVANCE_PROD_MIN_HIGH
    ) {
      return {
        ruleFired: RULE_R22,
        decisionType: LearningDecisionType.ADVANCE_ITEM,
        shouldStayOnCurrentItem: false,
        shouldAdvanceItem: true,
        shouldReview: false,
        shouldTriggerRecovery: false,
        shouldTriggerEasiestWin: false,
        nextItemId: undefined, // caller determines next item from availableItems
        demandLevelDelta: -3, // reset to introduction level for new item
        difficultyDelta: +1,
        reasons: [`R22: sentence_production mastered, advancing to next item`],
      };
    }
  }

  // ── R30: Stay on correct_hesitant ────────────────────────────────────────────
  if (label === ClassificationLabel.CORRECT_HESITANT && consecutiveCorrect < 3) {
    return {
      ruleFired: RULE_R30,
      decisionType: LearningDecisionType.STAY_CURRENT_ITEM,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: 0,
      difficultyDelta: 0,
      reasons: [`R30: correct_hesitant, consecutive_correct=${consecutiveCorrect} < 3`],
    };
  }

  // ── R31: Stay on correct_prompted (repeated_after_model maps to this) ─────────
  if (label === ClassificationLabel.REPEATED_AFTER_MODEL) {
    // R81: if imitation_only >= 3 consecutive, scaffold
    const imitationCount = consecutiveImitationOnly(recentTurns);
    if (imitationCount >= IMITATION_ONLY_SCAFFOLD_COUNT) {
      return {
        ruleFired: RULE_R81,
        decisionType: LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
        shouldStayOnCurrentItem: true,
        shouldAdvanceItem: false,
        shouldReview: false,
        shouldTriggerRecovery: false,
        shouldTriggerEasiestWin: false,
        nextItemId: undefined,
        demandLevelDelta: -1,
        difficultyDelta: -1,
        reasons: [`R81: imitation_only x${imitationCount} — need comprehension check`],
      };
    }
    return {
      ruleFired: RULE_R31,
      decisionType: LearningDecisionType.STAY_CURRENT_ITEM,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: 0,
      difficultyDelta: 0,
      reasons: ['R31: repeated_after_model/correct_prompted — stay, no advance credit'],
    };
  }

  // ── R32: Repeat after partial_correct in sentence activities ─────────────────
  if (
    label === ClassificationLabel.PARTIAL_ANSWER &&
    PRODUCTION_ACTIVITIES.has(currentActivity)
  ) {
    return {
      ruleFired: RULE_R32,
      decisionType: LearningDecisionType.REPEAT_CURRENT_ACTIVITY,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: 0,
      difficultyDelta: 0,
      reasons: ['R32: partial_correct in production activity — repeat'],
    };
  }

  // ── Near-correct: scaffold with confirmation ──────────────────────────────────
  if (label === ClassificationLabel.NEAR_CORRECT) {
    return {
      ruleFired: RULE_R30, // similar to hesitant
      decisionType: LearningDecisionType.STAY_CURRENT_ITEM,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: 0,
      difficultyDelta: 0,
      reasons: ['near_correct — recast and confirm, stay at current level'],
    };
  }

  // ── Correct confident (single, not enough for advance) ─────────────────────
  if (label === ClassificationLabel.CORRECT_CONFIDENT) {
    // Not enough consecutive for advance rules; just stay or scaffold
    return {
      ruleFired: RULE_R30,
      decisionType: LearningDecisionType.STAY_CURRENT_ITEM,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: 0,
      difficultyDelta: 0,
      reasons: ['correct_confident — stay (building toward advance threshold)'],
    };
  }

  // ── R52: triple wrong → lower to listen_and_point ─────────────────────────
  if (consecutiveWrong >= LOWER_CONSECUTIVE_WRONG) {
    return {
      ruleFired: RULE_R52,
      decisionType: LearningDecisionType.LOWER_DIFFICULTY,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: true,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: -6, // full reset to listen_and_point
      difficultyDelta: -3,
      reasons: [`R52: consecutive_wrong=${consecutiveWrong} >= ${LOWER_CONSECUTIVE_WRONG} — full reset`],
    };
  }

  // ── R50: no_response → lower (2 levels) ─────────────────────────────────────
  if (
    label === ClassificationLabel.NO_RESPONSE ||
    label === ClassificationLabel.SILENCE_LONG
  ) {
    return {
      ruleFired: RULE_R50,
      decisionType: LearningDecisionType.LOWER_DIFFICULTY,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: true,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: -2,
      difficultyDelta: -2,
      reasons: [`R50: ${label} — demand too high, lower 2 levels`],
    };
  }

  // ── R51: wrong_random → lower (1 level) ─────────────────────────────────────
  if (label === ClassificationLabel.RANDOM_NONSENSE || label === ClassificationLabel.AVOIDANCE_NONSENSE) {
    return {
      ruleFired: RULE_R51,
      decisionType: LearningDecisionType.LOWER_DIFFICULTY,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: -1,
      difficultyDelta: -1,
      reasons: [`R51: ${label} — lower 1 level, re-present with support`],
    };
  }

  // ── R41: scaffold on double_wrong ────────────────────────────────────────────
  if (consecutiveWrong >= SCAFFOLD_CONSECUTIVE_WRONG) {
    return {
      ruleFired: RULE_R41,
      decisionType: LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: -1,
      difficultyDelta: -1,
      reasons: [`R41: consecutive_wrong=${consecutiveWrong} >= ${SCAFFOLD_CONSECUTIVE_WRONG}`],
    };
  }

  // ── R42: scaffold on comprehension below threshold in production activity ─────
  if (PRODUCTION_ACTIVITIES.has(currentActivity) && compConf < COMPREHENSION_FLOOR_E) {
    return {
      ruleFired: RULE_R42,
      decisionType: LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: -2, // drop to forced_choice
      difficultyDelta: -2,
      reasons: [`R42: comp_conf=${compConf} < ${COMPREHENSION_FLOOR_E} in production activity`],
    };
  }

  // ── R40: scaffold on wrong_semantic ──────────────────────────────────────────
  if (label === ClassificationLabel.WRONG_SEMANTIC || label === ClassificationLabel.WRONG_BUT_RELATED) {
    return {
      ruleFired: RULE_R40,
      decisionType: LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: -1,
      difficultyDelta: -1,
      reasons: [`R40: ${label} — meaning confusion, scaffold one level down`],
    };
  }

  // ── Playful nonsense: brief play then redirect ────────────────────────────────
  if (label === ClassificationLabel.PLAYFUL_NONSENSE) {
    return {
      ruleFired: RULE_R80,
      decisionType: LearningDecisionType.STAY_CURRENT_ITEM,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: 0,
      difficultyDelta: 0,
      reasons: ['playful_nonsense — play along briefly then redirect (1 turn max)'],
    };
  }

  // ── Silence medium ────────────────────────────────────────────────────────────
  if (label === ClassificationLabel.SILENCE_MEDIUM) {
    return {
      ruleFired: RULE_R50,
      decisionType: LearningDecisionType.SCAFFOLD_CURRENT_ITEM,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      nextItemId: undefined,
      demandLevelDelta: -1,
      difficultyDelta: -1,
      reasons: ['silence_medium — offer scaffold/hint warmly'],
    };
  }

  // ── Default: stay ─────────────────────────────────────────────────────────────
  return {
    ruleFired: RULE_DEFAULT_STAY,
    decisionType: LearningDecisionType.STAY_CURRENT_ITEM,
    shouldStayOnCurrentItem: true,
    shouldAdvanceItem: false,
    shouldReview: false,
    shouldTriggerRecovery: false,
    shouldTriggerEasiestWin: false,
    nextItemId: undefined,
    demandLevelDelta: 0,
    difficultyDelta: 0,
    reasons: ['No specific rule matched — default stay on current item'],
  };
}

/**
 * Checks the global forbidden transition: advance is forbidden when:
 * - frustration > 70
 * - consecutive_correct < 2
 * - comprehension_confidence < 35
 */
export function isAdvanceForbidden(
  frustration: number,
  consecutiveCorrect: number,
  compConf: number,
): boolean {
  return frustration > 70 || consecutiveCorrect < 2 || compConf < COMPREHENSION_FLOOR_E;
}
