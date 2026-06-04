import { ClassificationLabel, TeacherActionCode } from '../shared/enums.js';
import type { PerceptionBundle } from '../perception/perception-bundle.js';

/** Source of the classification decision (spec §6.2, Phase 3). */
export type ClassificationSource =
  | 'deterministic'
  | 'llm_assisted'
  | 'timeout_fallback'
  | 'safety_override';

/**
 * Full classification result emitted by the Classification Engine (Phase 3).
 *
 * This result is OBSERVATION + ROUTING SIGNALS only.
 * It does NOT update child state, decide progression, or generate teacher responses.
 */
export interface ResponseClassificationResult {
  /** Primary classification label. */
  label: ClassificationLabel;

  /** Classifier confidence 0.0–1.0. */
  confidence: number;

  /** Which classifier path produced this result. */
  source: ClassificationSource;

  /** Human-readable reasons supporting the label. */
  reasons: string[];

  /** Short summary of what the perception bundle observed. */
  perceptionSummary: string;

  /** Matched item ID when a target was confirmed. Optional. */
  matchedTargetItemId?: string;

  /** The transcript segment that matched the target. Optional. */
  matchedText?: string;

  /**
   * True when the label indicates the child needs recovery scaffolding.
   * (e.g., no_response, silence_long, refusal, emotional_shutdown)
   */
  requiresRecovery: boolean;

  /**
   * True only for correct/near-correct labels with sufficient confidence
   * and non-timeout source. The mastery module must still apply its own
   * eligibility rules before updating.
   */
  eligibleForMasteryUpdate: boolean;

  /**
   * True only for safe correct/near-correct labels not from timeout_fallback.
   * False for all recovery, silence, L1-only, nonsense, or refusal labels.
   */
  eligibleForProgression: boolean;

  /** Recommended default teacher action for this label (spec §6.1 Default Action column). */
  recommendedSafeAction: TeacherActionCode;

  /** ISO 8601 timestamp. */
  createdAt: string;
}

// ── Recommended action mapping ────────────────────────────────────────────────

/** Maps each classification label to its default safe teacher action (spec §6.1). */
export const LABEL_TO_ACTION: Readonly<Record<ClassificationLabel, TeacherActionCode>> = {
  [ClassificationLabel.CORRECT_CONFIDENT]:     TeacherActionCode.PRAISE_AND_PROGRESS,
  [ClassificationLabel.CORRECT_HESITANT]:      TeacherActionCode.WARM_PRAISE_CONFIRM,
  [ClassificationLabel.NEAR_CORRECT]:          TeacherActionCode.RECAST_AND_CONFIRM,
  [ClassificationLabel.PRONUNCIATION_VARIANT]: TeacherActionCode.RECAST_AND_CONFIRM,
  [ClassificationLabel.PARTIAL_ANSWER]:        TeacherActionCode.COMPLETE_ANSWER_MODEL,
  [ClassificationLabel.REPEATED_AFTER_MODEL]:  TeacherActionCode.PRAISE_ECHO_THEN_CHECK,
  [ClassificationLabel.WRONG_SEMANTIC]:        TeacherActionCode.WARM_REDIRECT,
  [ClassificationLabel.WRONG_BUT_RELATED]:     TeacherActionCode.WARM_REDIRECT,
  [ClassificationLabel.RANDOM_NONSENSE]:       TeacherActionCode.WARM_REDIRECT,
  [ClassificationLabel.PLAYFUL_NONSENSE]:      TeacherActionCode.PLAY_ALONG_BRIEFLY,
  [ClassificationLabel.AVOIDANCE_NONSENSE]:    TeacherActionCode.PAUSE_AND_CHECK_IN,
  [ClassificationLabel.SILENCE_SHORT]:         TeacherActionCode.HOLD_CURRENT_ITEM,
  [ClassificationLabel.SILENCE_MEDIUM]:        TeacherActionCode.MODEL_ANSWER,
  [ClassificationLabel.SILENCE_LONG]:          TeacherActionCode.MODEL_ANSWER,
  [ClassificationLabel.NO_RESPONSE]:           TeacherActionCode.PAUSE_AND_CHECK_IN,
  [ClassificationLabel.L1_TRANSLATION]:        TeacherActionCode.WARM_PRAISE_CONFIRM,
  [ClassificationLabel.L1_HELP_REQUEST]:       TeacherActionCode.USE_L1_ANCHOR,
  [ClassificationLabel.L1_REFUSAL]:            TeacherActionCode.BACK_OFF_OFFER_CHOICE,
  [ClassificationLabel.CODE_SWITCH]:           TeacherActionCode.WARM_REDIRECT,
  [ClassificationLabel.I_DONT_KNOW]:           TeacherActionCode.ASK_FORCED_CHOICE,
  [ClassificationLabel.REFUSAL]:               TeacherActionCode.BACK_OFF_OFFER_CHOICE,
  [ClassificationLabel.DISTRACTION]:           TeacherActionCode.WARM_REDIRECT,
  [ClassificationLabel.OFF_TOPIC_STORY]:       TeacherActionCode.WARM_REDIRECT,
  [ClassificationLabel.UNSAFE_OR_SENSITIVE]:   TeacherActionCode.ESCALATE_TO_SAFETY,
  [ClassificationLabel.OVEREXCITED]:           TeacherActionCode.WARM_REDIRECT,
  [ClassificationLabel.EMOTIONAL_SHUTDOWN]:    TeacherActionCode.PAUSE_AND_CHECK_IN,
  [ClassificationLabel.TEST_THE_AI]:           TeacherActionCode.WARM_REDIRECT,
  [ClassificationLabel.UNKNOWN_UNCERTAIN]:     TeacherActionCode.HOLD_CURRENT_ITEM,
  [ClassificationLabel.CLARIFICATION_REQUEST]: TeacherActionCode.MODEL_ANSWER,
};

/** Labels that require recovery scaffolding when detected. */
const RECOVERY_LABELS = new Set<ClassificationLabel>([
  ClassificationLabel.NO_RESPONSE,
  ClassificationLabel.SILENCE_LONG,
  ClassificationLabel.REFUSAL,
  ClassificationLabel.L1_REFUSAL,
  ClassificationLabel.AVOIDANCE_NONSENSE,
  ClassificationLabel.EMOTIONAL_SHUTDOWN,
  ClassificationLabel.UNKNOWN_UNCERTAIN,
]);

/** Labels that are eligible for mastery update (before confidence/source check). */
const MASTERY_ELIGIBLE_LABELS = new Set<ClassificationLabel>([
  ClassificationLabel.CORRECT_CONFIDENT,
  ClassificationLabel.CORRECT_HESITANT,
  ClassificationLabel.NEAR_CORRECT,
  ClassificationLabel.PRONUNCIATION_VARIANT,
]);

/** Labels that are eligible for progression. */
const PROGRESSION_ELIGIBLE_LABELS = new Set<ClassificationLabel>([
  ClassificationLabel.CORRECT_CONFIDENT,
  ClassificationLabel.CORRECT_HESITANT,
  ClassificationLabel.NEAR_CORRECT,
]);

// ── Builder ───────────────────────────────────────────────────────────────────

interface BuildResultParams {
  label: ClassificationLabel;
  confidence: number;
  source: ClassificationSource;
  reasons: string[];
  perception: PerceptionBundle;
  requiresRecovery?: boolean;
  eligibleForMasteryUpdate?: boolean;
  eligibleForProgression?: boolean;
  recommendedSafeAction?: TeacherActionCode;
  matchedTargetItemId?: string;
  matchedText?: string;
}

/**
 * Builds a ResponseClassificationResult with computed defaults.
 * Callers may override requiresRecovery/eligibility when they have
 * context that the defaults cannot derive (e.g., timeout_fallback always
 * sets eligibleForMasteryUpdate=false regardless of label).
 */
export function buildResult(params: BuildResultParams): ResponseClassificationResult {
  const {
    label, confidence, source, reasons, perception,
    matchedTargetItemId, matchedText,
  } = params;

  const requiresRecovery = params.requiresRecovery ?? RECOVERY_LABELS.has(label);
  const isMasteryEligibleLabel = MASTERY_ELIGIBLE_LABELS.has(label);
  const isProgressionEligibleLabel = PROGRESSION_ELIGIBLE_LABELS.has(label);
  const isTimeoutFallback = source === 'timeout_fallback';

  const eligibleForMasteryUpdate =
    params.eligibleForMasteryUpdate ??
    (isMasteryEligibleLabel && !isTimeoutFallback && confidence >= 0.60);

  const eligibleForProgression =
    params.eligibleForProgression ??
    (isProgressionEligibleLabel && !isTimeoutFallback);

  const recommendedSafeAction =
    params.recommendedSafeAction ?? LABEL_TO_ACTION[label];

  const perceptionSummary = buildPerceptionSummary(perception);

  return {
    label,
    confidence,
    source,
    reasons,
    perceptionSummary,
    matchedTargetItemId,
    matchedText,
    requiresRecovery,
    eligibleForMasteryUpdate,
    eligibleForProgression,
    recommendedSafeAction,
    createdAt: new Date().toISOString(),
  };
}

function buildPerceptionSummary(p: PerceptionBundle): string {
  if (p.isNoResponse) return 'no_response: no transcript, no audio';
  if (p.isSilence && !p.transcriptAvailable) {
    return `silence_${p.silenceDurationMs}ms: no transcript`;
  }
  if (p.l1Detected) {
    return `l1_detected: ${p.l1Script ?? 'unknown'}, hint=${p.l1IntentHint ?? 'none'}`;
  }
  const confStr = `adj_conf=${p.adjustedSttConfidence.toFixed(2)}`;
  const latStr = p.responseLatencyMs !== null ? ` lat=${p.responseLatencyMs}ms` : '';
  return `transcript: "${p.normalizedTranscript ?? ''}" ${confStr}${latStr}`;
}
