import { ClassificationLabel, LogSeverity, RecoveryState } from '../shared/enums.js';
import { LOG_EVENTS } from '../shared/log-events.js';
import type { LogEvent } from '../shared/log-events.js';
import type { StateEngineInput } from './state-engine-types.js';
import type { StateEngineOutput } from './state-update-result.js';
import type { AppliedUpdate } from './state-update-result.js';
import type { ItemStateDeltas } from './state-engine-types.js';
import { computeConfidenceDeltas } from './confidence-updater.js';
import { computeNewRecoveryState } from './recovery-state-updater.js';
import { applyChildStateDeltas } from './child-state-updater.js';
import { updateItemState, createInitialItemState } from './item-state-updater.js';
import { applyCostDelta, buildTurnOnlyCostDelta } from './cost-counter-updater.js';
import { buildTurnRecord, appendTurn } from './turn-history-updater.js';
import { buildUpdatedSessionMemory } from './session-memory-updater.js';

/**
 * Main State Engine entry point (Phase 4).
 *
 * Consumes: SessionMemory + PerceptionBundle + ResponseClassificationResult + ActivityContext
 * Returns: updated immutable SessionMemory + StateUpdateSummary + audit log
 *
 * Does NOT:
 * - select next activity
 * - generate teacher responses
 * - update persistent MasteryRecord
 * - wire into production runtime
 * - call LLMs
 */
export function runStateEngine(input: StateEngineInput): StateEngineOutput {
  const { sessionMemory, perceptionBundle, classificationResult, currentActivityContext, timestamp } = input;
  const label = classificationResult.label;
  const previousChildState = sessionMemory.childState;
  const previousRecoveryState = sessionMemory.recoveryState;

  // ── Step 1: safeToContinue check ───────────────────────────────────────────
  const safeToContinue = label !== ClassificationLabel.UNSAFE_OR_SENSITIVE;

  // ── Step 2: Compute confidence deltas ──────────────────────────────────────
  const confidenceDeltas = computeConfidenceDeltas(
    label,
    previousChildState,
    currentActivityContext,
    sessionMemory,
  );

  // ── Step 3: Apply child state deltas (provisional — counts recalculated later) ──
  // Recovery state computed after child state update so it can read updated frustration/safety
  const provisionalChildState = applyChildStateDeltas(
    previousChildState,
    confidenceDeltas,
    previousRecoveryState, // temporary; will be replaced
  );

  // ── Step 4: Compute new recovery state ────────────────────────────────────
  const newRecoveryState = computeNewRecoveryState(
    previousRecoveryState,
    provisionalChildState,
    label,
    sessionMemory.recentTurns,
  );

  // ── Step 5: Apply correct recovery state to child state ───────────────────
  const updatedChildState = applyChildStateDeltas(
    previousChildState,
    confidenceDeltas,
    newRecoveryState,
  );

  // ── Step 6: Update item state ──────────────────────────────────────────────
  const targetItemId = currentActivityContext.currentTargetItemId;
  let itemDeltas: ItemStateDeltas = {
    attemptsAdded: 0,
    correctAttemptsAdded: 0,
    promptedCorrectAdded: 0,
    unpromptedCorrectAdded: 0,
    l1ResponsesAdded: 0,
    silenceCountAdded: 0,
  };
  let updatedItemState = null;

  if (targetItemId !== null) {
    const currentItemState = sessionMemory.itemState.get(targetItemId)
      ?? createInitialItemState(targetItemId);
    const itemResult = updateItemState(currentItemState, label, currentActivityContext, timestamp);
    updatedItemState = itemResult.newItemState;
    itemDeltas = itemResult.deltas;
  }

  // ── Step 7: Update cost counters ──────────────────────────────────────────
  const costDelta = buildTurnOnlyCostDelta();
  const updatedCostCounters = applyCostDelta(sessionMemory.costCounters, costDelta);

  // ── Step 8: Build and append turn record ─────────────────────────────────
  const newTurnRecord = buildTurnRecord(
    sessionMemory,
    perceptionBundle,
    classificationResult,
    currentActivityContext,
    timestamp,
  );
  const newRecentTurns = appendTurn(sessionMemory.recentTurns, newTurnRecord);

  // ── Step 9: Assemble updated session memory ───────────────────────────────
  const updatedSessionMemory = buildUpdatedSessionMemory(
    sessionMemory,
    {
      updatedChildState,
      targetItemId,
      updatedItemState,
      newRecentTurns,
      newCostCounters: updatedCostCounters,
      newRecoveryState,
      newActivityId: currentActivityContext.activityId,
    },
    timestamp,
  );

  // ── Step 10: Build summary ────────────────────────────────────────────────
  const recoveryChanged = newRecoveryState !== previousRecoveryState;
  const wasInRecovery = previousRecoveryState !== RecoveryState.NORMAL;
  const isNowInRecovery = newRecoveryState !== RecoveryState.NORMAL;

  const prevSuccess = previousChildState.recentSuccessCount;
  const newSuccess = updatedSessionMemory.childState.recentSuccessCount;
  const prevFailure = previousChildState.recentFailureCount;
  const newFailure = updatedSessionMemory.childState.recentFailureCount;

  const stateUpdateSummary = {
    turnNumber: updatedSessionMemory.turnNumber,
    previousRecoveryState,
    newRecoveryState,
    previousEngagementLevel: previousChildState.engagementLevel,
    newEngagementLevel: updatedSessionMemory.childState.engagementLevel,
    confidenceDeltas,
    itemStateDeltas: itemDeltas,
    costCounterDeltas: costDelta,
    recentSuccessCountDelta: newSuccess - prevSuccess,
    recentFailureCountDelta: newFailure - prevFailure,
    shouldEnterRecovery: !wasInRecovery && isNowInRecovery,
    shouldExitRecovery: wasInRecovery && !isNowInRecovery,
    safeToContinue,
    createdAt: timestamp,
  };

  // ── Step 11: Build applied updates log ────────────────────────────────────
  const appliedUpdates: AppliedUpdate[] = buildAppliedUpdates(
    previousChildState,
    updatedSessionMemory.childState,
    previousRecoveryState,
    newRecoveryState,
  );

  // ── Step 12: Build log events ─────────────────────────────────────────────
  const logsToEmit: LogEvent[] = buildLogEvents(
    sessionMemory.sessionId,
    updatedSessionMemory.turnNumber,
    timestamp,
    label,
    safeToContinue,
    recoveryChanged,
    previousRecoveryState,
    newRecoveryState,
    confidenceDeltas,
  );

  return {
    updatedSessionMemory,
    stateUpdateSummary,
    appliedUpdates,
    triggeredRecoveryChange: recoveryChanged,
    costCounterDelta: costDelta,
    masteryEligibility: classificationResult.eligibleForMasteryUpdate,
    progressionEligibility: classificationResult.eligibleForProgression,
    logsToEmit,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildAppliedUpdates(
  prev: { comprehensionConfidence: number; productionConfidence: number; engagementLevel: number; frustrationRisk: number; emotionalSafety: number },
  next: { comprehensionConfidence: number; productionConfidence: number; engagementLevel: number; frustrationRisk: number; emotionalSafety: number },
  prevRecovery: RecoveryState,
  nextRecovery: RecoveryState,
): AppliedUpdate[] {
  const updates: AppliedUpdate[] = [];
  const track = (field: string, pv: unknown, nv: unknown) => {
    if (pv !== nv) updates.push({ field, previousValue: pv, newValue: nv });
  };
  track('comprehensionConfidence', prev.comprehensionConfidence, next.comprehensionConfidence);
  track('productionConfidence', prev.productionConfidence, next.productionConfidence);
  track('engagementLevel', prev.engagementLevel, next.engagementLevel);
  track('frustrationRisk', prev.frustrationRisk, next.frustrationRisk);
  track('emotionalSafety', prev.emotionalSafety, next.emotionalSafety);
  track('recoveryState', prevRecovery, nextRecovery);
  return updates;
}

function buildLogEvents(
  sessionId: string,
  turnNumber: number,
  timestamp: string,
  label: ClassificationLabel,
  safeToContinue: boolean,
  recoveryChanged: boolean,
  prevRecovery: RecoveryState,
  newRecovery: RecoveryState,
  confidenceDeltas: { comprehensionDelta: number; productionDelta: number },
): LogEvent[] {
  const logs: LogEvent[] = [];

  const base = { sessionId, turnNumber, timestamp };

  logs.push({
    event: LOG_EVENTS.STATE_UPDATE_COMPLETED,
    severity: LogSeverity.DEBUG,
    ...base,
    payload: { label, safeToContinue, recoveryState: newRecovery },
  });

  if (!safeToContinue) {
    logs.push({
      event: LOG_EVENTS.SAFE_TO_CONTINUE_FALSE,
      severity: LogSeverity.CRITICAL,
      ...base,
      payload: { label },
    });
  }

  if (recoveryChanged) {
    logs.push({
      event: LOG_EVENTS.RECOVERY_STATE_CHANGED,
      severity: LogSeverity.INFO,
      ...base,
      payload: { from: prevRecovery, to: newRecovery },
    });
  }

  if (confidenceDeltas.comprehensionDelta !== 0 || confidenceDeltas.productionDelta !== 0) {
    logs.push({
      event: LOG_EVENTS.CONFIDENCE_CHANGED,
      severity: LogSeverity.DEBUG,
      ...base,
      payload: {
        comprehensionDelta: confidenceDeltas.comprehensionDelta,
        productionDelta: confidenceDeltas.productionDelta,
      },
    });
  }

  return logs;
}
