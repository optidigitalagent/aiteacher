import { CORE_TEACHER_VOCABULARY_SET } from './core-teacher-vocabulary.js';

// ── Stemmer ───────────────────────────────────────────────────────────────────

/**
 * Applies simple English suffix stripping for stem matching.
 * Matches spec §10A.2: "inflected forms of an allowed word are permitted."
 * This is an approximation — not a full morphological analyser.
 */
function applyStem(word: string): string {
  if (word.length > 4 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 5 && word.endsWith('ings')) return word.slice(0, -4);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Tokenizes teacher text into normalized lowercase word tokens (no punctuation). */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/n't/g, '')
    .replace(/'ll/g, '')
    .replace(/'re/g, '')
    .replace(/'ve/g, '')
    .replace(/'m/g, '')
    .replace(/'d/g, '')
    .replace(/'s/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1); // skip single-character tokens
}

// ── Allowed set builder ───────────────────────────────────────────────────────

/**
 * Builds the session-level allowed vocabulary set.
 * Union of: core teacher vocabulary + lesson target words + unit review words + character names.
 * Also adds simple stems of all provided words.
 * Spec §10.4 / Patch 5 §10A.
 */
export function buildAllowedVocabSet(
  lessonTargetWords: string[],
  unitReviewWords: string[],
  characterNames: string[],
): Set<string> {
  const set = new Set<string>(CORE_TEACHER_VOCABULARY_SET);
  const additional = [...lessonTargetWords, ...unitReviewWords, ...characterNames];
  for (const w of additional) {
    const lower = w.toLowerCase();
    set.add(lower);
    set.add(applyStem(lower));
  }
  // Also add stems of core vocabulary for robustness
  for (const w of CORE_TEACHER_VOCABULARY_SET) {
    set.add(applyStem(w));
  }
  return set;
}

// ── Guard result types ────────────────────────────────────────────────────────

/** Result of a vocabulary guard check (no replacement). */
export interface VocabularyGuardResult {
  /** True when all tokens are in the allowed set. */
  passed: boolean;
  /** Tokens not found in the allowed set. */
  blockedTokens: string[];
}

/** Result of applying the vocabulary guard with fallback. */
export interface VocabularyGuardApplyResult {
  /** The approved text (original if passed, fallback if blocked). */
  text: string;
  /** Tokens that were blocked (empty if text passed). */
  blocked: string[];
  /** True when the guard replaced text with the fallback. */
  guardApplied: boolean;
}

// ── Guard functions ───────────────────────────────────────────────────────────

/**
 * Checks teacher text against the allowed vocabulary set.
 * Each token is checked both as-is and as its stem.
 */
export function checkVocabulary(
  text: string,
  allowedSet: Set<string>,
): VocabularyGuardResult {
  const tokens = tokenize(text);
  const blocked: string[] = [];

  for (const token of tokens) {
    const stem = applyStem(token);
    if (!allowedSet.has(token) && !allowedSet.has(stem)) {
      blocked.push(token);
    }
  }

  return { passed: blocked.length === 0, blockedTokens: blocked };
}

/**
 * Applies the vocabulary guard.
 * If any token is out-of-scope, replaces text with fallback and logs the block.
 * Spec: "Any word outside this union blocks delivery. This is a HARD_STOP."
 */
export function applyVocabularyGuard(
  text: string,
  allowedSet: Set<string>,
  fallbackText: string,
): VocabularyGuardApplyResult {
  const { passed, blockedTokens } = checkVocabulary(text, allowedSet);
  if (passed) {
    return { text, blocked: [], guardApplied: false };
  }
  return { text: fallbackText, blocked: blockedTokens, guardApplied: true };
}
