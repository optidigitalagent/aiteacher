import type { ActivityType, PromptType } from '../shared/enums.js';
import type { AgeBand } from '../shared/enums.js';
import type { TurnRecord } from '../contracts/turn-record.js';
import type { STTResult } from '../contracts/stt-result.js';

/** Minimal prompt context fed into the perception module per turn (spec §5.1). */
export interface PromptContext {
  promptType: PromptType;
  targetItem: string | null;
  activityType: ActivityType | null;
}

/**
 * Read-only snapshot of child state passed through PerceptionBundle to the
 * classifier. The classifier must not mutate it.
 */
export interface ChildStateSnapshot {
  comprehensionConfidence: number; // 0.0–1.0
  productionConfidence: number;    // 0.0–1.0
  emotionalSafety: number;         // 0.0–1.0
  frustrationRisk: number;         // 0.0–1.0
  recentSuccessCount: number;
  recentFailureCount: number;
}

/** Quality of the STT input for classification routing (Phase 2 §InputQuality). */
export enum InputQuality {
  USABLE = 'usable',
  LOW_CONFIDENCE = 'low_confidence',
  EMPTY = 'empty',
  NOISY = 'noisy',
  MISSING = 'missing',
}

/** Reasons contributing to perception uncertainty. Used in safeForDeterministicClassification. */
export type UncertaintyReason =
  | 'stt_confidence_missing'
  | 'low_stt_confidence'
  | 'very_short_utterance'
  | 'l1_detected'
  | 'missing_latency'
  | 'no_transcript';

/** Full input accepted by the perception module (spec §5.1–5.2). */
export interface PerceptionInput {
  stt: STTResult;
  /** Server-side ms from prompt-end to response detection. null if not measurable. */
  responseLatencyMs: number | null;
  /** Duration of detected silence (ms). */
  silenceDurationMs: number;
  ageBand: AgeBand;
  /** Number of attempts on the current item this session. */
  attemptCount: number;
  promptContext: PromptContext;
  recentTurns: TurnRecord[];
  /** Snapshot of child state; null if session has not started. */
  childState: ChildStateSnapshot | null;
}
