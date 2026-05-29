import type { SessionMemory } from '../contracts/session-memory.js';
import type { LogEvent } from '../shared/log-events.js';
import type { CostCounterDelta, StateUpdateSummary } from './state-engine-types.js';

/** A single field-level state change record. */
export interface AppliedUpdate {
  field: string;
  previousValue: unknown;
  newValue: unknown;
}

/** Full output contract of the State Engine (Phase 4). */
export interface StateEngineOutput {
  /** New immutable SessionMemory — input SessionMemory is never mutated. */
  updatedSessionMemory: SessionMemory;

  /** Human-readable summary of what changed this turn. */
  stateUpdateSummary: StateUpdateSummary;

  /** Field-level change log for audit/debugging. */
  appliedUpdates: AppliedUpdate[];

  /** True when recovery state changed as a result of this turn. */
  triggeredRecoveryChange: boolean;

  /** Cost counter increments for this turn. */
  costCounterDelta: CostCounterDelta;

  /**
   * Forwarded from ResponseClassificationResult.
   * State engine does NOT compute mastery eligibility — it passes it through.
   */
  masteryEligibility: boolean;

  /**
   * Forwarded from ResponseClassificationResult.
   * State engine does NOT select progression — it passes it through.
   */
  progressionEligibility: boolean;

  /** Structured log events to emit after this state update. */
  logsToEmit: LogEvent[];
}
