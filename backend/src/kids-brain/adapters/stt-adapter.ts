import type { STTResult } from '../contracts/stt-result.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Normalizes arbitrary WS input into the canonical STTResult interface (Patch 2 §2.2).
 * Does NOT call any external STT provider.
 * The real production adapter (Google Chirp v2) will wrap this interface in Phase 8.
 *
 * Fallback rules for missing fields (Patch 2 §2.3):
 *   - confidence null → downstream perception uses STT_CONFIDENCE_NULL_DEFAULT (0.50)
 *   - languageCode null → L1 detection falls back to Cyrillic script + vocabulary list
 *   - speechDurationMs null → short-utterance STT penalty is skipped
 *   - audioEnergyLevel null → energy not used in classification
 *   - alternatives empty → proceed with text only
 */

export interface SttAdapterInput {
  /** Raw transcription text from the STT system or WS message. null = no speech. */
  text: string | null;
  /** Provider confidence 0.0–1.0. null if unavailable. */
  confidence?: number | null;
  /** Alternative transcriptions ordered by confidence. */
  alternatives?: Array<{ text: string; confidence: number }>;
  /** BCP-47 language code (e.g. "en-US"). null if undetected. */
  languageCode?: string | null;
  /** Total speech duration in ms. null if unavailable. */
  speechDurationMs?: number | null;
  /** Audio energy level 0.0–1.0. null if unavailable. */
  audioEnergyLevel?: number | null;
  /** Time from prompt-end to first phoneme (ms). null if unavailable. */
  speechStartMs?: number | null;
  /** Time from prompt-end to last phoneme (ms). null if unavailable. */
  speechEndMs?: number | null;
  /** Processing latency from submission to result (ms). Defaults to 0 when unknown. */
  processingLatencyMs?: number;
  /** Raw provider payload — for debugging only; never passed to classification. */
  rawProviderPayload?: unknown;
}

export function buildSTTResult(input: SttAdapterInput): STTResult {
  const speechDurationMs =
    input.speechDurationMs ??
    (input.speechStartMs !== null &&
    input.speechStartMs !== undefined &&
    input.speechEndMs !== null &&
    input.speechEndMs !== undefined
      ? input.speechEndMs - input.speechStartMs
      : null);

  return {
    text: input.text ?? null,
    confidence: input.confidence ?? null,
    languageCode: input.languageCode ?? null,
    alternatives: input.alternatives ?? [],
    speechStartMs: input.speechStartMs ?? null,
    speechEndMs: input.speechEndMs ?? null,
    speechDurationMs,
    audioEnergyLevel: input.audioEnergyLevel ?? null,
    provider: 'google_chirp_v2',
    providerRequestId: uuidv4(),
    processingLatencyMs: input.processingLatencyMs ?? 0,
    rawProviderPayload: input.rawProviderPayload,
  };
}

/**
 * Convenience builder for the most common WS case:
 * a plain text transcript with no timing or confidence metadata.
 */
export function buildSTTResultFromText(text: string | null): STTResult {
  return buildSTTResult({ text });
}
