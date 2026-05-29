import { PLACEHOLDER_PATTERNS } from './teacher-response-constants.js';

/** Result of the placeholder guard check. */
export interface PlaceholderGuardResult {
  /** Text after the guard (fallback text if guard triggered, original if not). */
  text: string;
  /** True when unresolved placeholders were found and text was replaced. */
  wasTriggered: boolean;
  /** Which placeholder patterns were found (may be empty). */
  patternsFound: string[];
}

/**
 * Returns true if the text contains any unresolved placeholder pattern.
 * Checked case-insensitively.
 */
export function hasUnresolvedPlaceholders(text: string): boolean {
  const lower = text.toLowerCase();
  return PLACEHOLDER_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

/**
 * Returns which placeholder patterns were found in the text.
 * Returns an empty array if none found.
 */
export function findPlaceholderPatterns(text: string): string[] {
  const lower = text.toLowerCase();
  return PLACEHOLDER_PATTERNS.filter(p =>
    lower.includes(p.toLowerCase()),
  );
}

/**
 * Applies the placeholder guard.
 * If the text contains any unresolved placeholder pattern, replaces the entire
 * text with the safe fallback and marks wasTriggered=true.
 *
 * No teacher response may contain unresolved placeholders (spec Phase 6).
 */
export function applyPlaceholderGuard(
  text: string,
  fallbackText: string,
): PlaceholderGuardResult {
  const patternsFound = findPlaceholderPatterns(text);
  if (patternsFound.length === 0) {
    return { text, wasTriggered: false, patternsFound: [] };
  }
  return { text: fallbackText, wasTriggered: true, patternsFound };
}
