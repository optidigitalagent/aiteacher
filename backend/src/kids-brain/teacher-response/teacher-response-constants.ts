import type { AgeBand } from '../shared/enums.js';

/** Max total words per teacher response by age band (spec §6, Phase 6). */
export const MAX_WORDS_BY_AGE: Readonly<Record<AgeBand, number>> = {
  '6-7': 12,
  '8-9': 18,
};

/**
 * Patterns that indicate an unresolved placeholder in teacher text.
 * If any of these appear in final output, the placeholder guard fires.
 */
export const PLACEHOLDER_PATTERNS: readonly string[] = [
  '{', '}', '{{', '}}', '[target]', 'undefined', 'null',
];

/**
 * Phrases that are absolutely forbidden in teacher output (Phase 6, spec §10.7).
 * Checked case-insensitively. If matched, the forbidden phrase guard fires.
 */
export const FORBIDDEN_PHRASES: readonly string[] = [
  'wrong',
  'incorrect',
  'no, that is wrong',
  'try harder',
  'pay attention',
  'you failed',
  'this is easy',
  "why don't you know",
  'grammar',
  'present tense',
  'past tense',
  'future tense',
  'verb',
  'noun',
  'adjective',
  'metalinguistic',
  'in english we say',
  'the word order is',
  'this is how you form',
  "that's not right",
  'come on, you know',
  'we went over this',
];

/** Praise variants for rotation — 18 items (spec §10.8 requires 15+). */
export const PRAISE_VARIANTS: readonly string[] = [
  'Amazing!',
  'Yes! You got it!',
  'Ooh, I love that!',
  'Great job saying that!',
  "Wow, you're so good at this!",
  'I knew you could do it!',
  'That was perfect!',
  "You're teaching me!",
  'I love how you tried!',
  'Brilliant!',
  'Yes, YES, YES!',
  'Ooh, that was beautiful!',
  "Super! Let's keep going!",
  "You're my favorite!",
  'Give me five!',
  'Wow!',
  'Fantastic!',
  'Beautiful!',
];

/** Effort praise variants — fired on any attempt, correct or not. */
export const EFFORT_PRAISE_VARIANTS: readonly string[] = [
  'Good thinking!',
  'I love how you tried!',
  'Ooh, great try!',
  "You're so brave to try!",
  'I love your energy!',
  'Ooh, almost!',
  'Mmm! Good thinking!',
];

/** Universal fallback text — used when all guards fail. */
export const UNIVERSAL_FALLBACK_TEXT = "Let's try again!";

/** Safety close — scripted, never LLM (spec §11 emotional_shutdown). */
export const SAFETY_CLOSE_TEXT = "That's okay. We'll play again soon. Bye-bye!";

/** Recovery close — warm close after recovery. */
export const RECOVERY_CLOSE_TEXT = "It's okay! We did great today!";

/** Text used after L1 usage when budget is exhausted. */
export const L1_BUDGET_EXHAUSTED_FALLBACK =
  "Listen — say it with me!";
