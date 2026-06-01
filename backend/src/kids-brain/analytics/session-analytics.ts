import type { SessionMemory } from '../contracts/session-memory.js';
import type { PostgresProfileStore } from '../contracts/stores.js';
import type { MasteryRecord } from '../contracts/mastery-record.js';
import type { SessionSummary } from '../shared/types.js';
import { MasteryLevel, ActivityType } from '../shared/enums.js';

export type SessionStopReason = 'completed' | 'safety' | 'timeout' | 'interrupted' | 'abandoned';

/**
 * Builds a SessionSummary from current Redis session state.
 * Only reads server-side state — frontend input is never trusted.
 */
export function buildSessionSummary(
  sessionMemory: SessionMemory,
  stopReason: SessionStopReason,
  endedAt: string,
): SessionSummary {
  const startMs = new Date(sessionMemory.startedAt).getTime();
  const endMs = new Date(endedAt).getTime();
  const durationSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));

  const totalItems = sessionMemory.itemsAttempted.length;
  const masteredCount = sessionMemory.itemsMastered.length;
  const completionRate = totalItems > 0 ? masteredCount / totalItems : null;

  let recoveryEventCount = 0;
  for (const [, state] of sessionMemory.itemState) {
    const wrongAttempts = state.attemptCount - state.correctAttempts;
    if (state.silenceCount > 1 || wrongAttempts > 2) {
      recoveryEventCount++;
    }
  }

  const finalEmotionalSafety = sessionMemory.childState.emotionalSafety;

  return {
    sessionId: sessionMemory.sessionId,
    childId: sessionMemory.childId,
    startedAt: sessionMemory.startedAt,
    endedAt,
    durationSeconds,
    stopReason,
    lessonId: sessionMemory.lessonId ?? null,
    lessonPhaseReached: sessionMemory.lessonPhase,
    itemsAttemptedCount: totalItems,
    itemsMasteredIds: [...sessionMemory.itemsMastered],
    recoveryEventCount,
    l1RescueUsed: sessionMemory.l1AnchorUsedItems.length > 0,
    speakingTurnsCount: sessionMemory.costCounters.turnCount,
    completionRate,
    finalEmotionalSafety,
    parentReviewFlagged: finalEmotionalSafety < 0.3,
  };
}

function deriveMasteryLevel(itemMastery: number, correctAttempts: number): MasteryLevel {
  if (itemMastery >= 0.9 && correctAttempts >= 5) return MasteryLevel.AUTOMATIC;
  if (itemMastery >= 0.7 && correctAttempts >= 3) return MasteryLevel.SECURE;
  if (itemMastery >= 0.4 || correctAttempts >= 1) return MasteryLevel.DEVELOPING;
  return MasteryLevel.EMERGING;
}

/**
 * Builds mastery records for every item the child attempted this session.
 * Confidence is on the 0–100 engine scale (Patch 7).
 */
export function buildMasteryRecordsFromSession(
  sessionMemory: SessionMemory,
): Array<MasteryRecord & { childId: string }> {
  const now = new Date().toISOString();
  const records: Array<MasteryRecord & { childId: string }> = [];

  for (const itemId of sessionMemory.itemsAttempted) {
    const state = sessionMemory.itemState.get(itemId);
    if (!state) continue;

    const masteryLevel = deriveMasteryLevel(state.itemMastery, state.correctAttempts);
    const productionConfidence = Math.min(100, Math.round(state.itemMastery * 100));

    const activityTypesSucceeded: ActivityType[] = [];
    if (state.correctAttempts > 0) activityTypesSucceeded.push(ActivityType.REPEAT_AFTER_ME);

    records.push({
      childId: sessionMemory.childId,
      itemId,
      masteryLevel,
      productionConfidence,
      comprehensionConfidence: productionConfidence,
      correctProductionCount: state.correctAttempts,
      correctComprehensionCount: state.correctAttempts,
      sessionsSeen: 1,
      sessionsWithCorrectProduction: state.correctAttempts > 0 ? 1 : 0,
      promptedCorrectCount: state.promptedCorrectAttempts,
      unpromptedCorrectCount: state.unpromptedCorrectAttempts,
      activityTypesSucceeded,
      lastSeenAt: state.lastSeenAt,
      lastCorrectAt: state.correctAttempts > 0 ? (state.lastSeenAt ?? now) : null,
      reviewDueAt: null,
      introducedAt: sessionMemory.startedAt,
      updatedAt: now,
      sessionAttemptCount: state.attemptCount,
      sessionModelGiven: state.modelGiven,
      sessionL1AnchorUsed: state.l1AnchorUsed,
      sessionMasteryDelta: 0,
    });
  }

  return records;
}

/**
 * Persists session summary and per-item mastery records to Postgres.
 * Non-fatal: errors are logged but never thrown.
 * Idempotent: saveSessionSummary uses ON CONFLICT (session_id) DO NOTHING.
 * saveMasteryRecord uses ON CONFLICT DO UPDATE — safe to call multiple times.
 */
export async function persistKidsBrainAnalytics(
  sessionMemory: SessionMemory,
  stopReason: SessionStopReason,
  profileStore: PostgresProfileStore,
): Promise<void> {
  const endedAt = new Date().toISOString();

  try {
    const summary = buildSessionSummary(sessionMemory, stopReason, endedAt);
    await profileStore.saveSessionSummary(summary);
    console.log(
      `[kids-v1] analytics_summary_saved session=${sessionMemory.sessionId} ` +
      `stopReason=${stopReason} items=${summary.itemsAttemptedCount} mastered=${summary.itemsMasteredIds.length}`,
    );
  } catch (err) {
    console.error('[kids-v1] analytics_summary_error (non-fatal):', err instanceof Error ? err.message : err);
  }

  const masteryRecords = buildMasteryRecordsFromSession(sessionMemory);
  for (const record of masteryRecords) {
    try {
      await profileStore.saveMasteryRecord(record);
    } catch (err) {
      console.error(
        `[kids-v1] analytics_mastery_error itemId=${record.itemId} (non-fatal):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (masteryRecords.length > 0) {
    console.log(
      `[kids-v1] analytics_mastery_saved session=${sessionMemory.sessionId} ` +
      `records=${masteryRecords.length}`,
    );
  }
}
