/**
 * Placeholder phonetic matching helpers (Phase 3).
 *
 * Implements simple consonant-skeleton phonetic normalization.
 * [C] Full phonetic matching (Soundex, Metaphone, etc.) requires calibration
 * against real child speech samples from the target age band.
 *
 * Phase 3 contract: placeholder logic with tests.
 * Phase 4 may replace with a proper phonetic algorithm.
 */

/** Common phonetic substitutions for English child speech. */
const PHONETIC_MAP: Array<[RegExp, string]> = [
  [/ph/g, 'f'],
  [/[ck]/g, 'k'],
  [/[sz]/g, 's'],
  [/th/g, 't'],
  [/wh/g, 'w'],
  [/[aeiou]+/g, 'a'], // collapse all vowels to 'a' after consonant substitutions
];

/**
 * Returns a reduced phonetic skeleton for loose matching.
 * Intended for single words only.
 */
export function phoneticKey(word: string): string {
  let s = word.toLowerCase().replace(/[^a-z]/g, '');
  for (const [from, to] of PHONETIC_MAP) {
    s = s.replace(from, to);
  }
  // Deduplicate consecutive identical letters
  return s.replace(/(.)\1+/g, '$1');
}

/**
 * Returns true if two words share the same phonetic skeleton.
 * [C] Threshold and algorithm require empirical calibration.
 */
export function isPhoneticMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  return phoneticKey(a) === phoneticKey(b);
}

/**
 * Phonetic similarity score 0.0–1.0.
 * Computed from the fraction of shared characters in the phonetic skeletons.
 * [C] This formula is a placeholder; requires calibration with real child speech.
 */
export function phoneticSimilarity(a: string, b: string): number {
  const ka = phoneticKey(a);
  const kb = phoneticKey(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1.0;
  const maxLen = Math.max(ka.length, kb.length);
  if (maxLen === 0) return 1.0;
  let shared = 0;
  for (let i = 0; i < Math.min(ka.length, kb.length); i++) {
    if (ka[i] === kb[i]) shared++;
  }
  return shared / maxLen;
}
