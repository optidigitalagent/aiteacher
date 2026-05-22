// Phase 7.6 — Adaptive English-vs-Cyrillic STT Balancing
//
// PRIMARY fix: rec.lang = 'en-US' in ClassroomLayout.tsx — this alone eliminates most
// phonetic Cyrillic output from mobile Web Speech API on Ukrainian/Russian phones.
//
// SECONDARY fix (this file): a conservative word-map catches any residual phonetic Cyrillic
// that still slips through (e.g. WebKit ignoring the lang hint).
// The map is intentionally small — it is a safety net, NOT the main recognition strategy.
// Do NOT expand it into a large dictionary.
//
// TERTIARY fix: detectSttUncertain() — if a transcript is still mostly Cyrillic after the
// map pass AND is not a real clarification request, it is flagged as uncertain STT output.
// The caller (demo-routes.ts) responds with a polite "try again in English" message rather
// than routing it as multilingual rescue or counting it as an abuse/failure.
//
// Design:
//   • NEVER normalises real RU/UA clarification triggers (як сказати / как сказать / etc.)
//   • Word-by-word replacement: unknown Cyrillic words are preserved
//   • detectSttUncertain uses word-based Cyrillic ratio of the NORMALIZED text
//   • Zero AI calls, zero DB/Redis ops, never throws

// ── Clarification trigger guard ───────────────────────────────────────────────
// If any of these patterns are present the text MUST reach multilingual rescue unmodified.
const CLARIFICATION_TRIGGER_RE =
  /(?:як\s+сказати|як\s+перекласти|як\s+буде|що\s+означає|як\s+звучить|як\s+по\s*англ|як\s+правильно|переклади|як\s+написати|как\s+сказать|как\s+перевести|что\s+значит|как\s+по\s*англ|как\s+правильно|переведи)/iu

// ── Phonetic Cyrillic → English word map ─────────────────────────────────────
// Keys are lowercase Cyrillic phonetic spellings of English words.
// Only words that are NOT real RU/UA words with different meanings are included.
const PHONETIC_MAP: Record<string, string> = {
  // Subject pronouns
  'ай':  'I',
  'май': 'my',

  // Core lesson verbs — from task spec
  'лайк':    'like',
  'вотч':    'watch',
  'воч':     'watch',
  'вонт':    'want',
  'вант':    'want',
  'хав':     'have',
  'хэв':     'have',
  'хев':     'have',
  'лав':     'love',
  'гоу':     'go',
  'ноу':     'know',
  'плей':    'play',
  'гет':     'get',
  'спік':    'speak',
  'рід':     'read',

  // "am" forms — "ам"/"эм" are not real RU/UA words
  'ам':  'am',
  'эм':  'am',

  // Common adjectives/adverbs
  'гуд':   'good',
  'грейт': 'great',
  'мач':   'much',
  'вері':  'very',
  'вэри':  'very',

  // Proper nouns from task spec
  'містер': 'Mr',
  'мистер': 'Mr',
  'мр':     'Mr',
  'бист':   'Beast',
  'біст':   'Beast',
  'фрeнд':  'friend',  // variant with е
  'френд':  'friend',

  // Other common English lesson nouns
  'тайм': 'time',
  'дей':  'day',
  'дэй':  'day',
  'вей':  'way',
  'вэй':  'way',
  'скул': 'school',
  'хоум': 'home',
  'ворк': 'work',
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PhoneticNormResult {
  originalText:                string
  normalizedText:              string
  wasNormalized:               boolean
  isMostlyCyrillic:            boolean
  clarificationPreserved:      boolean
  wordsNormalized:             number
  wordsTotal:                  number
  cyrillicRatio:               number  // letter-based ratio of ORIGINAL text
  normalizedWordCyrillicRatio: number  // word-based ratio of NORMALIZED text (used by detectSttUncertain)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeCyrillicRatio(text: string): number {
  const letters = text.match(/\p{L}/gu) ?? []
  if (letters.length === 0) return 0
  const cyrillic = letters.filter(c => /\p{Script=Cyrillic}/u.test(c))
  return cyrillic.length / letters.length
}

// Returns the fraction of whitespace-separated words that contain at least one Cyrillic letter.
// Used by detectSttUncertain to check how much Cyrillic remains AFTER normalization.
// Word-based (not letter-based) so "I like географія" scores 1/3 ≈ 0.33, not 9/14 ≈ 0.64.
function computeWordCyrillicRatio(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 0
  const cyrillicWords = words.filter(w => /\p{Script=Cyrillic}/u.test(w))
  return cyrillicWords.length / words.length
}

// Normalize a single word: strip surrounding punctuation, look up core in map,
// preserve case on first letter of English result, re-attach punctuation.
function normalizeWord(word: string): { result: string; wasReplaced: boolean } {
  // Match: optional leading punct, letter-based core, optional trailing punct
  const m = word.match(/^([^\p{L}]*)(\p{L}[\p{L}]*)([^\p{L}]*)$/u)
  if (!m) return { result: word, wasReplaced: false }
  const [, pre, core, post] = m as [string, string, string, string]
  const mapped = PHONETIC_MAP[core.toLowerCase()]
  if (!mapped) return { result: word, wasReplaced: false }
  return { result: (pre ?? '') + mapped + (post ?? ''), wasReplaced: true }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function normalizePhoneticallyRenderedEnglish(text: string): PhoneticNormResult {
  const originalText = text.trim()

  const cyrillicRatio = computeCyrillicRatio(originalText)

  // Fast path — no Cyrillic at all
  if (cyrillicRatio === 0) {
    return {
      originalText, normalizedText: originalText,
      wasNormalized: false, isMostlyCyrillic: false,
      clarificationPreserved: false, wordsNormalized: 0,
      wordsTotal: originalText.split(/\s+/).filter(Boolean).length,
      cyrillicRatio: 0,
      normalizedWordCyrillicRatio: 0,
    }
  }

  // Guard — real clarification request must reach multilingual rescue unchanged
  if (CLARIFICATION_TRIGGER_RE.test(originalText)) {
    return {
      originalText, normalizedText: originalText,
      wasNormalized: false, isMostlyCyrillic: cyrillicRatio >= 0.3,
      clarificationPreserved: true, wordsNormalized: 0,
      wordsTotal: originalText.split(/\s+/).filter(Boolean).length,
      cyrillicRatio,
      normalizedWordCyrillicRatio: computeWordCyrillicRatio(originalText),
    }
  }

  // Word-by-word replacement
  const words = originalText.split(/(\s+)/)  // preserve whitespace tokens
  let wordsNormalized = 0
  let wordsTotal = 0

  const resultTokens = words.map(token => {
    if (/^\s+$/.test(token)) return token  // preserve whitespace
    wordsTotal++
    const { result, wasReplaced } = normalizeWord(token)
    if (wasReplaced) wordsNormalized++
    return result
  })

  const normalizedText = resultTokens.join('')
  const wasNormalized  = wordsNormalized > 0

  if (wasNormalized) {
    console.log(
      `[demo_stt_phonetic_english_detected] ` +
      `wordsNormalized=${wordsNormalized}/${wordsTotal} ` +
      `cyrillicRatio=${cyrillicRatio.toFixed(2)} ` +
      `raw="${originalText.slice(0, 60)}" ` +
      `normalized="${normalizedText.slice(0, 60)}"`,
    )
  }

  const normalizedWordCyrillicRatio = computeWordCyrillicRatio(normalizedText)

  return {
    originalText, normalizedText,
    wasNormalized, isMostlyCyrillic: cyrillicRatio >= 0.3,
    clarificationPreserved: false, wordsNormalized,
    wordsTotal, cyrillicRatio,
    normalizedWordCyrillicRatio,
  }
}

// ── STT uncertainty detector ──────────────────────────────────────────────────
//
// Returns true when the voice transcript appears to be garbled Cyrillic from a
// mobile STT artifact — not a real clarification, not confidently normalized phonetic English.
//
// PRIMARY protection is rec.lang='en-US' in ClassroomLayout.tsx (Phase 7.6).
// This detector catches residual cases where the browser still emits Cyrillic.
//
// Threshold: word-based Cyrillic ratio >= 0.5 in the NORMALIZED text.
// Using words (not letters) keeps "I like географія" (1/3 ≈ 0.33) below the threshold
// while catching pure-Cyrillic garbage or single unknown Cyrillic words (1/1 = 1.0).
export function detectSttUncertain(result: PhoneticNormResult): boolean {
  // No Cyrillic at all → ordinary Latin transcript, definitely not uncertain
  if (result.cyrillicRatio === 0) return false
  // Real clarification trigger → multilingual rescue owns it, not uncertain path
  if (result.clarificationPreserved) return false
  // After normalization, if ≥50% of words are still Cyrillic the normalizer couldn't
  // confidently map them → treat as uncertain STT output, ask student to retry in English
  return result.normalizedWordCyrillicRatio >= 0.5
}
