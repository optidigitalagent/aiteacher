import type { RecoveryState } from '../shared/enums.js';
import type { SessionScore } from '../shared/score.js';

/**
 * Child's session-level psychological/learning state (§7.1).
 * All numeric variables are on the 0.0–1.0 session scale.
 * Conversion to 0–100 engine scale happens only in state-delta.applier.ts (Patch 7).
 */
export interface ChildState {
  /** Does the child understand the current task? Initial: 0.5 */
  comprehensionConfidence: SessionScore;

  /** Can the child produce English output? Initial: profile baseline (default 0.30) */
  productionConfidence: SessionScore;

  /** Used to adjust STT tolerance only — not a direct teaching target. Initial: 0.4 */
  pronunciationConfidence: SessionScore;

  /** How safe does the child feel in this session? Initial: 0.75 */
  emotionalSafety: SessionScore;

  /** Is the child attending to the task? Initial: 0.65 */
  engagementLevel: SessionScore;

  /** Probability approaching frustration. Initial: 0.05 */
  frustrationRisk: SessionScore;

  /** Remaining session capacity. Initial: 1.0; decays over time. */
  sessionStamina: SessionScore;

  /** Fatigue with current activity type. Initial: 0.0; resets on activity switch. */
  activityFatigue: SessionScore;

  /** Session reliance on L1. Initial: 0.20 */
  l1Dependency: SessionScore;

  /** Rolling window of last 5 turns: count of successes */
  recentSuccessCount: number;

  /** Rolling window of last 5 turns: count of failures */
  recentFailureCount: number;

  /** Current recovery state (mirrors recovery state machine) */
  recoveryLevel: RecoveryState;
}
