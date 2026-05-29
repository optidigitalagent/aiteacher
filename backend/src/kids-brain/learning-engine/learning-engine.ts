/**
 * Learning Engine — main orchestrator (Phase 5).
 *
 * Deterministic. No LLM calls. No persistence. No production runtime wiring.
 * Consumes StateEngineOutput + classification + perception and returns LearningDecision.
 *
 * Priority order (spec Phase 5):
 * 1. Safety close
 * 2. Emotional shutdown close
 * 3. Timeout / cap close
 * 4. Refusal recovery
 * 5. Frustration recovery
 * 6. Repeated failure recovery
 * 7. Easiest win
 * 8. Uncertainty hold
 * 9. Review due
 * 10. Mastery / progression advance
 * 11. Normal practice continuation
 */

import { randomUUID } from 'crypto';
import {
  ClassificationLabel,
  ActivityType,
  LearningDecisionType,
  TeacherActionCode,
  RecoveryState,
  LogSeverity,
} from '../shared/enums.js';
import { sessionToEngineScore } from '../shared/score.js';
import { LOG_EVENTS } from '../shared/log-events.js';
import type { LogEvent, LogEventName } from '../shared/log-events.js';
import type { TurnRecord } from '../contracts/turn-record.js';
import type {
  LearningEngineInput,
  DerivedSignals,
  ProgressionOutcome,
} from './learning-engine-types.js';
import { buildLearningDecision } from './learning-decision.js';
import type { LearningDecision, BuildDecisionParams } from './learning-decision.js';
import {
  computeProgressionDecision,
  computeConsecutiveCorrect,
  computeConsecutiveWrong,
  computeConsecutiveSameActivity,
  countLabelInLastN,
} from './progression-engine.js';
import { computeMasteryUpdateCandidate } from './mastery-engine.js';
import { computeReviewCandidate } from './review-scheduler.js';
import { selectNextActivity } from './activity-selection-engine.js';
import { selectEasiestWin } from './easiest-win-selector.js';
import { computeEngagementAdaptation } from './engagement-adaptation-engine.js';
import { checkSessionClose } from './session-completion-engine.js';
import {
  RULE_SAFETY_CLOSE,
  RULE_EMOTIONAL_SHUTDOWN,
  RULE_REFUSAL,
  RULE_UNCERTAINTY_HOLD,
  LOWER_CONSECUTIVE_WRONG,
  FRUSTRATION_EASIEST_WIN_E,
} from './learning-constants.js';

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Runs the full Learning Engine for one turn and returns a LearningDecision.
 * Pure function — no side effects, no async, no LLM calls, no persistence.
 */
export function runLearningEngine(input: LearningEngineInput): LearningDecision {
  const logs: LogEvent[] = [];
  const decisionId = randomUUID();

  // Use state AFTER this turn's update (includes current turn in recentTurns)
  const updatedMemory = input.stateEngineOutput.updatedSessionMemory;
  const recentTurns = updatedMemory.recentTurns;

  // Compute engine-scale signals from session-scale child state
  const signals = computeDerivedSignals(input, recentTurns);

  logs.push(buildLog(LOG_EVENTS.LEARNING_DECISION_STARTED, updatedMemory.sessionId, updatedMemory.turnNumber, {
    label: signals.label,
    frustration: signals.frustration,
    engagement: signals.engagement,
    activityFatigue: signals.activityFatigue,
    stamina: signals.stamina,
    consecutiveCorrect: signals.consecutiveCorrect,
    consecutiveWrong: signals.consecutiveWrong,
    recoveryState: signals.recoveryState,
  }));

  // ── PRIORITY 1–3: Safety, emotional, timeout close ─────────────────────────

  const closeDecision = checkSessionClose(input, signals);
  if (closeDecision !== null) {
    logs.push(buildLog(LOG_EVENTS.SESSION_CLOSE_DECISION, updatedMemory.sessionId, updatedMemory.turnNumber, {
      closeType: closeDecision.closeType,
      decisionType: closeDecision.decisionType,
    }));

    // If close is triggered by timeout after failure, the decisionType may already be
    // TRIGGER_EASIEST_WIN (easiest_win-before-close pattern). Respect that.
    const masteryCandidate = computeMasteryUpdateCandidate(input, makeNullOutcome(closeDecision.decisionType));
    return buildLearningDecision({
      decisionId,
      sessionMemory: updatedMemory,
      decisionType: closeDecision.decisionType,
      nextTeacherActionCode: closeDecision.teacherAction,
      nextActivityType: signals.currentActivity,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: closeDecision.closeType === 'emotional',
      shouldTriggerEasiestWin: closeDecision.decisionType === LearningDecisionType.TRIGGER_EASIEST_WIN,
      shouldCloseSession: closeDecision.decisionType !== LearningDecisionType.TRIGGER_EASIEST_WIN,
      difficultyDelta: 0,
      masteryUpdateCandidate: masteryCandidate,
      reviewScheduleCandidate: null,
      reasons: closeDecision.reasons,
      priorityRuleFired: closeDecision.decisionType === LearningDecisionType.CLOSE_SAFETY
        ? RULE_SAFETY_CLOSE
        : RULE_EMOTIONAL_SHUTDOWN,
    });
  }

  // ── PRIORITY 4: Refusal recovery ────────────────────────────────────────────

  if (
    signals.label === ClassificationLabel.REFUSAL ||
    signals.label === ClassificationLabel.L1_REFUSAL ||
    signals.recoveryState === RecoveryState.REFUSAL
  ) {
    const easiestWin = selectEasiestWin(input, 'refusal');
    logs.push(buildLog(LOG_EVENTS.EASIEST_WIN_SELECTED, updatedMemory.sessionId, updatedMemory.turnNumber, {
      trigger: 'refusal',
      isColdStart: easiestWin.isColdStart,
    }));
    return buildLearningDecision({
      decisionId,
      sessionMemory: updatedMemory,
      decisionType: LearningDecisionType.CONTINUE_RECOVERY,
      nextTeacherActionCode: TeacherActionCode.BACK_OFF_OFFER_CHOICE,
      nextActivityType: easiestWin.activityType,
      nextTargetItemId: easiestWin.itemId ?? undefined,
      shouldStayOnCurrentItem: easiestWin.stayOnCurrentItem,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: true,
      shouldTriggerEasiestWin: false,
      shouldCloseSession: false,
      difficultyDelta: -2,
      masteryUpdateCandidate: null,
      reviewScheduleCandidate: null,
      reasons: ['Refusal behavior — backing off and offering choice'],
      priorityRuleFired: RULE_REFUSAL,
    });
  }

  // ── PRIORITY 5: Frustration recovery ────────────────────────────────────────

  if (signals.frustration >= FRUSTRATION_EASIEST_WIN_E) {
    const easiestWin = selectEasiestWin(input, 'frustration');
    logs.push(buildLog(LOG_EVENTS.EASIEST_WIN_SELECTED, updatedMemory.sessionId, updatedMemory.turnNumber, {
      trigger: 'frustration',
      isColdStart: easiestWin.isColdStart,
      coldStartLevel: easiestWin.coldStartLevel,
    }));
    return buildLearningDecision({
      decisionId,
      sessionMemory: updatedMemory,
      decisionType: LearningDecisionType.TRIGGER_EASIEST_WIN,
      nextTeacherActionCode: TeacherActionCode.GIVE_EASIEST_WIN,
      nextActivityType: easiestWin.activityType,
      nextTargetItemId: easiestWin.itemId ?? undefined,
      shouldStayOnCurrentItem: easiestWin.stayOnCurrentItem,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: true,
      shouldCloseSession: false,
      difficultyDelta: -2,
      masteryUpdateCandidate: null,
      reviewScheduleCandidate: null,
      reasons: [`Frustration ${signals.frustration} >= ${FRUSTRATION_EASIEST_WIN_E} — easiest win`],
      priorityRuleFired: 'R10_frustration_easiest_win',
    });
  }

  // ── PRIORITY 6: Repeated failure recovery ────────────────────────────────────

  if (signals.recoveryState === RecoveryState.REPEATED_FAILURE) {
    const easiestWin = selectEasiestWin(input, 'repeated_failure');
    logs.push(buildLog(LOG_EVENTS.EASIEST_WIN_SELECTED, updatedMemory.sessionId, updatedMemory.turnNumber, {
      trigger: 'repeated_failure',
      isColdStart: easiestWin.isColdStart,
    }));
    return buildLearningDecision({
      decisionId,
      sessionMemory: updatedMemory,
      decisionType: LearningDecisionType.TRIGGER_EASIEST_WIN,
      nextTeacherActionCode: TeacherActionCode.GIVE_EASIEST_WIN,
      nextActivityType: easiestWin.activityType,
      nextTargetItemId: easiestWin.itemId ?? undefined,
      shouldStayOnCurrentItem: easiestWin.stayOnCurrentItem,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: true,
      shouldCloseSession: false,
      difficultyDelta: -2,
      masteryUpdateCandidate: null,
      reviewScheduleCandidate: null,
      reasons: ['Repeated failure recovery state — inserting easiest win'],
      priorityRuleFired: 'R52_lower_on_triple_wrong',
    });
  }

  // ── PRIORITY 7: Easiest win standalone trigger (consecutive_wrong >= 3) ───────

  if (signals.consecutiveWrong >= LOWER_CONSECUTIVE_WRONG) {
    const easiestWin = selectEasiestWin(input, 'consecutive_wrong');
    logs.push(buildLog(LOG_EVENTS.EASIEST_WIN_SELECTED, updatedMemory.sessionId, updatedMemory.turnNumber, {
      trigger: 'consecutive_wrong',
      count: signals.consecutiveWrong,
      isColdStart: easiestWin.isColdStart,
    }));
    return buildLearningDecision({
      decisionId,
      sessionMemory: updatedMemory,
      decisionType: LearningDecisionType.TRIGGER_EASIEST_WIN,
      nextTeacherActionCode: TeacherActionCode.GIVE_EASIEST_WIN,
      nextActivityType: easiestWin.activityType,
      nextTargetItemId: easiestWin.itemId ?? undefined,
      shouldStayOnCurrentItem: easiestWin.stayOnCurrentItem,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: true,
      shouldCloseSession: false,
      difficultyDelta: -2,
      masteryUpdateCandidate: null,
      reviewScheduleCandidate: null,
      reasons: [`Consecutive wrong ${signals.consecutiveWrong} >= ${LOWER_CONSECUTIVE_WRONG} — easiest win before continuing`],
      priorityRuleFired: 'R52_lower_on_triple_wrong',
    });
  }

  // ── PRIORITY 8: Uncertainty hold ─────────────────────────────────────────────

  if (signals.label === ClassificationLabel.UNKNOWN_UNCERTAIN) {
    return buildLearningDecision({
      decisionId,
      sessionMemory: updatedMemory,
      decisionType: LearningDecisionType.HOLD_UNCERTAIN,
      nextTeacherActionCode: TeacherActionCode.HOLD_CURRENT_ITEM,
      nextActivityType: signals.currentActivity,
      shouldStayOnCurrentItem: true,
      shouldAdvanceItem: false,
      shouldReview: false,
      shouldTriggerRecovery: false,
      shouldTriggerEasiestWin: false,
      shouldCloseSession: false,
      difficultyDelta: 0,
      masteryUpdateCandidate: null,
      reviewScheduleCandidate: null,
      reasons: ['unknown_uncertain classification — holding without penalty'],
      priorityRuleFired: RULE_UNCERTAINTY_HOLD,
    });
  }

  // ── PRIORITY 9–11: Run full progression engine ────────────────────────────────

  let progressionOutcome = computeProgressionDecision(
    signals,
    recentTurns,
    input.reviewQueue ?? [],
  );

  // Check engagement adaptation — may override progression outcome
  // Use activity duration from session elapsed / activity history size as approximation
  const activityDurationEstimateS = Math.min(
    signals.sessionElapsedSeconds,
    updatedMemory.activityHistory.length * 30,
  );
  const engagementAdaptation = computeEngagementAdaptation(
    signals,
    progressionOutcome,
    activityDurationEstimateS,
  );
  if (engagementAdaptation.overridesProgression && engagementAdaptation.adaptedOutcome !== null) {
    progressionOutcome = engagementAdaptation.adaptedOutcome;
  }

  // Compute mastery candidate
  const masteryCandidate = computeMasteryUpdateCandidate(input, progressionOutcome);
  if (masteryCandidate !== null) {
    logs.push(buildLog(LOG_EVENTS.MASTERY_CANDIDATE_CREATED, updatedMemory.sessionId, updatedMemory.turnNumber, {
      itemId: masteryCandidate.itemId,
      proposedLevel: masteryCandidate.proposedLevel,
      eligibleForPersistence: masteryCandidate.eligibleForPersistence,
    }));
  }

  // Compute review candidate
  const reviewCandidate = computeReviewCandidate(input, progressionOutcome);
  if (reviewCandidate !== null) {
    logs.push(buildLog(LOG_EVENTS.REVIEW_CANDIDATE_CREATED, updatedMemory.sessionId, updatedMemory.turnNumber, {
      itemId: reviewCandidate.itemId,
      reviewType: reviewCandidate.reviewType,
      priority: reviewCandidate.priority,
    }));
  }

  // Select next activity
  const nextActivity = selectNextActivity(
    progressionOutcome,
    signals.currentActivity,
    signals.prodConf,
    signals.compConf,
    signals.frustration,
  );

  logs.push(buildLog(LOG_EVENTS.ACTIVITY_TRANSITION_SELECTED, updatedMemory.sessionId, updatedMemory.turnNumber, {
    from: signals.currentActivity,
    to: nextActivity,
    ruleFired: progressionOutcome.ruleFired,
  }));

  // Map progression outcome to teacher action
  const nextTeacherAction = deriveTeacherAction(progressionOutcome, signals.label);

  logs.push(buildLog(LOG_EVENTS.LEARNING_DECISION_MADE, updatedMemory.sessionId, updatedMemory.turnNumber, {
    decisionType: progressionOutcome.decisionType,
    ruleFired: progressionOutcome.ruleFired,
    nextActivity,
    shouldAdvanceItem: progressionOutcome.shouldAdvanceItem,
    shouldTriggerEasiestWin: progressionOutcome.shouldTriggerEasiestWin,
  }));

  return buildLearningDecision({
    decisionId,
    sessionMemory: updatedMemory,
    decisionType: progressionOutcome.decisionType,
    nextTeacherActionCode: nextTeacherAction,
    nextActivityType: nextActivity,
    nextTargetItemId: progressionOutcome.nextItemId,
    shouldStayOnCurrentItem: progressionOutcome.shouldStayOnCurrentItem,
    shouldAdvanceItem: progressionOutcome.shouldAdvanceItem,
    shouldReview: progressionOutcome.shouldReview,
    shouldTriggerRecovery: progressionOutcome.shouldTriggerRecovery,
    shouldTriggerEasiestWin: progressionOutcome.shouldTriggerEasiestWin,
    shouldCloseSession: false,
    difficultyDelta: progressionOutcome.difficultyDelta,
    masteryUpdateCandidate: masteryCandidate,
    reviewScheduleCandidate: reviewCandidate,
    reasons: progressionOutcome.reasons,
    priorityRuleFired: progressionOutcome.ruleFired,
  });
}

// ── Signal computation ─────────────────────────────────────────────────────────

function computeDerivedSignals(
  input: LearningEngineInput,
  recentTurns: TurnRecord[],
): DerivedSignals {
  const updatedMemory = input.stateEngineOutput.updatedSessionMemory;
  const childState = updatedMemory.childState;
  const currentActivityId = (input.currentActivityContext.activityId as ActivityType) ??
    updatedMemory.currentActivityId ??
    ActivityType.LISTEN_AND_POINT;

  return {
    frustration: sessionToEngineScore(childState.frustrationRisk),
    engagement: sessionToEngineScore(childState.engagementLevel),
    activityFatigue: sessionToEngineScore(childState.activityFatigue),
    stamina: sessionToEngineScore(childState.sessionStamina),
    prodConf: sessionToEngineScore(childState.productionConfidence),
    compConf: sessionToEngineScore(childState.comprehensionConfidence),
    emotionalSafety: sessionToEngineScore(childState.emotionalSafety),
    consecutiveCorrect: computeConsecutiveCorrect(recentTurns),
    consecutiveWrong: computeConsecutiveWrong(recentTurns),
    consecutiveSameActivity: computeConsecutiveSameActivity(recentTurns, input.currentActivityContext.activityId),
    noResponseCountLast3: countLabelInLastN(recentTurns, ClassificationLabel.NO_RESPONSE, 3),
    sessionElapsedSeconds: updatedMemory.sessionElapsedMs / 1000,
    label: input.classificationResult.label,
    currentActivity: currentActivityId,
    lessonPhase: updatedMemory.lessonPhase,
    recoveryState: updatedMemory.recoveryState,
  };
}

// ── Teacher action derivation ──────────────────────────────────────────────────

function deriveTeacherAction(
  outcome: ProgressionOutcome,
  label: ClassificationLabel,
): TeacherActionCode {
  switch (outcome.decisionType) {
    case LearningDecisionType.ADVANCE_ACTIVITY:
    case LearningDecisionType.ADVANCE_ITEM:
      return TeacherActionCode.PRAISE_AND_PROGRESS;

    case LearningDecisionType.TRIGGER_REVIEW:
      return TeacherActionCode.MOVE_TO_NEXT_ITEM;

    case LearningDecisionType.TRIGGER_EASIEST_WIN:
      return TeacherActionCode.GIVE_EASIEST_WIN;

    case LearningDecisionType.SCAFFOLD_CURRENT_ITEM:
    case LearningDecisionType.LOWER_DIFFICULTY:
      return TeacherActionCode.MODEL_ANSWER;

    case LearningDecisionType.REPEAT_CURRENT_ACTIVITY:
      return TeacherActionCode.WARM_PRAISE_CONFIRM;

    case LearningDecisionType.CONTINUE_RECOVERY:
      return TeacherActionCode.BACK_OFF_OFFER_CHOICE;

    case LearningDecisionType.REPAIRED_SUCCESS:
      return TeacherActionCode.WARM_PRAISE_CONFIRM;

    case LearningDecisionType.HOLD_UNCERTAIN:
      return TeacherActionCode.HOLD_CURRENT_ITEM;

    case LearningDecisionType.STAY_CURRENT_ITEM:
    default:
      // Map from classification label when staying
      if (label === ClassificationLabel.CORRECT_CONFIDENT) return TeacherActionCode.PRAISE_AND_PROGRESS;
      if (label === ClassificationLabel.CORRECT_HESITANT) return TeacherActionCode.WARM_PRAISE_CONFIRM;
      if (label === ClassificationLabel.NEAR_CORRECT) return TeacherActionCode.RECAST_AND_CONFIRM;
      if (label === ClassificationLabel.REPEATED_AFTER_MODEL) return TeacherActionCode.PRAISE_ECHO_THEN_CHECK;
      return TeacherActionCode.HOLD_CURRENT_ITEM;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildLog(
  event: LogEventName,
  sessionId: string,
  turnNumber: number,
  payload: Record<string, unknown>,
): LogEvent {
  return {
    event,
    severity: LogSeverity.DEBUG,
    sessionId,
    turnNumber,
    timestamp: new Date().toISOString(),
    payload,
  };
}

function makeNullOutcome(decisionType: LearningDecisionType): ProgressionOutcome {
  return {
    ruleFired: RULE_SAFETY_CLOSE,
    decisionType,
    shouldStayOnCurrentItem: false,
    shouldAdvanceItem: false,
    shouldReview: false,
    shouldTriggerRecovery: false,
    shouldTriggerEasiestWin: false,
    nextItemId: undefined,
    demandLevelDelta: 0,
    difficultyDelta: 0,
    reasons: [],
  };
}
