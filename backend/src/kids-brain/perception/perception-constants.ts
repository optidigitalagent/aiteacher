// Re-export shared constants used by the perception module
export {
  SILENCE_THRESHOLD_SHORT_MS,
  SILENCE_THRESHOLD_MEDIUM_MS,
  SILENCE_THRESHOLD_LONG_MS,
  SILENCE_AGE_ADJUSTMENT_6_7_MS,
  LATENCY_VERY_FAST_MS,
  LATENCY_HESITANT_MS,
  LATENCY_SILENCE_MS,
  STT_CONFIDENCE_NULL_DEFAULT,
  STT_SHORT_UTTERANCE_THRESHOLD_MS,
  STT_CHILD_SPEECH_PRIOR_6_7,
  STT_CHILD_SPEECH_PRIOR_8_9,
  STT_SHORT_UTTERANCE_PENALTY,
  STT_RESPONSE_LENGTH_1_WORD,
  STT_RESPONSE_LENGTH_2_WORD,
} from '../shared/constants.js';

/** Perception confidence below which safeForDeterministicClassification = false */
export const PERCEPTION_UNCERTAINTY_THRESHOLD = 0.5;

/** Upper bound of "fast answer" latency range (ms) */
export const LATENCY_FAST_MAX_MS = 800;

/** Upper bound of "slow but not silence" latency range (ms) */
export const LATENCY_SLOW_MAX_MS = 5000;
