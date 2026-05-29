/**
 * Kids Brain v1 — Orchestrator
 *
 * Single entry point for all session lifecycle events.
 * Backend-authoritative: frontend sends raw signals, backend decides everything.
 *
 * Flow per turn:
 *   1. Classify child response → ResponseSignal
 *   2. Fire fast-track reaction immediately (no LLM wait)
 *   3. Compute recovery action (scripted, synchronous)
 *   4. If LLM needed: call (or stub in dev)
 *   5. Post-process output
 *   6. Return TeacherTurn + updated state
 */

import type {
  SessionState,
  ChildResponse,
  TeacherTurn,
  SessionResult,
  StartSessionParams,
} from './types.js';
import {
  createSession,
  isSessionExpired,
  isCostCapReached,
  getCurrentItem,
  advanceToNextItem,
  updateTimingState,
  applyConfidenceDelta,
} from './session-engine.js';
import {
  classifyResponse,
  selectFastTrack,
  buildRecoveryAction,
  recordRecoveryOutcome,
  selectReward,
  detectL1,
} from './recovery-manager.js';
import {
  buildRescueResponse,
  startWaitTimer,
  clearWaitTimer,
  resetRescueLevelOnSuccess,
} from './immersion-manager.js';
import {
  buildGreeting,
  buildClosing,
  buildScriptedQuestion,
  buildLlmSystemPrompt,
  buildLlmUserPrompt,
  callLlm,
  postProcess,
} from './dialogue-manager.js';
import { log, getSessionLogs } from './logger.js';

// ─── In-memory session store (prototype only) ─────────────────────────────────

const sessions = new Map<string, SessionState>();

// ─── Session lifecycle ────────────────────────────────────────────────────────

export function startSession(params: StartSessionParams): {
  sessionId: string;
  greeting: TeacherTurn;
  state: SessionState;
} {
  const state = createSession(params);
  sessions.set(state.sessionId, state);

  log(state, 'session_event', {
    event: 'session_started',
    childAge: params.childAge,
    childL1: params.childL1,
    sessionNumber: params.sessionNumber,
  });

  const greetingText = buildGreeting(state);
  const greeting: TeacherTurn = {
    fastTrack: { text: 'Hi!', animation: 'excited_wave' },
    slowTrack: { text: greetingText, animation: 'warm_welcome', isScripted: true },
    frontendSignals: [{ type: 'SESSION_STARTED', payload: { sessionId: state.sessionId } }],
  };

  // Start wait timer — teacher just greeted, now waiting for child
  startWaitTimer(state);

  return { sessionId: state.sessionId, greeting, state };
}

export function getSession(sessionId: string): SessionState | null {
  return sessions.get(sessionId) ?? null;
}

// ─── First question after greeting ───────────────────────────────────────────

export function buildFirstQuestion(state: SessionState): TeacherTurn {
  const question = buildScriptedQuestion(state);
  startWaitTimer(state);
  return {
    fastTrack: { text: "Let's go!", animation: 'forward_motion' },
    slowTrack: { text: question, animation: 'questioning_expression', isScripted: true },
    frontendSignals: [{ type: 'QUESTION_ASKED', payload: { itemId: state.curriculumState.currentItemId } }],
  };
}

// ─── Core turn processor ──────────────────────────────────────────────────────

export async function processTurn(
  sessionId: string,
  childResponse: ChildResponse
): Promise<SessionResult> {
  const state = sessions.get(sessionId);
  if (!state) throw new Error(`Session ${sessionId} not found`);

  updateTimingState(state);
  clearWaitTimer(state);

  // Guard: expired or cost cap
  if (isSessionExpired(state) || isCostCapReached(state)) {
    return buildClosingResult(state);
  }

  const currentItem = getCurrentItem(state);
  if (!currentItem) return buildClosingResult(state);

  const targetItemId = state.curriculumState.currentItemId ?? '';
  const targetWord = getWordForItem(targetItemId);
  const wasL1 = detectL1(childResponse.text);

  // Step 1: Classify
  const signal = classifyResponse(
    childResponse.text,
    childResponse.latencyMs,
    targetWord,
    state
  );
  state.emotionalState.lastResponseSignal = signal;
  log(state, 'response_signal', { signal, latencyMs: childResponse.latencyMs });

  // Step 2: Fast-track (fires immediately — zero LLM wait)
  const fastTrack = selectFastTrack(signal);

  // Step 3: Recovery / immersion decision
  let slowTrackText: string;
  let animation: string;
  let isScripted = true;
  const frontendSignals: Array<{ type: string; payload: Record<string, unknown> }> = [];
  let shouldClose = false;

  const isSuccess = signal === 'CORRECT_CONFIDENT' || signal === 'CORRECT_HESITANT';

  if (isSuccess) {
    // Happy path: reward + next question
    const reward = selectReward(state);
    resetRescueLevelOnSuccess(state);
    applyConfidenceDelta(state, targetItemId, signal === 'CORRECT_CONFIDENT' ? 5 : 2);
    currentItem.attempts++;
    currentItem.successes++;
    currentItem.consecutiveFailures = 0;

    recordRecoveryOutcome(state, 0, 'correct', true);
    frontendSignals.push({ type: 'REWARD', payload: { rewardId: reward.id } });

    // Advance to next item if this one is mastered
    const nextItemId = advanceIfMastered(state, targetItemId);

    // Check if all items are done
    if (!state.curriculumState.currentItemId) {
      shouldClose = true;
      slowTrackText = buildClosing(state);
      animation = 'celebration_finale';
    } else {
      // Build next question using LLM (or scripted stub)
      const systemPrompt = buildLlmSystemPrompt(state);
      const userPrompt = buildLlmUserPrompt(childResponse.text);
      const raw = await callLlm(systemPrompt, userPrompt, state);
      const processed = postProcess(raw, buildScriptedQuestion(state), state);
      slowTrackText = `${reward.text} ${processed.text}`;
      animation = `${reward.animation}_then_question`;
      isScripted = processed.fallbackUsed;
    }

    startWaitTimer(state);
  } else if (signal === 'EMOTIONAL_SHUTDOWN') {
    // Emotional safety first
    const recovery = buildRecoveryAction(signal, state, targetWord, state.childName);
    slowTrackText = recovery.scriptedResponse;
    animation = recovery.animation;
    recordRecoveryOutcome(state, 5, 'emotional_shutdown', false);
  } else {
    // Failure signals: use recovery or rescue ladder
    currentItem.attempts++;
    currentItem.consecutiveFailures++;

    const recovery = buildRecoveryAction(signal, state, targetWord, state.childName);

    if (recovery.requiresLlm) {
      // Scripted recovery supplemented with LLM personalization
      const raw = await callLlm(
        buildLlmSystemPrompt(state),
        buildLlmUserPrompt(childResponse.text),
        state
      );
      const processed = postProcess(raw, recovery.scriptedResponse, state);
      slowTrackText = processed.text;
      isScripted = false;
    } else {
      slowTrackText = recovery.scriptedResponse;
    }

    animation = recovery.animation;
    recordRecoveryOutcome(
      state,
      recovery.recoveryLevel,
      `level_${recovery.recoveryLevel}`,
      recovery.winAchieved
    );

    if (recovery.frontendSignal) {
      frontendSignals.push(recovery.frontendSignal);
    }

    // If NO_RESPONSE or L1: also apply rescue ladder
    if (signal === 'NO_RESPONSE' || signal === 'L1_SWITCH') {
      const rescue = buildRescueResponse(state, childResponse.latencyMs, wasL1);
      // Append rescue text to slow track
      slowTrackText = `${slowTrackText} ${rescue.text}`.trim();
      if (rescue.frontendSignal) {
        frontendSignals.push(rescue.frontendSignal);
      }
    }

    startWaitTimer(state);
  }

  // Guard: approaching session end
  if (state.timingState.minutesUntilClose <= 2 && !shouldClose) {
    shouldClose = true;
    slowTrackText = buildClosing(state);
    animation = 'gentle_farewell';
  }

  const result: SessionResult = {
    fastTrack,
    slowTrack: { text: slowTrackText, animation, isScripted },
    updatedState: state,
    frontendSignals,
    shouldClose,
    responseSignal: signal,
  };

  if (shouldClose) {
    closeSession(state);
  }

  return result;
}

// ─── Silent / timeout turn (no child input received) ─────────────────────────

export function processSilence(sessionId: string, silenceDurationMs: number): TeacherTurn | null {
  const state = sessions.get(sessionId);
  if (!state) return null;

  log(state, 'response_latency', { silenceDurationMs, type: 'silence' });

  // Escalate rescue ladder
  const targetItemId = state.curriculumState.currentItemId ?? '';
  const rescue = buildRescueResponse(state, silenceDurationMs, false);

  startWaitTimer(state);
  return {
    fastTrack: { text: 'Hmm!', animation: 'warm_encouraging_nod' },
    slowTrack: { text: rescue.text, animation: rescue.animation, isScripted: true },
    frontendSignals: rescue.frontendSignal ? [rescue.frontendSignal] : [],
  };
}

// ─── Session close ────────────────────────────────────────────────────────────

export function endSession(sessionId: string): { closingText: string; logs: unknown[] } {
  const state = sessions.get(sessionId);
  if (!state) return { closingText: 'See you next time!', logs: [] };
  closeSession(state);
  return {
    closingText: buildClosing(state),
    logs: getSessionLogs(sessionId),
  };
}

function closeSession(state: SessionState): void {
  state.status = 'completed';
  state.endedAt = new Date();
  log(state, 'session_event', {
    event: 'session_ended',
    completedItems: state.curriculumState.completedItems.length,
    l1Events: state.immersionState.l1EventsThisSession,
    recoveryEvents: state.recoveryHistory.length,
    elapsedSeconds: state.timingState.elapsedSeconds,
    llmCalls: state.costState.llmCallsThisSession,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { ANIMALS } from './animals-curriculum.js';

function getWordForItem(itemId: string): string {
  return ANIMALS.find(a => a.id === itemId)?.word ?? 'animal';
}

function advanceIfMastered(state: SessionState, itemId: string): string | null {
  const item = state.curriculumState.activeItems.find(i => i.itemId === itemId);
  if (!item) return null;
  // Move on if mastered (score >= 76) or after 3 successes in one session
  if (item.confidenceScore >= 76 || item.successes >= 3) {
    return advanceToNextItem(state);
  }
  return itemId;
}

function buildClosingResult(state: SessionState): SessionResult {
  closeSession(state);
  return {
    fastTrack: { text: 'Great job!', animation: 'celebration' },
    slowTrack: { text: buildClosing(state), animation: 'farewell_wave', isScripted: true },
    updatedState: state,
    frontendSignals: [{ type: 'SESSION_ENDED', payload: {} }],
    shouldClose: true,
    responseSignal: 'CORRECT_CONFIDENT',
  };
}
