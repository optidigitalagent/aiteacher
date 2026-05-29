import { ClassificationLabel, LearningDecisionType, RecoveryState, TeacherActionCode, AgeBand } from '../shared/enums.js';
import type { LearningEngineInput, SessionCloseDecision, DerivedSignals } from './learning-engine-types.js';
import type { TurnRecord } from '../contracts/turn-record.js';
import { canBeginClose } from './lesson-flow-engine.js';
import {
  FRUSTRATION_STOP_E,
  ENGAGEMENT_STOP_E,
  ENGAGEMENT_STOP_MIN_ELAPSED_S,
  NO_RESPONSE_STOP_COUNT,
  STAMINA_CLOSE_E,
  RULE_R01,
  RULE_R02,
  RULE_R03,
  RULE_TIMEOUT,
  RULE_SAFETY_CLOSE,
} from './learning-constants.js';

/**
 * Evaluates all session close conditions in priority order (Phase 5 spec priorities 1–3,
 * session-completion-engine.yaml, progression-rules.yaml R01–R03).
 *
 * Returns null if session should NOT close this turn.
 * Returns SessionCloseDecision if session should close or pre-close easiest_win needed.
 *
 * Rule: session must NEVER end immediately after failure. If close is triggered after
 * failure, the caller must insert easiest_win before executing the close.
 */
export function checkSessionClose(
  input: LearningEngineInput,
  signals: DerivedSignals,
): SessionCloseDecision | null {
  const { stateEngineOutput } = input;
  const updatedMemory = stateEngineOutput.updatedSessionMemory;
  const recentTurns = updatedMemory.recentTurns;
  const { frustration, engagement, stamina, sessionElapsedSeconds, label, recoveryState } = signals;

  const maxSessionSeconds = updatedMemory.ageProfile.maxSessionSeconds;

  // PRIORITY 1: Safety close — unsafe content (overrides everything)
  if (label === ClassificationLabel.UNSAFE_OR_SENSITIVE || !stateEngineOutput.stateUpdateSummary.safeToContinue) {
    return {
      shouldClose: true,
      closeType: 'safety',
      decisionType: LearningDecisionType.CLOSE_SAFETY,
      teacherAction: TeacherActionCode.ESCALATE_TO_SAFETY,
      reasons: ['Safety flag: unsafe_or_sensitive content detected — immediate close'],
    };
  }

  // PRIORITY 2: Emotional shutdown (close gently, possibly with easiest_win first)
  if (
    label === ClassificationLabel.EMOTIONAL_SHUTDOWN ||
    recoveryState === RecoveryState.EMOTIONAL_SHUTDOWN
  ) {
    return {
      shouldClose: true,
      closeType: 'emotional',
      decisionType: LearningDecisionType.CLOSE_SAFETY,
      teacherAction: TeacherActionCode.PAUSE_AND_CHECK_IN,
      reasons: ['Emotional shutdown detected — closing gently with warm check-in'],
    };
  }

  // R01: extreme frustration stop
  if (frustration >= FRUSTRATION_STOP_E) {
    return {
      shouldClose: true,
      closeType: 'emotional',
      decisionType: LearningDecisionType.CLOSE_SAFETY,
      teacherAction: TeacherActionCode.GIVE_EASIEST_WIN,
      reasons: [`R01: frustration ${frustration} >= ${FRUSTRATION_STOP_E} — emotional overload close`],
    };
  }

  // R02: extreme disengagement stop (must be >= 5 min in)
  if (engagement <= ENGAGEMENT_STOP_E && sessionElapsedSeconds >= ENGAGEMENT_STOP_MIN_ELAPSED_S) {
    return {
      shouldClose: true,
      closeType: 'engagement',
      decisionType: LearningDecisionType.CLOSE_SAFETY,
      teacherAction: TeacherActionCode.GIVE_EASIEST_WIN,
      reasons: [`R02: engagement ${engagement} <= ${ENGAGEMENT_STOP_E} at ${sessionElapsedSeconds}s`],
    };
  }

  // R03: three consecutive no_response
  const noResponseLast3 = countLabelInLastN(recentTurns, ClassificationLabel.NO_RESPONSE, 3);
  if (noResponseLast3 >= NO_RESPONSE_STOP_COUNT) {
    return {
      shouldClose: true,
      closeType: 'emotional',
      decisionType: LearningDecisionType.CLOSE_SAFETY,
      teacherAction: TeacherActionCode.PAUSE_AND_CHECK_IN,
      reasons: [`R03: ${noResponseLast3} consecutive no_response events — gentle close with praise`],
    };
  }

  // ES02: sustained non-response (4 of last 5)
  const noResponseLast5 = countLabelInLastN(recentTurns, ClassificationLabel.NO_RESPONSE, 5);
  if (noResponseLast5 >= 4) {
    return {
      shouldClose: true,
      closeType: 'emotional',
      decisionType: LearningDecisionType.CLOSE_SAFETY,
      teacherAction: TeacherActionCode.PAUSE_AND_CHECK_IN,
      reasons: [`ES02: ${noResponseLast5}/5 no_response events — close gently`],
    };
  }

  // ES03: escalating wrong_random (4 of last 5 + low engagement)
  const wrongRandomLast5 = countLabelInLastN(recentTurns, ClassificationLabel.RANDOM_NONSENSE, 5);
  if (wrongRandomLast5 >= 4 && engagement < 25) {
    return {
      shouldClose: true,
      closeType: 'engagement',
      decisionType: LearningDecisionType.CLOSE_SAFETY,
      teacherAction: TeacherActionCode.GIVE_EASIEST_WIN,
      reasons: [`ES03: wrong_random ${wrongRandomLast5}/5 + engagement ${engagement} < 25`],
    };
  }

  // PRIORITY 3: Timeout close
  if (sessionElapsedSeconds >= maxSessionSeconds) {
    const lastTurnWasSuccess = recentTurns.length > 0 && recentTurns[recentTurns.length - 1].wasSuccess;
    if (!lastTurnWasSuccess) {
      // Insert easiest_win before close (rule: never end on failure)
      return {
        shouldClose: true,
        closeType: 'timeout',
        decisionType: LearningDecisionType.TRIGGER_EASIEST_WIN, // easiest_win first, then timeout close
        teacherAction: TeacherActionCode.GIVE_EASIEST_WIN,
        reasons: [
          `Timeout (${sessionElapsedSeconds}s >= ${maxSessionSeconds}s) after failure — inserting easiest_win before close`,
        ],
      };
    }
    return {
      shouldClose: true,
      closeType: 'timeout',
      decisionType: LearningDecisionType.CLOSE_TIMEOUT,
      teacherAction: TeacherActionCode.CLOSE_LESSON,
      reasons: [`Timeout: session elapsed ${sessionElapsedSeconds}s >= ${maxSessionSeconds}s`],
    };
  }

  // Stamina too low to continue
  if (stamina < STAMINA_CLOSE_E) {
    const canClose = canBeginClose(recentTurns);
    if (canClose) {
      return {
        shouldClose: true,
        closeType: 'engagement',
        decisionType: LearningDecisionType.CLOSE_SUCCESS,
        teacherAction: TeacherActionCode.CLOSE_LESSON,
        reasons: [`Stamina ${stamina} < ${STAMINA_CLOSE_E}: session ending gracefully`],
      };
    }
    // Cannot close after failure — insert easiest_win first
    return {
      shouldClose: true,
      closeType: 'engagement',
      decisionType: LearningDecisionType.TRIGGER_EASIEST_WIN,
      teacherAction: TeacherActionCode.GIVE_EASIEST_WIN,
      reasons: [`Stamina ${stamina} < ${STAMINA_CLOSE_E}: inserting easiest_win before close`],
    };
  }

  return null;
}

function countLabelInLastN(
  turns: TurnRecord[],
  label: ClassificationLabel,
  n: number,
): number {
  const slice = turns.slice(-n);
  return slice.filter((t) => t.classificationLabel === label).length;
}
