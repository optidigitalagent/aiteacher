import { ClassificationLabel, ClassificationPath, TeacherActionCode, ActivityType } from '../shared/enums.js';
import type { TurnRecord } from '../contracts/turn-record.js';
import type { ResponseClassificationResult } from '../classification/classification-result.js';
import type { PerceptionBundle } from '../perception/perception-bundle.js';
import type { ActivityContext } from '../classification/classification-types.js';
import type { SessionMemory } from '../contracts/session-memory.js';

/** Phase 4 specifies max 10 recent turns (deviates from Phase 1 constant of 5). */
export const STATE_ENGINE_MAX_RECENT_TURNS = 10;

const SUCCESS_LABELS = new Set<ClassificationLabel>([
  ClassificationLabel.CORRECT_CONFIDENT,
  ClassificationLabel.CORRECT_HESITANT,
  ClassificationLabel.NEAR_CORRECT,
]);

const FAILURE_LABELS = new Set<ClassificationLabel>([
  ClassificationLabel.WRONG_SEMANTIC,
  ClassificationLabel.WRONG_BUT_RELATED,
  ClassificationLabel.RANDOM_NONSENSE,
  ClassificationLabel.AVOIDANCE_NONSENSE,
  ClassificationLabel.NO_RESPONSE,
  ClassificationLabel.REFUSAL,
  ClassificationLabel.L1_REFUSAL,
  ClassificationLabel.EMOTIONAL_SHUTDOWN,
  ClassificationLabel.I_DONT_KNOW,
]);

/**
 * Builds a TurnRecord from perception, classification, and activity context.
 * Does NOT store raw audio. Raw transcripts are normalized before inclusion.
 */
export function buildTurnRecord(
  sessionMemory: SessionMemory,
  perception: PerceptionBundle,
  classification: ResponseClassificationResult,
  activityContext: ActivityContext,
  timestamp: string,
): TurnRecord {
  return {
    turnNumber: sessionMemory.turnNumber + 1,
    sttTextNormalized: perception.normalizedTranscript,
    responseLatencyMs: perception.responseLatencyMs,
    silenceDurationMs: perception.silenceDurationMs,
    l1Detected: perception.l1Detected,
    classificationLabel: classification.label,
    classificationConfidence: classification.confidence,
    classificationPath: mapClassificationPath(classification.source),
    targetItemId: activityContext.currentTargetItemId,
    activityId: activityContext.activityId as ActivityType,
    lessonPhase: sessionMemory.lessonPhase,
    attemptNumber: activityContext.attemptNumber,
    modelWasGiven: activityContext.modelWasGiven,
    // actionTaken: use recommended action; will be overridden by teacher response module later
    actionTaken: classification.recommendedSafeAction,
    recoveryOverride: false,
    wasSuccess: SUCCESS_LABELS.has(classification.label),
    masteryDelta: 0, // not computed in state engine (Phase 5)
    completedAt: timestamp,
  };
}

/**
 * Appends a new TurnRecord to the history, capping at STATE_ENGINE_MAX_RECENT_TURNS.
 * Returns a new array — input is never mutated.
 */
export function appendTurn(
  recentTurns: readonly TurnRecord[],
  newTurn: TurnRecord,
  maxSize = STATE_ENGINE_MAX_RECENT_TURNS,
): TurnRecord[] {
  const updated = [...recentTurns, newTurn];
  if (updated.length > maxSize) {
    return updated.slice(updated.length - maxSize);
  }
  return updated;
}

/**
 * Recalculates rolling success/failure counts from the last 5 turns.
 * This provides the correct "rolling window of 5" behaviour (spec §7.1).
 */
export function recalculateSuccessFailureCounts(
  recentTurns: readonly TurnRecord[],
): { recentSuccessCount: number; recentFailureCount: number } {
  const window = recentTurns.slice(-5);
  const recentSuccessCount = window.filter(t => SUCCESS_LABELS.has(t.classificationLabel)).length;
  const recentFailureCount = window.filter(t => FAILURE_LABELS.has(t.classificationLabel)).length;
  return { recentSuccessCount, recentFailureCount };
}

function mapClassificationPath(source: string): ClassificationPath {
  switch (source) {
    case 'llm_assisted': return ClassificationPath.LLM_PATH;
    case 'timeout_fallback': return ClassificationPath.TIMEOUT_FALLBACK;
    default: return ClassificationPath.FAST_PATH;
  }
}
