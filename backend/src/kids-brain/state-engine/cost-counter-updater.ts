import type { CostCounters } from '../shared/types.js';
import type { CostCounterDelta } from './state-engine-types.js';

/**
 * Applies a CostCounterDelta to CostCounters immutably.
 * Returns a new CostCounters — input is never mutated.
 *
 * Does NOT enforce caps. Cap enforcement belongs to later runtime orchestration (Phase 5).
 */
export function applyCostDelta(
  current: CostCounters,
  delta: CostCounterDelta,
): CostCounters {
  return {
    tokensGenerated: current.tokensGenerated,
    llmCallsClassification: current.llmCallsClassification + delta.llmClassificationCalls,
    llmCallsTeacherResponse: current.llmCallsTeacherResponse + delta.llmTeacherCalls,
    sttSeconds: current.sttSeconds + delta.sttSeconds,
    ttsCharacters: current.ttsCharacters + delta.ttsCharacters,
    turnCount: current.turnCount + delta.turnCount,
  };
}

/** Creates a zero-delta CostCounterDelta for turns without LLM/STT/TTS costs. */
export function buildTurnOnlyCostDelta(): CostCounterDelta {
  return {
    sttSeconds: 0,
    llmClassificationCalls: 0,
    llmTeacherCalls: 0,
    ttsCharacters: 0,
    turnCount: 1,
  };
}

/** Creates the initial CostCounters for a new session. */
export function createInitialCostCounters(): CostCounters {
  return {
    tokensGenerated: 0,
    llmCallsClassification: 0,
    llmCallsTeacherResponse: 0,
    sttSeconds: 0,
    ttsCharacters: 0,
    turnCount: 0,
  };
}
