// ── STT Tolerance ─────────────────────────────────────────────────────────────
// Bounded phonetic/transcription tolerance for voice answers.
// Never bypasses correctness entirely — high-confidence phonetic matches only.

import { normalizeForVoice } from './normalizer.js'

// Common STT transcription errors: key → known bad transcriptions
const PHONETIC_MAP: Record<string, string[]> = {
  do:      ['doo', 'due', 'dew'],
  you:     ['u', 'yoo', 'yu'],
  are:     ['r'],
  to:      ['too', 'two'],
  for:     ['four', 'fore'],
  be:      ['bee'],
  see:     ['sea', 'c'],
  our:     ['hour'],
  by:      ['bye', 'buy'],
  know:    ['no'],
  there:   ['their', 'theyre'],
  here:    ['hear'],
  where:   ['wear', 'ware'],
  right:   ['write', 'rite'],
  than:    ['then'],
  of:      ['ov', 'uv'],
  have:    ['hav'],
  their:   ['there', 'theyre'],
  they:    ['dey'],
  this:    ['dis'],
  that:    ['dat'],
  the:     ['da', 'de'],
  with:    ['wid', 'wit'],
  what:    ['wut', 'wat'],
}

// Build reverse map for O(1) lookup
const REVERSE_PHONETIC: Record<string, string> = {}
for (const [canonical, variants] of Object.entries(PHONETIC_MAP)) {
  for (const variant of variants) {
    REVERSE_PHONETIC[variant] = canonical
  }
}

function canonicalize(word: string): string {
  return REVERSE_PHONETIC[word] ?? word
}

function phoneticallyEquivalent(a: string, b: string): boolean {
  if (a === b) return true
  return canonicalize(a) === canonicalize(b)
}

// Levenshtein distance — used for short-word tolerance (names, single words ≤5 chars)
export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j]!, dp[i][j - 1]!, dp[i - 1][j - 1]!)
    }
  }
  return dp[m]![n]!
}

export interface STTToleranceResult {
  matched: boolean
  confidence: number  // 0–1
  method: 'exact' | 'phonetic' | 'fuzzy' | 'token_match' | 'none'
}

export function checkSTTTolerance(
  studentAnswer: string,
  expectedAnswer: string,
): STTToleranceResult {
  const studentNorm  = normalizeForVoice(studentAnswer)
  const expectedNorm = normalizeForVoice(expectedAnswer)

  if (studentNorm === expectedNorm) {
    return { matched: true, confidence: 1.0, method: 'exact' }
  }

  // Single-word comparison
  if (!expectedNorm.includes(' ') && !studentNorm.includes(' ')) {
    // Phonetic map check
    if (phoneticallyEquivalent(studentNorm, expectedNorm)) {
      return { matched: true, confidence: 0.85, method: 'phonetic' }
    }
    // Fuzzy match for short words and names (≤6 chars, distance 1)
    if (expectedNorm.length <= 6 && levenshtein(studentNorm, expectedNorm) <= 1) {
      return { matched: true, confidence: 0.75, method: 'fuzzy' }
    }
    // Longer words: distance 1 per 6 chars (proportional tolerance)
    const maxDist = Math.floor(expectedNorm.length / 6)
    if (maxDist >= 1 && levenshtein(studentNorm, expectedNorm) <= maxDist) {
      return { matched: true, confidence: 0.70, method: 'fuzzy' }
    }
  }

  // Multi-word: token-by-token phonetic match
  const studentTokens  = studentNorm.split(' ').filter(Boolean)
  const expectedTokens = expectedNorm.split(' ').filter(Boolean)

  if (expectedTokens.length > 0 && studentTokens.length > 0) {
    const matchedCount = expectedTokens.filter(et =>
      studentTokens.some(st => phoneticallyEquivalent(st, et)),
    ).length
    const ratio = matchedCount / expectedTokens.length

    if (ratio >= 0.9) {
      return { matched: true, confidence: ratio * 0.9, method: 'token_match' }
    }
  }

  return { matched: false, confidence: 0, method: 'none' }
}
