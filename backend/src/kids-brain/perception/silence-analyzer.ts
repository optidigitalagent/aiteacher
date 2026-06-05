import { AgeBand } from '../shared/enums.js';
import {
  SILENCE_THRESHOLD_SHORT_MS,
  SILENCE_THRESHOLD_LONG_MS,
  SILENCE_AGE_ADJUSTMENT_6_7_MS,
} from '../shared/constants.js';

export interface SilenceAnalysis {
  isSilence: boolean;
  isShortSilence: boolean;
  isLongSilence: boolean;
  isNoResponse: boolean;
}

/**
 * Age-aware silence analysis (spec §5.5).
 *
 * Three output levels (Phase 2 §SilenceDetection):
 * - short silence  : silence < SHORT_THRESHOLD (wait)
 * - long silence   : silence ≥ SHORT_THRESHOLD (scaffold trigger range)
 * - no response    : silence > LONG_THRESHOLD OR no transcript
 *
 * Silence alone is NEVER treated as failure — only a scaffold trigger.
 */
export function analyzeSilence(
  silenceDurationMs: number,
  ageBand: AgeBand,
  transcriptAvailable: boolean,
): SilenceAnalysis {
  const adj = ageBand === AgeBand.SIX_SEVEN ? SILENCE_AGE_ADJUSTMENT_6_7_MS : 0;
  const shortThreshold = SILENCE_THRESHOLD_SHORT_MS + adj;    // 3000 or 3500
  const noResponseThreshold = SILENCE_THRESHOLD_LONG_MS + adj; // 10000 or 10500

  const isShortSilence = silenceDurationMs < shortThreshold;
  const isLongSilence = silenceDurationMs >= shortThreshold;
  // isNoResponse fires only when silence is extremely long (beyond noResponseThreshold).
  // Deliberately omit !transcriptAvailable here: silence turns always have no transcript
  // (STT text is null), but that fact alone should not override the duration-based
  // SILENCE_LONG/MEDIUM/SHORT ladder. Only truly unresponsive children (>10.5s) get
  // NO_RESPONSE, which gives the "Are you ready?" warm check-in instead of instruction.
  const isNoResponse = silenceDurationMs > noResponseThreshold;
  const isSilence = !isShortSilence;

  return { isSilence, isShortSilence, isLongSilence, isNoResponse };
}
