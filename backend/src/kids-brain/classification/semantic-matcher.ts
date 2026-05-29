/**
 * Deterministic semantic and text matching helpers (Phase 3).
 * No external dependencies. No embeddings. No LLM.
 */

/** Normalize text for matching: lowercase, trim, strip punctuation, collapse spaces. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/** Levenshtein edit distance between two strings. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/** True if normalized edit distance is within maxDistance (default 2). */
export function isNearMatch(
  text: string,
  target: string,
  maxDistance = 2,
): boolean {
  const a = normalizeText(text);
  const b = normalizeText(target);
  if (!a || !b) return false;
  return editDistance(a, b) <= maxDistance;
}

/** True if texts match exactly after normalization. */
export function isExactMatch(text: string, target: string): boolean {
  const a = normalizeText(text);
  const b = normalizeText(target);
  return a !== '' && b !== '' && a === b;
}

/**
 * True if response word appears in the vocabulary group but is not the target.
 * Used for wrong_but_related detection (spec §6.1).
 * Vocabulary group matching only — no embeddings.
 */
export function isWrongButRelated(
  text: string,
  target: string,
  vocabularyGroup: string[],
): boolean {
  const normText = normalizeText(text);
  const normTarget = normalizeText(target);
  if (!normText || normText === normTarget) return false;
  return vocabularyGroup.some(w => normalizeText(w) === normText);
}

/**
 * True if text contains any word from the target word list.
 * Used for partial_answer detection on multi-word targets.
 */
export function containsTargetWord(text: string, target: string): boolean {
  const normText = normalizeText(text);
  const targetWords = normalizeText(target).split(' ');
  return targetWords.some(w => w && normText.includes(w));
}
