import type { PerceptionBundle } from './perception-bundle.js';
import type { PerceptionInput, UncertaintyReason } from './perception-types.js';
import type { NormalizedStt } from './stt-normalizer.js';
import type { L1DetectionResult } from './l1-detector.js';
import type { LatencyAnalysis } from './latency-analyzer.js';
import type { SilenceAnalysis } from './silence-analyzer.js';
import { normalizeSTT } from './stt-normalizer.js';
import { detectL1 } from './l1-detector.js';
import { analyzeLatency } from './latency-analyzer.js';
import { analyzeSilence } from './silence-analyzer.js';
import { computeInputQuality } from './input-quality.js';
import { PERCEPTION_UNCERTAINTY_THRESHOLD } from './perception-constants.js';
import { STT_SHORT_UTTERANCE_THRESHOLD_MS } from '../shared/constants.js';

/**
 * Assembles a PerceptionBundle from raw signals.
 * Deterministic. No LLM. No side effects. Pure function.
 */
export function buildPerceptionBundle(input: PerceptionInput): PerceptionBundle {
  const stt = normalizeSTT(input.stt, input.ageBand);
  const l1 = stt.normalizedTranscript
    ? detectL1(stt.normalizedTranscript)
    : emptyL1Result();
  const latency = analyzeLatency(input.responseLatencyMs, input.ageBand);
  const silence = analyzeSilence(input.silenceDurationMs, input.ageBand, stt.transcriptAvailable);
  const inputQuality = computeInputQuality(
    stt.rawTranscript,
    stt.wordCount,
    stt.adjustedSttConfidence,
  );
  const perceptionConfidence = computePerceptionConfidence(stt, silence, input.attemptCount);
  const { uncertaintyReasons, safeForDeterministicClassification, requiresLLMAssistedClassification } =
    computeUncertainty(stt, l1, latency, perceptionConfidence);

  return {
    rawTranscript: stt.rawTranscript,
    normalizedTranscript: stt.normalizedTranscript,
    textLowercased: stt.textLowercased,
    transcriptAvailable: stt.transcriptAvailable,
    wordCount: stt.wordCount,
    sttConfidence: stt.sttConfidence,
    adjustedSttConfidence: stt.adjustedSttConfidence,
    sttConfidenceMissing: stt.sttConfidenceMissing,
    perceptionConfidence,
    alternatives: stt.alternatives,
    detectedLanguageHints: stt.detectedLanguageHints,
    l1Detected: l1.l1Detected,
    l1ScriptDetected: l1.l1ScriptDetected,
    l1KeywordDetected: l1.l1KeywordDetected,
    l1Script: l1.l1Script,
    l1IntentHint: l1.l1IntentHint,
    l1Word: l1.l1Word,
    responseLatencyMs: input.responseLatencyMs,
    silenceDurationMs: input.silenceDurationMs,
    speechDurationMs: stt.speechDurationMs,
    isVeryFast: latency.isVeryFast,
    isHesitant: latency.isHesitant,
    isFastAnswer: latency.isFastAnswer,
    isNormalAnswer: latency.isNormalAnswer,
    isSlowAnswer: latency.isSlowAnswer,
    isMissingLatency: latency.isMissingLatency,
    hasAudio: stt.hasAudio,
    isSilence: silence.isSilence,
    isShortSilence: silence.isShortSilence,
    isLongSilence: silence.isLongSilence,
    isNoResponse: silence.isNoResponse,
    inputQuality,
    uncertaintyReasons,
    safeForDeterministicClassification,
    requiresLLMAssistedClassification,
    promptContext: input.promptContext,
    childStateSnapshot: input.childState,
    createdAt: new Date().toISOString(),
  };
}

/** Spec §5.6 perception_confidence formula. */
function computePerceptionConfidence(
  stt: NormalizedStt,
  silence: SilenceAnalysis,
  attemptCount: number,
): number {
  let conf = stt.adjustedSttConfidence;
  if (silence.isSilence) conf *= 0.6;
  if (attemptCount > 2) conf *= 0.8;
  if (stt.wordCount === 1) conf *= 0.9;
  return Math.max(0, Math.min(1, conf));
}

function computeUncertainty(
  stt: NormalizedStt,
  l1: L1DetectionResult,
  latency: LatencyAnalysis,
  perceptionConfidence: number,
): {
  uncertaintyReasons: UncertaintyReason[];
  safeForDeterministicClassification: boolean;
  requiresLLMAssistedClassification: boolean;
} {
  const reasons: UncertaintyReason[] = [];

  if (!stt.transcriptAvailable) reasons.push('no_transcript');
  if (stt.sttConfidenceMissing) reasons.push('stt_confidence_missing');
  if (stt.adjustedSttConfidence < PERCEPTION_UNCERTAINTY_THRESHOLD) reasons.push('low_stt_confidence');
  if (latency.isMissingLatency) reasons.push('missing_latency');
  if (l1.l1Detected) reasons.push('l1_detected');
  if (
    stt.wordCount === 1 &&
    stt.speechDurationMs !== null &&
    stt.speechDurationMs < STT_SHORT_UTTERANCE_THRESHOLD_MS
  ) {
    reasons.push('very_short_utterance');
  }

  const safeForDeterministicClassification = perceptionConfidence >= PERCEPTION_UNCERTAINTY_THRESHOLD;
  const requiresLLMAssistedClassification = !safeForDeterministicClassification;

  return { uncertaintyReasons: reasons, safeForDeterministicClassification, requiresLLMAssistedClassification };
}

function emptyL1Result(): L1DetectionResult {
  return {
    l1Detected: false,
    l1ScriptDetected: false,
    l1KeywordDetected: false,
    l1Script: null,
    l1IntentHint: null,
    l1Word: null,
  };
}
