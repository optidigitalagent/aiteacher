import { ClassificationLabel, TeacherActionCode, PromptType } from '../shared/enums.js';
import type { PerceptionBundle } from '../perception/perception-bundle.js';
import type { ResponseClassificationResult } from './classification-result.js';
import { buildResult } from './classification-result.js';
import type { ActivityContext, ItemVocabularyContext } from './classification-types.js';
import {
  UNSAFE_KEYWORDS,
  I_DONT_KNOW_PHRASES,
  REFUSAL_PHRASES,
  CLARIFICATION_PHRASES,
  EXERCISE_READINESS_PHRASES,
  NEAR_MATCH_EDIT_DISTANCE_MAX,
  CORRECT_CONFIDENT_MIN_ADJ_CONFIDENCE,
  CORRECT_HESITANT_MIN_ADJ_CONFIDENCE,
  CORRECT_CONFIDENT_LATENCY_MIN_MS,
  CORRECT_CONFIDENT_LATENCY_MAX_MS,
  REPEATED_AFTER_MODEL_MAX_LATENCY_MS,
  FORCED_CHOICE_POSSIBLE_GUESS_LATENCY_MS,
} from './classification-constants.js';
import {
  isExactMatch,
  isNearMatch,
  isWrongButRelated,
  normalizeText,
  containsTargetWord,
} from './semantic-matcher.js';
import { isPhoneticMatch } from './phonetic-matcher.js';
import {
  SILENCE_THRESHOLD_SHORT_MS,
  SILENCE_THRESHOLD_MEDIUM_MS,
  SILENCE_AGE_ADJUSTMENT_6_7_MS,
} from '../shared/constants.js';
import { AgeBand } from '../shared/enums.js';
import type { AgeProfile } from '../shared/types.js';

/**
 * Deterministic fast-path classifier (spec §6.1, Phase 3).
 *
 * Returns a ResponseClassificationResult when a deterministic label can be
 * assigned with confidence. Returns null when the input is ambiguous and
 * should be routed to the LLM-assisted classifier.
 *
 * Rules are evaluated in priority order. First match wins.
 * Safety override ALWAYS runs first regardless of other signals.
 */
export function runDeterministicClassifier(
  perception: PerceptionBundle,
  activityContext: ActivityContext,
  ageProfile: AgeProfile,
  vocabularyContext?: ItemVocabularyContext,
): ResponseClassificationResult | null {
  const transcript = perception.normalizedTranscript ?? '';
  const transcriptLower = transcript.toLowerCase();

  // ── Rule 1: Safety override (hard, always first) ──────────────────────────
  const unsafeKeyword = UNSAFE_KEYWORDS.find(kw => transcriptLower.includes(kw));
  if (unsafeKeyword) {
    return buildResult({
      label: ClassificationLabel.UNSAFE_OR_SENSITIVE,
      confidence: 0.30,
      source: 'safety_override',
      reasons: [`unsafe_keyword_matched: ${unsafeKeyword}`],
      perception,
      requiresRecovery: true,
      eligibleForMasteryUpdate: false,
      eligibleForProgression: false,
      recommendedSafeAction: TeacherActionCode.ESCALATE_TO_SAFETY,
    });
  }

  // ── Rule 2: No response ────────────────────────────────────────────────────
  if (perception.isNoResponse) {
    return buildResult({
      label: ClassificationLabel.NO_RESPONSE,
      confidence: 1.0,
      source: 'deterministic',
      reasons: ['no_transcript', 'no_audio_or_exceeded_silence_threshold'],
      perception,
    });
  }

  // ── Rules 3–4: Silence (no transcript present) ────────────────────────────
  if (!perception.transcriptAvailable) {
    const adj = ageProfile.ageBand === AgeBand.SIX_SEVEN ? SILENCE_AGE_ADJUSTMENT_6_7_MS : 0;
    const mediumThreshold = SILENCE_THRESHOLD_MEDIUM_MS + adj;
    const shortThreshold = SILENCE_THRESHOLD_SHORT_MS + adj;

    if (perception.silenceDurationMs >= mediumThreshold) {
      return buildResult({
        label: ClassificationLabel.SILENCE_LONG,
        confidence: 1.0,
        source: 'deterministic',
        reasons: [`silence_${perception.silenceDurationMs}ms_exceeds_medium_threshold`],
        perception,
      });
    }
    if (perception.silenceDurationMs >= shortThreshold) {
      return buildResult({
        label: ClassificationLabel.SILENCE_MEDIUM,
        confidence: 1.0,
        source: 'deterministic',
        reasons: [`silence_${perception.silenceDurationMs}ms_medium_range`],
        perception,
      });
    }
    return buildResult({
      label: ClassificationLabel.SILENCE_SHORT,
      confidence: 1.0,
      source: 'deterministic',
      reasons: [`silence_${perception.silenceDurationMs}ms_below_short_threshold`],
      perception,
    });
  }

  // ── From here: transcript is available ───────────────────────────────────

  // ── Rule 5: L1 help request ───────────────────────────────────────────────
  if (perception.l1Detected && perception.l1IntentHint === 'help_request') {
    return buildResult({
      label: ClassificationLabel.L1_HELP_REQUEST,
      confidence: 0.90,
      source: 'deterministic',
      reasons: ['l1_detected', 'intent_help_request'],
      perception,
    });
  }

  // ── Rule 6: L1 refusal ────────────────────────────────────────────────────
  if (perception.l1Detected && perception.l1IntentHint === 'refusal') {
    return buildResult({
      label: ClassificationLabel.L1_REFUSAL,
      confidence: 0.90,
      source: 'deterministic',
      reasons: ['l1_detected', 'intent_refusal'],
      perception,
    });
  }

  // ── Rule 7: L1 i_dont_know ────────────────────────────────────────────────
  if (perception.l1Detected && perception.l1IntentHint === 'i_dont_know') {
    return buildResult({
      label: ClassificationLabel.I_DONT_KNOW,
      confidence: 0.90,
      source: 'deterministic',
      reasons: ['l1_detected', 'intent_i_dont_know'],
      perception,
    });
  }

  // ── Rule 8: L1 translation (Cyrillic or known keyword, no specific intent) ─
  if (perception.l1Detected && !hasEnglishContent(transcript)) {
    return buildResult({
      label: ClassificationLabel.L1_TRANSLATION,
      confidence: 0.85,
      source: 'deterministic',
      reasons: ['l1_detected', 'no_english_content'],
      perception,
    });
  }

  // ── Rule 9: Code switch (L1 + English both present) ──────────────────────
  if (perception.l1Detected && hasEnglishContent(transcript)) {
    return buildResult({
      label: ClassificationLabel.CODE_SWITCH,
      confidence: 0.75,
      source: 'deterministic',
      reasons: ['l1_detected', 'english_also_present'],
      perception,
    });
  }

  // ── Rule 10: I don't know (English phrases) ───────────────────────────────
  if (matchesIDoNotKnow(transcriptLower)) {
    return buildResult({
      label: ClassificationLabel.I_DONT_KNOW,
      confidence: 0.95,
      source: 'deterministic',
      reasons: ['exact_i_dont_know_phrase'],
      perception,
    });
  }

  // ── Rule 10.5: Clarification request ("What should I say?", "help me", etc.) ─
  if (matchesClarificationRequest(transcriptLower)) {
    return buildResult({
      label: ClassificationLabel.CLARIFICATION_REQUEST,
      confidence: 0.95,
      source: 'deterministic',
      reasons: ['clarification_phrase_matched'],
      perception,
      requiresRecovery: false,
      eligibleForMasteryUpdate: false,
      eligibleForProgression: false,
      recommendedSafeAction: TeacherActionCode.MODEL_ANSWER,
    });
  }

  // ── Rule 10.6: Mid-exercise readiness phrase ("Yes I'm ready", "I'm ready") ──
  // Child is already in an exercise but signals readiness/confusion.
  // Treat as clarification — teacher should repeat the concrete instruction.
  if (matchesExerciseReadiness(transcriptLower)) {
    return buildResult({
      label: ClassificationLabel.CLARIFICATION_REQUEST,
      confidence: 0.90,
      source: 'deterministic',
      reasons: ['exercise_readiness_phrase_matched'],
      perception,
      requiresRecovery: false,
      eligibleForMasteryUpdate: false,
      eligibleForProgression: false,
      recommendedSafeAction: TeacherActionCode.MODEL_ANSWER,
    });
  }

  // ── Rule 11: Simple refusal (guard: not a YES_NO task answer) ────────────
  if (
    activityContext.promptType !== PromptType.YES_NO &&
    matchesRefusal(transcriptLower)
  ) {
    return buildResult({
      label: ClassificationLabel.REFUSAL,
      confidence: 0.85,
      source: 'deterministic',
      reasons: ['refusal_phrase_matched'],
      perception,
    });
  }

  // ── Rules 12–15 require a target item ────────────────────────────────────
  const targetWord = vocabularyContext?.targetWord ?? activityContext.currentTargetItemId;

  if (targetWord) {
    // ── Rule 12: Repeated after model ──────────────────────────────────────
    if (
      activityContext.modelWasGiven &&
      perception.responseLatencyMs !== null &&
      perception.responseLatencyMs < REPEATED_AFTER_MODEL_MAX_LATENCY_MS &&
      isNearMatch(transcript, targetWord, NEAR_MATCH_EDIT_DISTANCE_MAX)
    ) {
      return buildResult({
        label: ClassificationLabel.REPEATED_AFTER_MODEL,
        confidence: 0.88,
        source: 'deterministic',
        reasons: ['model_given', 'fast_response', 'near_match'],
        perception,
        matchedTargetItemId: activityContext.currentTargetItemId ?? undefined,
        matchedText: transcript,
      });
    }

    // ── Rule 13: Exact target match → correct_confident / correct_hesitant ──
    const _exactMatch = isExactMatch(transcript, targetWord);
    const _nearMatch  = isNearMatch(transcript, targetWord, NEAR_MATCH_EDIT_DISTANCE_MAX);
    const _phonMatch  = isPhoneticMatch(transcript, targetWord);

    if (_exactMatch) {
      const label = resolveCorrectLabel(perception, activityContext, ageProfile);
      const reasons: string[] = ['exact_match'];
      if (label === ClassificationLabel.CORRECT_HESITANT) reasons.push('hesitant_or_low_confidence');

      return buildResult({
        label,
        confidence: label === ClassificationLabel.CORRECT_CONFIDENT ? 0.95 : 0.80,
        source: 'deterministic',
        reasons,
        perception,
        matchedTargetItemId: activityContext.currentTargetItemId ?? undefined,
        matchedText: transcript,
      });
    }

    // ── Rule 14: Phonetic match → pronunciation_variant ──────────────────
    if (_phonMatch) {
      return buildResult({
        label: ClassificationLabel.PRONUNCIATION_VARIANT,
        confidence: 0.72,
        source: 'deterministic',
        reasons: ['phonetic_match', 'not_exact'],
        perception,
        matchedTargetItemId: activityContext.currentTargetItemId ?? undefined,
        matchedText: transcript,
      });
    }

    // ── Rule 15: Near match (edit distance ≤ 2) → near_correct ──────────
    if (_nearMatch) {
      return buildResult({
        label: ClassificationLabel.NEAR_CORRECT,
        confidence: 0.75,
        source: 'deterministic',
        reasons: ['near_match_edit_distance'],
        perception,
        matchedTargetItemId: activityContext.currentTargetItemId ?? undefined,
        matchedText: transcript,
      });
    }

    // ── Rule 16: Partial answer (multi-word target, one word present) ─────
    const targetNorm = normalizeText(targetWord);
    if (targetNorm.includes(' ') && containsTargetWord(transcript, targetWord)) {
      return buildResult({
        label: ClassificationLabel.PARTIAL_ANSWER,
        confidence: 0.70,
        source: 'deterministic',
        reasons: ['partial_match_multi_word_target'],
        perception,
        matchedTargetItemId: activityContext.currentTargetItemId ?? undefined,
        matchedText: transcript,
      });
    }

    // ── Rule 17: Wrong but related (vocabulary group check) ──────────────
    if (
      vocabularyContext &&
      isWrongButRelated(transcript, targetWord, vocabularyContext.vocabularyGroup)
    ) {
      return buildResult({
        label: ClassificationLabel.WRONG_BUT_RELATED,
        confidence: 0.70,
        source: 'deterministic',
        reasons: ['in_vocabulary_group', 'not_target'],
        perception,
      });
    }
  }

  // ── No deterministic rule matched — signal LLM path ──────────────────────
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveCorrectLabel(
  perception: PerceptionBundle,
  activityContext: ActivityContext,
  ageProfile: AgeProfile,
): ClassificationLabel {
  const { adjustedSttConfidence, responseLatencyMs, isHesitant } = perception;

  // Guard: fast forced_choice answer on first attempt → downgrade (spec §6.1)
  if (
    activityContext.attemptNumber === 1 &&
    activityContext.promptType === PromptType.FORCED_CHOICE &&
    responseLatencyMs !== null &&
    responseLatencyMs < FORCED_CHOICE_POSSIBLE_GUESS_LATENCY_MS
  ) {
    return ClassificationLabel.CORRECT_HESITANT;
  }

  if (
    adjustedSttConfidence >= CORRECT_CONFIDENT_MIN_ADJ_CONFIDENCE &&
    responseLatencyMs !== null &&
    responseLatencyMs >= CORRECT_CONFIDENT_LATENCY_MIN_MS &&
    responseLatencyMs <= CORRECT_CONFIDENT_LATENCY_MAX_MS &&
    !isHesitant
  ) {
    return ClassificationLabel.CORRECT_CONFIDENT;
  }

  return ClassificationLabel.CORRECT_HESITANT;
}

function matchesIDoNotKnow(text: string): boolean {
  return I_DONT_KNOW_PHRASES.some(phrase => text.includes(phrase));
}

function matchesClarificationRequest(text: string): boolean {
  return CLARIFICATION_PHRASES.some(phrase => text.includes(phrase));
}

function matchesExerciseReadiness(text: string): boolean {
  const normalized = text.replace(/[.!?,]+/g, '').replace(/\s+/g, ' ').trim();
  return EXERCISE_READINESS_PHRASES.some(phrase => normalized === phrase || normalized.includes(phrase));
}

function matchesRefusal(text: string): boolean {
  // Only "no" alone counts as refusal; "no" as part of a word does not
  const trimmed = text.trim();
  if (trimmed === 'no') return true;
  return REFUSAL_PHRASES.filter(p => p !== 'no').some(phrase => trimmed.includes(phrase));
}

/** True if the text contains recognizable English alphabetic content. */
function hasEnglishContent(text: string): boolean {
  return /[a-z]{2,}/i.test(text);
}
