import { ClassificationLabel, TeacherActionCode } from '../shared/enums.js';
import type { PerceptionBundle } from '../perception/perception-bundle.js';
import { buildResult } from './classification-result.js';
import type { ResponseClassificationResult } from './classification-result.js';
import { UNSAFE_KEYWORDS } from './classification-constants.js';

/**
 * Patch 4 — LLM Classification Timeout Fallback.
 *
 * Called when the LLM classifier exceeds the 400ms hard cap.
 * First-match-wins rule table from Patch 4 §6.2.
 *
 * Rules (in order):
 * 1. Unsafe keyword detected                   → unsafe_or_sensitive (0.30)
 * 2. is_silence == true                         → silence_long         (1.0)
 * 3. l1_detected == true                        → l1_translation       (0.60)
 * 4. perception_confidence < 0.50               → silence_medium       (0.55)
 * 5. adj_confidence >= 0.65 AND target known    → correct_hesitant     (0.58)
 * 6. adj_confidence >= 0.65 AND target unknown  → off_topic_story      (0.50)
 * 7. adj_confidence < 0.65 AND failures >= 2   → wrong_semantic       (0.50)
 * 8. default                                    → random_nonsense      (0.50)
 *
 * State updates DO occur per Patch 4.
 * Item mastery is NEVER updated on timeout_fallback.
 */
export function computeTimeoutFallback(
  perception: PerceptionBundle,
  targetItemId: string | null,
  recentFailureCount: number,
): ResponseClassificationResult {
  const transcript = (perception.normalizedTranscript ?? '').toLowerCase();
  const hasUnsafe = UNSAFE_KEYWORDS.some(kw => transcript.includes(kw));

  if (hasUnsafe) {
    return buildResult({
      label: ClassificationLabel.UNSAFE_OR_SENSITIVE,
      confidence: 0.30,
      source: 'safety_override',
      reasons: ['unsafe_keyword_detected', 'timeout_fallback_safety_override'],
      perception,
      requiresRecovery: true,
      eligibleForMasteryUpdate: false,
      eligibleForProgression: false,
      recommendedSafeAction: TeacherActionCode.ESCALATE_TO_SAFETY,
    });
  }

  if (perception.isSilence) {
    return buildResult({
      label: ClassificationLabel.SILENCE_LONG,
      confidence: 1.0,
      source: 'timeout_fallback',
      reasons: ['silence_detected', 'timeout_fallback'],
      perception,
      requiresRecovery: true,
      eligibleForMasteryUpdate: false,
      eligibleForProgression: false,
      recommendedSafeAction: TeacherActionCode.MODEL_ANSWER,
    });
  }

  if (perception.l1Detected) {
    return buildResult({
      label: ClassificationLabel.L1_TRANSLATION,
      confidence: 0.60,
      source: 'timeout_fallback',
      reasons: ['l1_detected', 'timeout_fallback'],
      perception,
      requiresRecovery: false,
      eligibleForMasteryUpdate: false,
      eligibleForProgression: false,
      recommendedSafeAction: TeacherActionCode.WARM_PRAISE_CONFIRM,
    });
  }

  if (perception.perceptionConfidence < 0.50) {
    return buildResult({
      label: ClassificationLabel.SILENCE_MEDIUM,
      confidence: 0.55,
      source: 'timeout_fallback',
      reasons: ['low_perception_confidence', 'timeout_fallback'],
      perception,
      requiresRecovery: false,
      eligibleForMasteryUpdate: false,
      eligibleForProgression: false,
      recommendedSafeAction: TeacherActionCode.MODEL_ANSWER,
    });
  }

  if (perception.adjustedSttConfidence >= 0.65 && targetItemId !== null) {
    return buildResult({
      label: ClassificationLabel.CORRECT_HESITANT,
      confidence: 0.58,
      source: 'timeout_fallback',
      reasons: ['adj_confidence_sufficient', 'target_known', 'timeout_fallback'],
      perception,
      requiresRecovery: false,
      eligibleForMasteryUpdate: false,
      eligibleForProgression: false,
      recommendedSafeAction: TeacherActionCode.WARM_PRAISE_CONFIRM,
    });
  }

  if (perception.adjustedSttConfidence >= 0.65 && targetItemId === null) {
    return buildResult({
      label: ClassificationLabel.OFF_TOPIC_STORY,
      confidence: 0.50,
      source: 'timeout_fallback',
      reasons: ['adj_confidence_sufficient', 'target_unknown', 'timeout_fallback'],
      perception,
      requiresRecovery: false,
      eligibleForMasteryUpdate: false,
      eligibleForProgression: false,
      recommendedSafeAction: TeacherActionCode.WARM_REDIRECT,
    });
  }

  if (perception.adjustedSttConfidence < 0.65 && recentFailureCount >= 2) {
    return buildResult({
      label: ClassificationLabel.WRONG_SEMANTIC,
      confidence: 0.50,
      source: 'timeout_fallback',
      reasons: ['low_confidence', 'recent_failures', 'timeout_fallback'],
      perception,
      requiresRecovery: false,
      eligibleForMasteryUpdate: false,
      eligibleForProgression: false,
      recommendedSafeAction: TeacherActionCode.WARM_REDIRECT,
    });
  }

  // Default — random_nonsense triggers warm_redirect_no_shame (safest fallback)
  return buildResult({
    label: ClassificationLabel.RANDOM_NONSENSE,
    confidence: 0.50,
    source: 'timeout_fallback',
    reasons: ['timeout_fallback_default'],
    perception,
    requiresRecovery: false,
    eligibleForMasteryUpdate: false,
    eligibleForProgression: false,
    recommendedSafeAction: TeacherActionCode.WARM_REDIRECT,
  });
}
