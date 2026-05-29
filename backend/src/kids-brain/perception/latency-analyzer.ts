import { AgeBand } from '../shared/enums.js';
import {
  LATENCY_VERY_FAST_MS,
  LATENCY_HESITANT_MS,
  SILENCE_AGE_ADJUSTMENT_6_7_MS,
} from '../shared/constants.js';
import { LATENCY_FAST_MAX_MS, LATENCY_SLOW_MAX_MS } from './perception-constants.js';

export interface LatencyAnalysis {
  isFastAnswer: boolean;
  isNormalAnswer: boolean;
  isSlowAnswer: boolean;
  isMissingLatency: boolean;
  isVeryFast: boolean;
  isHesitant: boolean;
}

const MISSING_RESULT: LatencyAnalysis = {
  isFastAnswer: false,
  isNormalAnswer: false,
  isSlowAnswer: false,
  isMissingLatency: true,
  isVeryFast: false,
  isHesitant: false,
};

/**
 * Analyses response latency with age-band adjustment (spec §5.5).
 *
 * Fast answer is NOT automatically a guessing signal — only emit the signal.
 * The classification module applies the guessing guard separately.
 */
export function analyzeLatency(
  responseLatencyMs: number | null,
  ageBand: AgeBand,
): LatencyAnalysis {
  if (responseLatencyMs === null) return MISSING_RESULT;

  // 6–7 band shifts all thresholds +500ms (spec §5.5)
  const adj = ageBand === AgeBand.SIX_SEVEN ? SILENCE_AGE_ADJUSTMENT_6_7_MS : 0;

  const fastMax = LATENCY_FAST_MAX_MS + adj;         // 800 or 1300
  const normalMax = LATENCY_HESITANT_MS + adj;       // 2500 or 3000
  const slowMax = LATENCY_SLOW_MAX_MS + adj;         // 5000 or 5500

  // isVeryFast: absolute threshold from spec §5.6 (no age adjustment mentioned)
  const isVeryFast = responseLatencyMs < LATENCY_VERY_FAST_MS;

  const isFastAnswer = responseLatencyMs <= fastMax;
  const isNormalAnswer = responseLatencyMs > fastMax && responseLatencyMs <= normalMax;
  const isSlowAnswer = responseLatencyMs > normalMax && responseLatencyMs <= slowMax;
  const isHesitant = responseLatencyMs > normalMax;

  return {
    isFastAnswer,
    isNormalAnswer,
    isSlowAnswer,
    isMissingLatency: false,
    isVeryFast,
    isHesitant,
  };
}
