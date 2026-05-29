/**
 * Core teacher language vocabulary — Patch 5, §10A.
 * 103-item canonical list (v1 initial). Changes require ELT specialist PR review.
 * The array contains duplicates across groups; CORE_TEACHER_VOCABULARY_SET deduplicates.
 */
export const CORE_TEACHER_VOCABULARY: readonly string[] = [
  // Classroom action words
  'say', 'tell', 'listen', 'look', 'find', 'show', 'point', 'help', 'try',
  'think', 'know', 'see', 'hear', 'do', 'make', 'go', 'come', 'put', 'play',
  'choose', 'pick', 'yes', 'no', 'ready', 'start', 'stop', 'wait', 'finish',
  'again', 'together', 'with', 'me', 'you',

  // Praise and acknowledgment
  'wow', 'amazing', 'great', 'brilliant', 'fantastic', 'yes', 'oh', 'good',
  'well', 'nice', 'clever', 'perfect', 'correct', 'beautiful', 'wonderful',

  // Question and prompt words
  'what', 'which', 'is', 'are', 'can', 'does', 'do', 'this', 'that', 'here',
  'there', 'where', 'one', 'two', 'three', 'a', 'an', 'the', 'and', 'or',
  'but', 'it',

  // Transition and connective words
  'now', 'next', 'then', 'after', 'before', 'again', 'let', 'go', 'okay',
  'right', 'so', 'and', 'but', 'look', 'oh', 'wait', 'hmm', 'uh', 'listen',

  // Scaffolding and support words
  'maybe', 'almost', 'close', 'try', 'again', 'or', 'not', 'big', 'small',
  'fast', 'slow', 'loud', 'quiet', 'first', 'last', 'more',

  // Emotional and engagement words
  'love', 'like', 'happy', 'sad', 'funny', 'silly', 'scary', 'wow', 'yay',
  'hurray', 'come', 'back', 'here', 'ready', 'sure', 'really',

  // Lesson framing words
  'today', 'time', 'game', 'turn', 'round', 'word', 'animal', 'color',
  'number', 'name', 'question', 'answer', 'correct', 'wrong',

  // Identity and relational words
  'your', 'my', 'our', 'you', 'me', 'we', 'they', 'he', 'she', 'it',
  'his', 'her',

  // Numbers (core)
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',

  // Essential prepositions present in scripted teacher responses
  'in',

  // L1-bridge words (scripted l1 recovery responses)
  'english', 'heard',

  // Greeting warmth (scripted greeting and emotional-shutdown responses)
  'hey', 'ooh',

  // Session-close words (scripted safety-close responses)
  'soon', 'bye',

  // Emotional-support and recovery words (scripted recovery responses)
  'stuck', 'sometimes', 'too', 'get',
] as const;

/**
 * Deduplicated Set for O(1) guard lookups.
 * This is the canonical lookup structure used by vocabulary-guard.ts.
 */
export const CORE_TEACHER_VOCABULARY_SET: ReadonlySet<string> = new Set(
  CORE_TEACHER_VOCABULARY,
);

/**
 * Check whether a word stem is in the core teacher vocabulary.
 * Input must already be lowercased and punctuation-stripped by the caller.
 */
export function isCoreTeacherWordAllowed(wordStem: string): boolean {
  return CORE_TEACHER_VOCABULARY_SET.has(wordStem);
}
