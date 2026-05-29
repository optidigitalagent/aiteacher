import { randomUUID } from 'crypto';
import type { SessionState, ItemState, QuestionType, StartSessionParams } from './types.js';
import { ANIMALS } from './animals-curriculum.js';
import { log } from './logger.js';

const SESSION_MAX_SECONDS = 15 * 60;
export const LLM_CALL_CAP = 20;
export const TTS_CHAR_CAP = 2000;
const STARTING_CONFIDENCE = 30;

export function createSession(params: StartSessionParams): SessionState {
  const sessionPlan = ANIMALS.map(a => a.id);

  return {
    sessionId: randomUUID(),
    childId: params.childId,
    childName: params.childName,
    childAge: params.childAge,
    childL1: params.childL1,
    sessionNumber: params.sessionNumber,
    unit: 4,
    startedAt: new Date(),
    endedAt: null,
    status: 'active',

    curriculumState: {
      activeItems: ANIMALS.map(
        (a): ItemState => ({
          itemId: a.id,
          confidenceScore: STARTING_CONFIDENCE,
          modesUsed: [],
          attempts: 0,
          successes: 0,
          consecutiveFailures: 0,
          introducedAtMinute: 0,
        })
      ),
      completedItems: [],
      flaggedItems: [],
      currentItemId: sessionPlan[0],
      currentQuestionType: 'RECOGNITION',
      sessionPlan,
    },

    emotionalState: {
      recoveryLevel: 0,
      globalConfidenceScore: STARTING_CONFIDENCE,
      consecutiveSuccesses: 0,
      freezeEventsThisSession: 0,
      emotionalShutdownOccurred: false,
      lastResponseSignal: null,
      stateEstimate: 'engaged',
    },

    immersionState: {
      rescueLevel: 0,
      l1EventsThisSession: 0,
      l1Items: [],
      waitTimeState: 'idle',
      waitStartedAtMs: null,
    },

    rewardState: {
      lastRewardId: null,
      rewardsDeliveredThisSession: 0,
      currentStreak: 0,
    },

    timingState: {
      elapsedSeconds: 0,
      lastNoveltyInjectionAtSecond: null,
      sessionPhase: 'open',
      minutesUntilClose: 15,
    },

    costState: {
      llmCallsThisSession: 0,
      ttsCharsThisSession: 0,
      estimatedCostUsd: 0,
      costCapReached: false,
    },

    openLoopState: { hasOpenLoop: false },

    recoveryHistory: [],
  };
}

export function isSessionExpired(state: SessionState): boolean {
  return (Date.now() - state.startedAt.getTime()) / 1000 >= SESSION_MAX_SECONDS;
}

export function isCostCapReached(state: SessionState): boolean {
  return (
    state.costState.llmCallsThisSession >= LLM_CALL_CAP ||
    state.costState.ttsCharsThisSession >= TTS_CHAR_CAP
  );
}

export function getCurrentItem(state: SessionState): ItemState | null {
  if (!state.curriculumState.currentItemId) return null;
  return (
    state.curriculumState.activeItems.find(
      i => i.itemId === state.curriculumState.currentItemId
    ) ?? null
  );
}

export function getQuestionTypeForScore(score: number): QuestionType {
  if (score <= 30) return 'RECOGNITION';
  if (score <= 55) return 'FORCED_CHOICE';
  if (score <= 75) return 'SUPPORTED_PRODUCTION';
  return 'FREE_PRODUCTION';
}

export function applyConfidenceDelta(
  state: SessionState,
  itemId: string,
  delta: number
): void {
  const item = state.curriculumState.activeItems.find(i => i.itemId === itemId);
  if (!item) return;

  const prev = item.confidenceScore;
  item.confidenceScore = Math.max(0, Math.min(100, item.confidenceScore + delta));
  state.curriculumState.currentQuestionType = getQuestionTypeForScore(item.confidenceScore);

  const avg =
    state.curriculumState.activeItems.reduce((s, i) => s + i.confidenceScore, 0) /
    state.curriculumState.activeItems.length;
  state.emotionalState.globalConfidenceScore = Math.round(avg);

  if (item.confidenceScore >= 76 && !state.curriculumState.completedItems.includes(itemId)) {
    state.curriculumState.completedItems.push(itemId);
    log(state, 'session_event', { event: 'item_mastered', itemId });
  }

  log(state, 'confidence_change', { itemId, prev, delta, newScore: item.confidenceScore });
}

export function flagItem(state: SessionState, itemId: string, reason: string): void {
  const item = state.curriculumState.activeItems.find(i => i.itemId === itemId);
  state.curriculumState.flaggedItems.push({
    itemId,
    reason,
    flaggedAtMinute: (Date.now() - state.startedAt.getTime()) / 60000,
    failedMode: state.curriculumState.currentQuestionType,
  });
  state.curriculumState.activeItems = state.curriculumState.activeItems.filter(
    i => i.itemId !== itemId
  );
  log(state, 'session_event', { event: 'item_flagged', itemId, reason, item });
  advanceToNextItem(state);
}

export function advanceToNextItem(state: SessionState): string | null {
  const flaggedIds = new Set(state.curriculumState.flaggedItems.map(f => f.itemId));
  const available = state.curriculumState.sessionPlan.filter(
    id => id !== state.curriculumState.currentItemId && !flaggedIds.has(id)
  );
  if (available.length === 0) return null;
  const nextId = available[0];
  state.curriculumState.currentItemId = nextId;
  const nextItem = state.curriculumState.activeItems.find(i => i.itemId === nextId);
  state.curriculumState.currentQuestionType = getQuestionTypeForScore(
    nextItem?.confidenceScore ?? STARTING_CONFIDENCE
  );
  return nextId;
}

export function updateTimingState(state: SessionState): void {
  const elapsed = (Date.now() - state.startedAt.getTime()) / 1000;
  state.timingState.elapsedSeconds = elapsed;
  state.timingState.minutesUntilClose = Math.max(0, (SESSION_MAX_SECONDS - elapsed) / 60);
  if (elapsed < 60) {
    state.timingState.sessionPhase = 'open';
  } else if (elapsed < SESSION_MAX_SECONDS - 120) {
    state.timingState.sessionPhase = 'main';
  } else {
    state.timingState.sessionPhase = 'closing';
  }
}

export function recordLlmCall(state: SessionState, outputChars: number): void {
  state.costState.llmCallsThisSession++;
  state.costState.ttsCharsThisSession += outputChars;
  state.costState.estimatedCostUsd += 0.003;
  state.costState.costCapReached = isCostCapReached(state);
  log(state, 'cost', {
    llmCalls: state.costState.llmCallsThisSession,
    ttsChars: state.costState.ttsCharsThisSession,
    estimatedUsd: state.costState.estimatedCostUsd,
  });
}
