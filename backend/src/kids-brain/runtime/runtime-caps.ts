/**
 * Kids Brain v1 runtime safety caps — Phase 14I.
 *
 * All caps are environment-configurable with safe defaults.
 * Invalid or missing env values fall back to defaults — never crash startup.
 *
 * Cost-safety rationale for defaults:
 *   Kid's Box Unit 1 Lesson 2 has 10 exercises.
 *   Worst-case: 10 exercises × 4 turns each = 40 LLM calls.
 *   KIDS_MAX_LLM_CALLS=60  gives 50% headroom above worst-case without being unlimited.
 *   KIDS_MAX_TTS_CHARS=8000 ≈ 80 utterances × ~100 chars — covers full lesson with retries.
 *   KIDS_MAX_DURATION_MINUTES=20 matches AAA guideline for 6-9 year-olds (§14.5 allows 25/35 min).
 *
 * Production must not become unlimited: all defaults remain finite and conservative.
 */

const SAFE_DEFAULT_MAX_DURATION_MINUTES = 20;
const SAFE_DEFAULT_MAX_LLM_CALLS        = 60;
const SAFE_DEFAULT_MAX_TTS_CHARS        = 8000;

/**
 * Parses a string env value as a positive integer.
 * Returns `fallback` when the value is absent, empty, NaN, or <= 0.
 */
export function parseEnvInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const n = parseInt(value, 10);
  return Number.isNaN(n) || n <= 0 ? fallback : n;
}

/** Maximum Kids Brain v1 session duration in milliseconds. */
export const KIDS_MAX_DURATION_MS: number =
  parseEnvInt(process.env['KIDS_MAX_DURATION_MINUTES'], SAFE_DEFAULT_MAX_DURATION_MINUTES) * 60 * 1000;

/** Maximum LLM (AI) calls per Kids Brain v1 session (classification + teacher response). */
export const KIDS_MAX_LLM_CALLS: number =
  parseEnvInt(process.env['KIDS_MAX_LLM_CALLS'], SAFE_DEFAULT_MAX_LLM_CALLS);

/** Maximum TTS characters per Kids Brain v1 session. */
export const KIDS_MAX_TTS_CHARS: number =
  parseEnvInt(process.env['KIDS_MAX_TTS_CHARS'], SAFE_DEFAULT_MAX_TTS_CHARS);
