import { ClassificationLabel, RecoveryState } from '../shared/enums.js';
import type { ChildState } from '../state/child-state.js';
import type { TurnRecord } from '../contracts/turn-record.js';

const SILENCE_LABELS = new Set<ClassificationLabel>([
  ClassificationLabel.SILENCE_LONG,
  ClassificationLabel.SILENCE_MEDIUM,
  ClassificationLabel.NO_RESPONSE,
]);

const SUCCESS_LABELS = new Set<ClassificationLabel>([
  ClassificationLabel.CORRECT_CONFIDENT,
  ClassificationLabel.CORRECT_HESITANT,
  ClassificationLabel.NEAR_CORRECT,
  ClassificationLabel.PRONUNCIATION_VARIANT,
  ClassificationLabel.PARTIAL_ANSWER,
  ClassificationLabel.REPEATED_AFTER_MODEL,
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
]);

/**
 * Computes projected recentFailureCount using last 4 turns from history + current label.
 * This gives the accurate rolling-window count that will exist AFTER the turn is appended,
 * so recovery state decisions are based on the correct projected state.
 */
function projectFailureCount(recentTurns: readonly TurnRecord[], label: ClassificationLabel): number {
  const window = recentTurns.slice(-4); // last 4 + current = 5-turn window
  const prevFailures = window.filter(t => FAILURE_LABELS.has(t.classificationLabel)).length;
  return prevFailures + (FAILURE_LABELS.has(label) ? 1 : 0);
}

/**
 * Counts how many of the last N recent turns had a silence-group label.
 */
function countRecentSilence(recentTurns: readonly TurnRecord[], windowSize: number): number {
  return recentTurns.slice(-windowSize).filter(t => SILENCE_LABELS.has(t.classificationLabel)).length;
}

/**
 * Determines the new recovery state after applying a classification label.
 *
 * Rules from spec §11.1 and Phase 4 update rules.
 * Recovery is derived from classification + updated child state.
 *
 * Priority order:
 * 0. Success during non-normal recovery → repaired_success (checked before escalation tiers)
 * 1. emotional_shutdown overrides all lower states
 * 2. refusal overrides mild_confusion
 * 3. frustration_risk from state thresholds
 * 4. disengagement
 * 5. repeated_failure (using projected count)
 * 6. mild_confusion (using projected count)
 */
export function computeNewRecoveryState(
  currentRecovery: RecoveryState,
  updatedChildState: ChildState,
  label: ClassificationLabel,
  recentTurns: readonly TurnRecord[],
): RecoveryState {
  // ── Priority 0: repaired_success — success during active recovery ──────────
  // Must be checked BEFORE tier escalations so a correct answer during
  // repeated_failure → repaired_success, not → repeated_failure (no change).
  if (
    SUCCESS_LABELS.has(label) &&
    currentRecovery !== RecoveryState.NORMAL &&
    currentRecovery !== RecoveryState.REPAIRED_SUCCESS &&
    currentRecovery !== RecoveryState.EMOTIONAL_SHUTDOWN
  ) {
    return RecoveryState.REPAIRED_SUCCESS;
  }

  // ── Exit repaired_success → normal on second consecutive success ──────────
  if (currentRecovery === RecoveryState.REPAIRED_SUCCESS && SUCCESS_LABELS.has(label)) {
    // Last turn in history was already a success → this is the second consecutive success
    const lastTurn = recentTurns[recentTurns.length - 1];
    if (lastTurn && SUCCESS_LABELS.has(lastTurn.classificationLabel)) {
      return RecoveryState.NORMAL;
    }
    return RecoveryState.REPAIRED_SUCCESS; // first consecutive success; wait for second
  }

  // ── Tier 1: emotional_shutdown overrides everything ────────────────────────
  if (label === ClassificationLabel.EMOTIONAL_SHUTDOWN) {
    return RecoveryState.EMOTIONAL_SHUTDOWN;
  }
  if (
    updatedChildState.emotionalSafety < 0.35 &&
    (label === ClassificationLabel.REFUSAL || SILENCE_LABELS.has(label)) &&
    updatedChildState.recentFailureCount >= 3
  ) {
    return RecoveryState.EMOTIONAL_SHUTDOWN;
  }

  // ── Tier 2: refusal ────────────────────────────────────────────────────────
  if (label === ClassificationLabel.REFUSAL || label === ClassificationLabel.L1_REFUSAL) {
    return RecoveryState.REFUSAL;
  }

  // ── Tier 3: frustration_risk ───────────────────────────────────────────────
  if (
    updatedChildState.frustrationRisk >= 0.50 &&
    currentRecovery !== RecoveryState.EMOTIONAL_SHUTDOWN &&
    currentRecovery !== RecoveryState.REFUSAL
  ) {
    return RecoveryState.FRUSTRATION_RISK;
  }

  // ── Tier 4: disengagement ──────────────────────────────────────────────────
  if (
    updatedChildState.engagementLevel < 0.30 &&
    currentRecovery !== RecoveryState.EMOTIONAL_SHUTDOWN &&
    currentRecovery !== RecoveryState.REFUSAL &&
    currentRecovery !== RecoveryState.FRUSTRATION_RISK
  ) {
    return RecoveryState.DISENGAGEMENT;
  }

  // ── Projected failure count (rolling window: last 4 history turns + current) ──
  const projectedFailureCount = projectFailureCount(recentTurns, label);

  // ── Tier 5: repeated_failure ───────────────────────────────────────────────
  if (
    projectedFailureCount >= 3 &&
    currentRecovery !== RecoveryState.EMOTIONAL_SHUTDOWN &&
    currentRecovery !== RecoveryState.REFUSAL &&
    currentRecovery !== RecoveryState.FRUSTRATION_RISK
  ) {
    return RecoveryState.REPEATED_FAILURE;
  }

  // ── Tier 6: mild_confusion ─────────────────────────────────────────────────
  if (
    projectedFailureCount >= 2 &&
    currentRecovery === RecoveryState.NORMAL
  ) {
    return RecoveryState.MILD_CONFUSION;
  }

  // ── Silence escalation: only on repeated silence (§Phase 4 rules) ─────────
  // silence_long alone = "long" qualifier; repeated silence = even more so
  if (label === ClassificationLabel.SILENCE_LONG || label === ClassificationLabel.NO_RESPONSE) {
    const previousSilenceCount = countRecentSilence(recentTurns, 3);
    if (previousSilenceCount >= 1 && currentRecovery === RecoveryState.NORMAL) {
      return RecoveryState.MILD_CONFUSION;
    }
  }

  return currentRecovery;
}
