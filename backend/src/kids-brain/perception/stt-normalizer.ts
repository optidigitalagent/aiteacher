import type { STTResult } from '../contracts/stt-result.js';
import { AgeBand } from '../shared/enums.js';
import {
  STT_CONFIDENCE_NULL_DEFAULT,
  STT_CHILD_SPEECH_PRIOR_6_7,
  STT_CHILD_SPEECH_PRIOR_8_9,
  STT_SHORT_UTTERANCE_THRESHOLD_MS,
  STT_SHORT_UTTERANCE_PENALTY,
  STT_RESPONSE_LENGTH_1_WORD,
  STT_RESPONSE_LENGTH_2_WORD,
} from '../shared/constants.js';

export interface NormalizedStt {
  rawTranscript: string | null;
  normalizedTranscript: string | null;
  textLowercased: string | null;
  transcriptAvailable: boolean;
  wordCount: number;
  sttConfidence: number;
  adjustedSttConfidence: number;
  sttConfidenceMissing: boolean;
  speechDurationMs: number | null;
  audioEnergyLevel: number | null;
  alternatives: Array<{ text: string; confidence: number }>;
  detectedLanguageHints: string[];
  hasAudio: boolean;
}

/**
 * Normalizes raw STTResult into a safe, typed NormalizedStt.
 * All null/missing fields are handled without crashing (spec §5.7, Patch 2 §2.3).
 */
export function normalizeSTT(stt: STTResult, ageBand: AgeBand): NormalizedStt {
  const rawTranscript = stt.text;
  const sttConfidenceMissing = stt.confidence === null;
  const baseConfidence = stt.confidence ?? STT_CONFIDENCE_NULL_DEFAULT;
  const speechDurationMs = stt.speechDurationMs ?? null;
  const audioEnergyLevel = stt.audioEnergyLevel ?? null;

  const transcriptAvailable = rawTranscript !== null && rawTranscript.trim().length > 0;
  const normalizedTranscript = transcriptAvailable ? rawTranscript!.trim() : null;
  const textLowercased = normalizedTranscript ? normalizedTranscript.toLowerCase() : null;
  const wordCount = textLowercased
    ? textLowercased.split(/\s+/).filter(Boolean).length
    : 0;

  const adjustedSttConfidence = computeAdjustedConfidence(
    baseConfidence,
    wordCount,
    ageBand,
    speechDurationMs,
  );

  const alternatives = Array.isArray(stt.alternatives) ? stt.alternatives : [];
  const detectedLanguageHints: string[] = stt.languageCode ? [stt.languageCode] : [];
  const hasAudio = transcriptAvailable || (audioEnergyLevel !== null && audioEnergyLevel > 0);

  return {
    rawTranscript,
    normalizedTranscript,
    textLowercased,
    transcriptAvailable,
    wordCount,
    sttConfidence: baseConfidence,
    adjustedSttConfidence,
    sttConfidenceMissing,
    speechDurationMs,
    audioEnergyLevel,
    alternatives,
    detectedLanguageHints,
    hasAudio,
  };
}

/** Patch 2 §2.4 — all multipliers are [C] and stored as named constants. */
function computeAdjustedConfidence(
  base: number,
  wordCount: number,
  ageBand: AgeBand,
  speechDurationMs: number | null,
): number {
  const lengthPenalty =
    wordCount === 0 ? 1.0
    : wordCount === 1 ? STT_RESPONSE_LENGTH_1_WORD
    : wordCount === 2 ? STT_RESPONSE_LENGTH_2_WORD
    : 1.0;

  const childSpeechPrior =
    ageBand === AgeBand.SIX_SEVEN
      ? STT_CHILD_SPEECH_PRIOR_6_7
      : STT_CHILD_SPEECH_PRIOR_8_9;

  const durationPenalty =
    speechDurationMs !== null && speechDurationMs < STT_SHORT_UTTERANCE_THRESHOLD_MS
      ? STT_SHORT_UTTERANCE_PENALTY
      : 1.0;

  return Math.max(0, Math.min(1, base * lengthPenalty * childSpeechPrior * durationPenalty));
}
