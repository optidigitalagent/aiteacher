import { AgeBand } from '../shared/enums.js';
import { MAX_WORDS_BY_AGE, FORBIDDEN_PHRASES } from './teacher-response-constants.js';

// ── Word count helpers ─────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function truncateToMaxWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  // Try to end on a sentence boundary if possible
  let truncated = words.slice(0, maxWords).join(' ');
  // Ensure the truncated text ends with some punctuation
  if (!/[.!?]$/.test(truncated)) truncated = truncated + '!';
  return truncated;
}

// ── Length guard ───────────────────────────────────────────────────────────────

/** Result of the length guard check. */
export interface LengthGuardResult {
  text: string;
  truncated: boolean;
  wordCount: number;
}

/**
 * Enforces the age-appropriate max word count on teacher text.
 * Age 6–7: max 12 words. Age 8–9: max 18 words. Spec Phase 6 §Teacher Rules.
 */
export function enforceMaxLength(text: string, ageBand: AgeBand): LengthGuardResult {
  const max = MAX_WORDS_BY_AGE[ageBand];
  const wordCount = countWords(text);
  if (wordCount <= max) {
    return { text, truncated: false, wordCount };
  }
  const truncatedText = truncateToMaxWords(text, max);
  return { text: truncatedText, truncated: true, wordCount: max };
}

// ── Forbidden phrase guard ─────────────────────────────────────────────────────

/** Result of applying the forbidden phrase guard. */
export interface ForbiddenPhraseGuardResult {
  /** Approved text (original if passed, fallback if blocked). */
  text: string;
  /** Forbidden phrases that were matched (empty if text passed). */
  blocked: string[];
  /** True when the guard replaced text with fallback. */
  guardApplied: boolean;
}

/**
 * Checks whether text contains any forbidden phrases.
 * Returns the list of matched phrases (empty array if none).
 * Checked case-insensitively.
 */
export function checkForbiddenPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return FORBIDDEN_PHRASES.filter(phrase =>
    lower.includes(phrase.toLowerCase()),
  );
}

/**
 * Applies the forbidden phrase guard.
 * If any forbidden phrase is matched, replaces text with fallback.
 * Spec Phase 6: "Block or replace" for all forbidden phrases.
 */
export function applyForbiddenPhraseGuard(
  text: string,
  fallbackText: string,
): ForbiddenPhraseGuardResult {
  const blocked = checkForbiddenPhrases(text);
  if (blocked.length === 0) {
    return { text, blocked: [], guardApplied: false };
  }
  return { text: fallbackText, blocked, guardApplied: true };
}
