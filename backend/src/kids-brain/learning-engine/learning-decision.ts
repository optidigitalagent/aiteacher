import type { ActivityType, TeacherActionCode, LearningDecisionType } from '../shared/enums.js';
import type { SessionMemory } from '../contracts/session-memory.js';
import type { MasteryUpdateCandidate, ReviewScheduleCandidate } from './learning-engine-types.js';

/**
 * Primary output of the Learning Engine per turn (Phase 5 spec).
 * Contains a deterministic pedagogical decision — no teacher text, no LLM calls.
 */
export interface LearningDecision {
  decisionId: string;
  sessionId: string;
  turnNumber: number;
  decisionType: LearningDecisionType;
  nextTeacherActionCode: TeacherActionCode;
  nextActivityType: ActivityType;
  /** undefined = stay on current item. */
  nextTargetItemId: string | undefined;
  shouldStayOnCurrentItem: boolean;
  shouldAdvanceItem: boolean;
  shouldReview: boolean;
  shouldTriggerRecovery: boolean;
  shouldTriggerEasiestWin: boolean;
  shouldCloseSession: boolean;
  /** Negative = easier, positive = harder, 0 = same. */
  difficultyDelta: number;
  masteryUpdateCandidate: MasteryUpdateCandidate | null;
  reviewScheduleCandidate: ReviewScheduleCandidate | null;
  reasons: string[];
  priorityRuleFired: string;
  createdAt: string; // ISO 8601
}

// ── Builder ───────────────────────────────────────────────────────────────────

export interface BuildDecisionParams {
  decisionId: string;
  sessionMemory: SessionMemory;
  decisionType: LearningDecisionType;
  nextTeacherActionCode: TeacherActionCode;
  nextActivityType: ActivityType;
  nextTargetItemId?: string;
  shouldStayOnCurrentItem: boolean;
  shouldAdvanceItem: boolean;
  shouldReview: boolean;
  shouldTriggerRecovery: boolean;
  shouldTriggerEasiestWin: boolean;
  shouldCloseSession: boolean;
  difficultyDelta: number;
  masteryUpdateCandidate: MasteryUpdateCandidate | null;
  reviewScheduleCandidate: ReviewScheduleCandidate | null;
  reasons: string[];
  priorityRuleFired: string;
}

export function buildLearningDecision(params: BuildDecisionParams): LearningDecision {
  return {
    decisionId: params.decisionId,
    sessionId: params.sessionMemory.sessionId,
    turnNumber: params.sessionMemory.turnNumber,
    decisionType: params.decisionType,
    nextTeacherActionCode: params.nextTeacherActionCode,
    nextActivityType: params.nextActivityType,
    nextTargetItemId: params.nextTargetItemId,
    shouldStayOnCurrentItem: params.shouldStayOnCurrentItem,
    shouldAdvanceItem: params.shouldAdvanceItem,
    shouldReview: params.shouldReview,
    shouldTriggerRecovery: params.shouldTriggerRecovery,
    shouldTriggerEasiestWin: params.shouldTriggerEasiestWin,
    shouldCloseSession: params.shouldCloseSession,
    difficultyDelta: params.difficultyDelta,
    masteryUpdateCandidate: params.masteryUpdateCandidate,
    reviewScheduleCandidate: params.reviewScheduleCandidate,
    reasons: params.reasons,
    priorityRuleFired: params.priorityRuleFired,
    createdAt: new Date().toISOString(),
  };
}
