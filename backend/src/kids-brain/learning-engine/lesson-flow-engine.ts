import { LessonPhase } from '../shared/enums.js';
import type { LearningEngineInput } from './learning-engine-types.js';
import { STAMINA_NO_NEW_ITEMS_E, FRUSTRATION_SCAFFOLD_E } from './learning-constants.js';

/** Result of a lesson flow evaluation. */
export interface LessonFlowEvaluation {
  canIntroduceNewItem: boolean;
  canAdvancePhase: boolean;
  /** True when consolidation coverage is sufficient to move to close. */
  consolidationComplete: boolean;
  blockedReasons: string[];
}

/**
 * Evaluates whether the lesson flow allows introducing new items, advancing phases,
 * or completing consolidation (lesson-flow-engine.yaml, spec §9.4).
 */
export function evaluateLessonFlow(
  input: LearningEngineInput,
  frustration: number,
  stamina: number,
  sessionElapsedSeconds: number,
  maxSessionSeconds: number,
): LessonFlowEvaluation {
  const updatedMemory = input.stateEngineOutput.updatedSessionMemory;
  const phase = updatedMemory.lessonPhase;
  const blockedReasons: string[] = [];

  // ── Can introduce new item ─────────────────────────────────────────────────

  let canIntroduceNewItem = phase === LessonPhase.INTRODUCTION || phase === LessonPhase.PRACTICE;

  // Never introduce new item when frustration is high (R11 equivalent)
  if (frustration >= FRUSTRATION_SCAFFOLD_E) {
    canIntroduceNewItem = false;
    blockedReasons.push(`Frustration ${frustration} >= ${FRUSTRATION_SCAFFOLD_E}: no new items`);
  }

  // Never introduce new item near session end (stamina low)
  if (stamina < STAMINA_NO_NEW_ITEMS_E) {
    canIntroduceNewItem = false;
    blockedReasons.push(`Stamina ${stamina} < ${STAMINA_NO_NEW_ITEMS_E}: no new items`);
  }

  // Not allowed in warm_up, consolidation, or close phases
  if (phase === LessonPhase.WARM_UP || phase === LessonPhase.CONSOLIDATION || phase === LessonPhase.CLOSE) {
    canIntroduceNewItem = false;
    blockedReasons.push(`Phase ${phase} does not allow new item introduction`);
  }

  // Within 2 minutes of session max: no new items
  const remainingSeconds = maxSessionSeconds - sessionElapsedSeconds;
  if (remainingSeconds < 120) {
    canIntroduceNewItem = false;
    blockedReasons.push(`< 2 minutes remaining: no new items`);
  }

  // ── Can advance phase ──────────────────────────────────────────────────────

  const canAdvancePhase = checkPhaseAdvancement(phase, updatedMemory.itemsAttempted, sessionElapsedSeconds);

  // ── Consolidation complete check ───────────────────────────────────────────

  const consolidationComplete = phase === LessonPhase.CONSOLIDATION
    ? checkConsolidationComplete(updatedMemory.itemsAttempted, updatedMemory.recentTurns)
    : false;

  return { canIntroduceNewItem, canAdvancePhase, consolidationComplete, blockedReasons };
}

function checkPhaseAdvancement(
  phase: LessonPhase,
  itemsAttempted: string[],
  sessionElapsedSeconds: number,
): boolean {
  switch (phase) {
    case LessonPhase.WARM_UP:
      // Advance after at least 3 minutes (180 seconds)
      return sessionElapsedSeconds >= 180;

    case LessonPhase.INTRODUCTION:
      // Advance after at least 1 item attempted
      return itemsAttempted.length >= 1;

    case LessonPhase.PRACTICE:
      // Advance after 10 minutes since first item introduced (R60)
      return sessionElapsedSeconds >= 600;

    case LessonPhase.CONSOLIDATION:
      // Advance to close after consolidation is complete
      return false; // checked separately

    case LessonPhase.CLOSE:
      return false;
  }
}

function checkConsolidationComplete(
  itemsAttempted: string[],
  recentTurns: ReadonlyArray<{ wasSuccess: boolean }>,
): boolean {
  if (itemsAttempted.length === 0) return false;

  // Check if last event was a success (required before close)
  const lastTurn = recentTurns[recentTurns.length - 1];
  if (!lastTurn?.wasSuccess) return false;

  // Consolidation requires 70% correct in this phase (spec lesson-flow-engine.yaml)
  const totalTurns = recentTurns.length;
  if (totalTurns === 0) return false;

  const successCount = recentTurns.filter((t) => t.wasSuccess).length;
  return successCount / totalTurns >= 0.7;
}

/**
 * Checks whether the close phase can begin.
 * Rule: close only after success, neutral safe state, or safety close.
 * If last event was failure, easiest_win must be inserted first (spec §4.2, session-completion-engine.yaml).
 */
export function canBeginClose(recentTurns: ReadonlyArray<{ wasSuccess: boolean }>): boolean {
  if (recentTurns.length === 0) return false;
  const lastTurn = recentTurns[recentTurns.length - 1];
  return lastTurn.wasSuccess;
}

/**
 * Returns the current session elapsed time as a fraction of max session seconds.
 * 1.0 = at max time limit.
 */
export function sessionElapsedFraction(elapsedMs: number, maxSessionSeconds: number): number {
  return Math.min(1.0, elapsedMs / 1000 / maxSessionSeconds);
}
