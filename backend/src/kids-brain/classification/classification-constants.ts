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

// Clarification / "what should I say" phrases (child asks for instruction, not an answer)
export const CLARIFICATION_PHRASES: readonly string[] = [
  "what should i say",
  "what do i say",
  "what should i do",
  "what do i do",
  "what word",
  "which word",
  "say what",
  "what to say",
  "i don't know what to say",
  "i dont know what to say",
  "help me",
  "tell me",
  "what is it",
];

// Readiness phrases used when the child is already in an exercise
// (hasStartedFirstExercise=true) but still expressing readiness/confusion.
// Indicates child understood the instruction but needs it repeated.
export const EXERCISE_READINESS_PHRASES: readonly string[] = [
  "yes i'm ready",
  "yes im ready",
  "yes ready",
  "yes okay",
  "yes ok",
  "i'm ready",
  "im ready",
  "i am ready",
  "yes i am ready",
  "am ready",
  "okay ready",
  "ok ready",
];

// Social speech — greetings, reactions, stalling, single affirmatives.
// These are meaningful speech events but not the target word.
// Must redirect warmly to the target rather than treating as silence.
export const GREETING_PHRASES: readonly string[] = [
  "hello", "hi", "hey",
  "hi there", "hello there",
  "good morning", "good afternoon", "good evening",
  "howdy", "hi teacher", "hello teacher",
  "hey teacher",
];

export const ACKNOWLEDGEMENT_PHRASES: readonly string[] = [
  "great", "yay", "wow", "cool", "nice", "awesome",
  "fantastic", "wonderful", "amazing", "super", "perfect",
  "brilliant", "alright", "got it", "yipee", "hooray",
  "hurray", "hurrah", "woohoo", "woo",
];

export const STALLING_PHRASES: readonly string[] = [
  "wait", "one second", "one moment", "hold on",
  "just a second", "just a moment",
  "let me think", "i need a moment",
];

export const CONFUSION_SINGLE_PHRASES: readonly string[] = [
  "what", "huh", "hm", "eh",
];

export const SINGLE_AFFIRMATIVE_PHRASES: readonly string[] = [
  "yes", "yeah", "yep", "yup", "sure",
  "okay", "ok",
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
