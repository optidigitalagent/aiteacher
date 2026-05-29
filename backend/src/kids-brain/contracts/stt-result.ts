/**
 * Normalized STT result interface (Patch 2 §2.2).
 * The perception module consumes this. No other module imports it directly.
 * A provider adapter (perception/stt-adapter.ts) maps provider output to this shape.
 */
export interface STTResult {
  // Primary transcript
  text: string | null;
  confidence: number | null; // 0.0–1.0; null if unavailable
  languageCode: string | null; // e.g. "en-US"; null if undetected

  // Alternatives ordered by confidence descending (never null, may be empty)
  alternatives: Array<{
    text: string;
    confidence: number;
  }>;

  // Timing (ms from prompt-end)
  speechStartMs: number | null;
  speechEndMs: number | null;
  speechDurationMs: number | null; // derived: speechEndMs - speechStartMs

  // Audio characteristics (provider-dependent; absent when unavailable)
  audioEnergyLevel: number | null; // normalized 0.0–1.0

  // Provider metadata (for logging only; not used in classification)
  provider: 'google_chirp_v2';
  providerRequestId: string;
  processingLatencyMs: number;

  /** Raw provider payload — for adapter debugging only. Never passed to classification. */
  rawProviderPayload?: unknown;
}
