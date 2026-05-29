// Near-match thresholds (spec §6.1)
export const NEAR_MATCH_EDIT_DISTANCE_MAX = 2;

// Confidence thresholds (spec §6.1)
export const CORRECT_CONFIDENT_MIN_ADJ_CONFIDENCE = 0.75;
export const CORRECT_HESITANT_MIN_ADJ_CONFIDENCE = 0.65;
export const CORRECT_CONFIDENT_LATENCY_MIN_MS = 600;
export const CORRECT_CONFIDENT_LATENCY_MAX_MS = 2500;

// Repeated-after-model detection (spec §6.1)
export const REPEATED_AFTER_MODEL_MAX_LATENCY_MS = 1500;

// Safety — err toward false positive; false negative is not acceptable (spec §6.1)
export const SAFETY_CONFIDENCE_THRESHOLD = 0.30;

// Mastery eligibility — minimum classification confidence for eligibility
export const MASTERY_ELIGIBLE_MIN_CONFIDENCE = 0.60;

// Forced-choice fast-answer downgrade guard (spec §6.1)
export const FORCED_CHOICE_POSSIBLE_GUESS_LATENCY_MS = 700;

// Phrases that map deterministically to i_dont_know (spec §6.1)
export const I_DONT_KNOW_PHRASES: readonly string[] = [
  "i don't know",
  "i dont know",
  "idk",
  "dunno",
  "no idea",
  "не знаю",
  "я не знаю",
];

// Refusal phrases (spec §6.1); "no" is context-sensitive — see refusal guard
export const REFUSAL_PHRASES: readonly string[] = [
  "no",
  "stop",
  "i don't want to",
  "i dont want to",
  "не хочу",
  "не буду",
];

// Unsafe / sensitive keyword list (conservative — spec §6.1 §14.1)
// [C] This list requires expansion before production deployment.
export const UNSAFE_KEYWORDS: readonly string[] = [
  "kill",
  "hurt",
  "die",
  "dead",
  "blood",
  "sex",
  "naked",
  "hate",
  "weapon",
  "gun",
  "knife",
  "bomb",
  "abuse",
  "touch",
  "bad touch",
  "scary man",
];
