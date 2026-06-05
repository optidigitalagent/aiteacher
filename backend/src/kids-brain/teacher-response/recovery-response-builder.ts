import { SAFETY_CLOSE_TEXT, RECOVERY_CLOSE_TEXT, UNIVERSAL_FALLBACK_TEXT } from './teacher-response-constants.js';

/**
 * Recovery scenario types handled by this builder.
 * Mapped from RecoveryState + ClassificationLabel combinations (spec Phase 6).
 */
export type RecoveryType =
  | 'silence_short'
  | 'silence_long'
  | 'no_response'
  | 'wrong_semantic'
  | 'repeated_failure'
  | 'l1_translation'
  | 'l1_help_request'
  | 'i_dont_know'
  | 'clarification_request'
  | 'social_speech'
  | 'refusal'
  | 'emotional_shutdown'
  | 'unsafe_or_sensitive';

/**
 * Parameters for building a recovery response.
 * Recovery priority order (spec Phase 6):
 * 1. emotional safety
 * 2. comprehension
 * 3. production
 * 4. progression
 */
export interface RecoveryResponseParams {
  targetWord: string | null;
  forcedChoiceOptionA?: string;
  forcedChoiceOptionB?: string;
  l1BudgetUsed: boolean;
  l1AnchorWord?: string;
  recentPhrases: string[];
}

/** Short-silence variants — gentle prompt that always names the target word. */
const SILENCE_SHORT_VARIANTS: readonly string[] = [
  "Say {word}!",
  "Can you say {word}?",
  "Your turn! Say {word}!",
];

const SILENCE_LONG_VARIANTS: readonly string[] = [
  "It's a {word}! Say: {word}!",
  "Listen — {word}! Can you say {word}?",
  "Together — {word}! Your turn!",
];

const NO_RESPONSE_VARIANTS: readonly string[] = [
  "Hey! Are you ready? Let's try together!",
  "It's okay! Let's do it together!",
  "I'm here! Let's try: {word}!",
];

const WRONG_SEMANTIC_VARIANTS: readonly string[] = [
  "Ooh! Good thinking! Listen — {word}! {word}!",
  "Hmm! It's {word}! Say: {word}!",
  "Great try! It's {word}! Can you say {word}?",
];

const REPEATED_FAILURE_VARIANTS: readonly string[] = [
  "Let's try something fun! Is it {optA} or {optB}?",
  "Let's make it easy! Say: {word}!",
  "It's okay! Together: {word}!",
];

const L1_TRANSLATION_VARIANTS: readonly string[] = [
  "Yes! In English — {word}! {word}! Say it!",
  "Ooh! Good! In English: {word}! Can you say {word}?",
  "I heard you! In English — {word}! {word}!",
];

const L1_HELP_REQUEST_VARIANTS: readonly string[] = [
  "Let me help! Listen — {word}! Say: {word}!",
  "It's {word}! {word}! Can you say {word}?",
  "Together: {word}! Your turn!",
];

const I_DONT_KNOW_VARIANTS: readonly string[] = [
  "That's okay! Is it {optA} or {optB}?",
  "Listen — {word}! {word}! Can you say it?",
  "Let's see! Is it {optA}? Yes or no?",
];

// Concrete instruction variants — always include the target word.
// Used when child asks "what should I say?" or signals readiness confusion.
const CLARIFICATION_REQUEST_VARIANTS: readonly string[] = [
  "Say {word}!",
  "Try saying: {word}!",
  "Can you say {word}? {word}!",
  "Listen — {word}! Now you say: {word}!",
];

// Social speech variants — warm, brief, always redirect to target word.
// All tokens must be in CORE_TEACHER_VOCABULARY or lesson target words.
const SOCIAL_SPEECH_VARIANTS: readonly string[] = [
  "Hey! Say {word}!",
  "Hey! Can you say {word}?",
  "Great! Now say {word}!",
  "Okay! Try: {word}!",
  "Ready? Say {word}!",
];

const REFUSAL_VARIANTS: readonly string[] = [
  "That's okay! Let's do something fun!",
  "No problem! We can play a different game!",
  "It's okay! Let's take a break!",
];

const EMOTIONAL_SHUTDOWN_VARIANTS: readonly string[] = [
  "Hey, it's okay! You're doing great!",
  "That's okay! Milo gets stuck too sometimes!",
  "It's okay! We're doing great today!",
];

/** Picks a variant not recently used. Falls back to any variant. */
function pickVariant(
  variants: readonly string[],
  recentPhrases: string[],
): string {
  const available = variants.filter(v => !recentPhrases.includes(v));
  const pool = available.length > 0 ? available : [...variants];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Resolves {word}, {optA}, {optB} in a template string. */
function resolve(
  template: string,
  word: string,
  optA: string,
  optB: string,
): string {
  return template
    .replace(/\{word\}/g, word)
    .replace(/\{optA\}/g, optA)
    .replace(/\{optB\}/g, optB);
}

/**
 * Builds a deterministic recovery response for the given recovery scenario.
 *
 * All recovery responses:
 * - Preserve emotional safety (no shame, no explicit correction)
 * - Are independent of LLM
 * - Return immediately (no async)
 * - Always produce valid, non-empty output
 */
export function buildRecoveryResponse(
  recoveryType: RecoveryType,
  params: RecoveryResponseParams,
): string {
  const word = params.targetWord ?? '';
  const optA = params.forcedChoiceOptionA ?? word;
  const optB = params.forcedChoiceOptionB ?? 'something else';
  const recent = params.recentPhrases;

  switch (recoveryType) {
    case 'silence_short':
      // Gentle prompt that includes the target word — never vague filler
      if (!word) return "Your turn!";
      return resolve(pickVariant(SILENCE_SHORT_VARIANTS, recent), word, optA, optB);

    case 'silence_long':
      // Model answer + invite repeat
      if (!word) return UNIVERSAL_FALLBACK_TEXT;
      return resolve(pickVariant(SILENCE_LONG_VARIANTS, recent), word, optA, optB);

    case 'no_response':
      // Warm check-in — child may need re-engagement
      if (!word) return "Hey! Let's try together! Are you ready?";
      return resolve(pickVariant(NO_RESPONSE_VARIANTS, recent), word, optA, optB);

    case 'wrong_semantic':
      // Recast without shame — accept attempt, model correct form
      if (!word) return UNIVERSAL_FALLBACK_TEXT;
      return resolve(pickVariant(WRONG_SEMANTIC_VARIANTS, recent), word, optA, optB);

    case 'repeated_failure':
      // Easiest win setup — drop to near-guaranteed success
      if (!word) return RECOVERY_CLOSE_TEXT;
      return resolve(pickVariant(REPEATED_FAILURE_VARIANTS, recent), word, optA, optB);

    case 'l1_translation':
      // Treat as comprehension success, bridge to English production
      if (!word) return UNIVERSAL_FALLBACK_TEXT;
      return resolve(pickVariant(L1_TRANSLATION_VARIANTS, recent), word, optA, optB);

    case 'l1_help_request': {
      // Provide L1 anchor if budget allows, then bridge to English
      if (!word) return UNIVERSAL_FALLBACK_TEXT;
      if (!params.l1BudgetUsed && params.l1AnchorWord) {
        return `${params.l1AnchorWord} — ${word}! ${word}! Say: ${word}!`;
      }
      return resolve(pickVariant(L1_HELP_REQUEST_VARIANTS, recent), word, optA, optB);
    }

    case 'i_dont_know':
      // Drop to forced choice — preserve emotional safety, reduce production demand
      if (!word) return "That's okay! Let's try together!";
      return resolve(pickVariant(I_DONT_KNOW_VARIANTS, recent), word, optA, optB);

    case 'clarification_request':
      // Child asked "what should I say?" — always give concrete target-word instruction
      if (!word) return "Try saying the word! Can you say it?";
      return resolve(pickVariant(CLARIFICATION_REQUEST_VARIANTS, recent), word, optA, optB);

    case 'social_speech':
      // Child greeted or reacted socially — acknowledge warmly, redirect to target
      if (!word) return "Ready? Say the word!";
      return resolve(pickVariant(SOCIAL_SPEECH_VARIANTS, recent), word, optA, optB);

    case 'refusal':
      // Back off, offer choice — relationship > lesson
      return pickVariant(REFUSAL_VARIANTS, recent);

    case 'emotional_shutdown':
      // Warm comfort, no curriculum pressure — stop all teaching
      return pickVariant(EMOTIONAL_SHUTDOWN_VARIANTS, recent);

    case 'unsafe_or_sensitive':
      // Safety close — scripted, no LLM, no open questions
      return SAFETY_CLOSE_TEXT;
  }
}
