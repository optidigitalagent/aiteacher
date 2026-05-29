import type { ClassificationLabel } from '../shared/enums.js';

/** Normalized input sent to the LLM classifier. No raw transcripts or child IDs. */
export interface LLMClassificationInput {
  normalizedTranscript: string;
  targetItem: string | null;
  activityType: string;
  promptType: string;
  attemptNumber: number;
  recentLabels: ClassificationLabel[];
  ageBand: string;
}

/** Result returned by the LLM classifier. Must use taxonomy labels only. */
export interface LLMClassificationResult {
  /** Must be a ClassificationLabel from the closed taxonomy. No free-form strings. */
  label: ClassificationLabel;
  confidence: number;
  reasoning?: string;
}

/**
 * Interface-only contract for the LLM classifier (spec §6.2, Phase 3).
 *
 * Phase 3 does NOT implement real LLM calls. This interface defines the
 * contract for future Phase 4 implementation. Test doubles must implement
 * this interface.
 *
 * Hard rules (spec §6.2):
 * - Must return a label from the taxonomy — no free-form labels.
 * - Must return within 400ms hard cap (200ms target).
 * - Deterministic rules always override LLM output when confidence is high.
 */
export interface LLMClassifier {
  classify(input: LLMClassificationInput): Promise<LLMClassificationResult>;
}

/**
 * Labels that are eligible for LLM-assisted classification (Phase 3 §LLM-Assisted).
 * All other labels are handled deterministically.
 */
export const LLM_ELIGIBLE_LABELS: readonly ClassificationLabel[] = [
  'playful_nonsense' as ClassificationLabel,
  'random_nonsense' as ClassificationLabel,
  'avoidance_nonsense' as ClassificationLabel,
  'off_topic_story' as ClassificationLabel,
  'test_the_ai' as ClassificationLabel,
  'wrong_but_related' as ClassificationLabel,
  'wrong_semantic' as ClassificationLabel,
  'distraction' as ClassificationLabel,
  'code_switch' as ClassificationLabel,
];
