import { InputQuality } from './perception-types.js';

const NOISY_THRESHOLD = 0.30;
const LOW_CONFIDENCE_THRESHOLD = 0.50;

/**
 * Computes input quality label for routing (Phase 2 §InputQuality).
 *
 * Distinguishes null transcript (MISSING) from empty/whitespace (EMPTY).
 * Low STT confidence increases uncertainty — it does NOT punish the child.
 */
export function computeInputQuality(
  rawTranscript: string | null,
  wordCount: number,
  adjustedSttConfidence: number,
): InputQuality {
  if (rawTranscript === null) return InputQuality.MISSING;
  if (wordCount === 0) return InputQuality.EMPTY;
  if (adjustedSttConfidence < NOISY_THRESHOLD) return InputQuality.NOISY;
  if (adjustedSttConfidence < LOW_CONFIDENCE_THRESHOLD) return InputQuality.LOW_CONFIDENCE;
  return InputQuality.USABLE;
}
