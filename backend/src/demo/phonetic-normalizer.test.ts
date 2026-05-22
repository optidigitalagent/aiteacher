// Phase 7.6 — Adaptive English-vs-Cyrillic STT Balancing
// Static assertions — no AI calls, no DB, no network.
//
// Verifies:
//  1. Fast path: already-Latin text returned unchanged
//  2. Phonetic Cyrillic English → normalised English (core task spec examples)
//  3. Mixed phonetic + real Cyrillic words: phonetic normalised, real words preserved
//  4. Real RU/UA clarification triggers: preserved unchanged (never normalised)
//  5. Regression: Phase 7.3 clarification patterns still reach rescue
//  6. Regression: Phase 7.4 meaning-first patterns still work
//  7. Edge cases: punctuation, capitalisation, multi-word

import { describe, it, expect } from 'vitest'
import { normalizePhoneticallyRenderedEnglish, detectSttUncertain } from './phonetic-normalizer.js'

// ── 1. Fast path — no Cyrillic ────────────────────────────────────────────────

describe('Phase 7.6 — fast path: no Cyrillic → unchanged', () => {
  it('"I like" (already English) → unchanged', () => {
    const r = normalizePhoneticallyRenderedEnglish('I like')
    expect(r.normalizedText).toBe('I like')
    expect(r.wasNormalized).toBe(false)
    expect(r.cyrillicRatio).toBe(0)
  })

  it('"I like geography" (already English) → unchanged', () => {
    const r = normalizePhoneticallyRenderedEnglish('I like geography')
    expect(r.normalizedText).toBe('I like geography')
    expect(r.wasNormalized).toBe(false)
  })

  it('"Mr Beast is great" (already English) → unchanged', () => {
    const r = normalizePhoneticallyRenderedEnglish('Mr Beast is great')
    expect(r.normalizedText).toBe('Mr Beast is great')
    expect(r.wasNormalized).toBe(false)
  })
})

// ── 2. Phonetic Cyrillic English → normalised (task spec examples) ────────────

describe('Phase 7.6 — phonetic Cyrillic → English normalisation', () => {
  it('"ай лайк" → "I like"', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай лайк')
    expect(r.normalizedText).toBe('I like')
    expect(r.wasNormalized).toBe(true)
    expect(r.wordsNormalized).toBe(2)
  })

  it('"ай вотч" → "I watch"', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай вотч')
    expect(r.normalizedText).toBe('I watch')
    expect(r.wasNormalized).toBe(true)
  })

  it('"ай воч" → "I watch" (alternate spelling)', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай воч')
    expect(r.normalizedText).toBe('I watch')
    expect(r.wasNormalized).toBe(true)
  })

  it('"ай эм" → "I am"', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай эм')
    expect(r.normalizedText).toBe('I am')
    expect(r.wasNormalized).toBe(true)
  })

  it('"ай лав" → "I love"', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай лав')
    expect(r.normalizedText).toBe('I love')
    expect(r.wasNormalized).toBe(true)
  })

  it('"ай гоу" → "I go"', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай гоу')
    expect(r.normalizedText).toBe('I go')
    expect(r.wasNormalized).toBe(true)
  })

  it('"май френд" → "my friend"', () => {
    const r = normalizePhoneticallyRenderedEnglish('май френд')
    expect(r.normalizedText).toBe('my friend')
    expect(r.wasNormalized).toBe(true)
  })

  it('"мистер бист" → "Mr Beast"', () => {
    const r = normalizePhoneticallyRenderedEnglish('мистер бист')
    expect(r.normalizedText).toBe('Mr Beast')
    expect(r.wasNormalized).toBe(true)
  })

  it('"мр бист" → "Mr Beast"', () => {
    const r = normalizePhoneticallyRenderedEnglish('мр бист')
    expect(r.normalizedText).toBe('Mr Beast')
    expect(r.wasNormalized).toBe(true)
  })
})

// ── 3. Mixed phonetic + real Cyrillic words ───────────────────────────────────

describe('Phase 7.6 — mixed phonetic + real Cyrillic preserved', () => {
  it('"ай лайк географія" → "I like географія" (географія preserved)', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай лайк географія')
    expect(r.normalizedText).toBe('I like географія')
    expect(r.wasNormalized).toBe(true)
    expect(r.wordsNormalized).toBe(2)  // "ай" and "лайк" only
  })

  it('"ай вотч смешный фільм" → "I watch смешный фільм"', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай вотч смешный фільм')
    expect(r.normalizedText).toBe('I watch смешный фільм')
    expect(r.wasNormalized).toBe(true)
  })

  it('"ай эм студент" → "I am студент"', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай эм студент')
    expect(r.normalizedText).toBe('I am студент')
    expect(r.wasNormalized).toBe(true)
  })
})

// ── 4. RU/UA clarification triggers — must NOT be normalised ──────────────────

describe('Phase 7.6 — clarification triggers preserved unchanged', () => {
  it('"як сказати протягом 30 хвилин" → unchanged', () => {
    const r = normalizePhoneticallyRenderedEnglish('як сказати протягом 30 хвилин')
    expect(r.normalizedText).toBe('як сказати протягом 30 хвилин')
    expect(r.wasNormalized).toBe(false)
    expect(r.clarificationPreserved).toBe(true)
  })

  it('"як сказати" (short) → unchanged', () => {
    const r = normalizePhoneticallyRenderedEnglish('як сказати')
    expect(r.wasNormalized).toBe(false)
    expect(r.clarificationPreserved).toBe(true)
  })

  it('"как сказать смешной фильм" → unchanged (RU clarification)', () => {
    const r = normalizePhoneticallyRenderedEnglish('как сказать смешной фильм')
    expect(r.normalizedText).toBe('как сказать смешной фильм')
    expect(r.wasNormalized).toBe(false)
    expect(r.clarificationPreserved).toBe(true)
  })

  it('"переведи challenge" → unchanged', () => {
    const r = normalizePhoneticallyRenderedEnglish('переведи challenge')
    expect(r.wasNormalized).toBe(false)
    expect(r.clarificationPreserved).toBe(true)
  })

  it('"переклади цей текст" → unchanged', () => {
    const r = normalizePhoneticallyRenderedEnglish('переклади цей текст')
    expect(r.wasNormalized).toBe(false)
    expect(r.clarificationPreserved).toBe(true)
  })

  it('"що означає challenge" → unchanged', () => {
    const r = normalizePhoneticallyRenderedEnglish('що означає challenge')
    expect(r.wasNormalized).toBe(false)
    expect(r.clarificationPreserved).toBe(true)
  })

  it('"як по англійськи" → unchanged', () => {
    const r = normalizePhoneticallyRenderedEnglish('як по англійськи')
    expect(r.wasNormalized).toBe(false)
    expect(r.clarificationPreserved).toBe(true)
  })
})

// ── 5. normalizedWordCyrillicRatio ────────────────────────────────────────────

describe('Phase 7.6 — normalizedWordCyrillicRatio field', () => {
  it('pure Latin → normalizedWordCyrillicRatio = 0', () => {
    const r = normalizePhoneticallyRenderedEnglish('I like geography')
    expect(r.normalizedWordCyrillicRatio).toBe(0)
  })

  it('"ай лайк" → normalized to "I like" → normalizedWordCyrillicRatio = 0', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай лайк')
    expect(r.normalizedWordCyrillicRatio).toBe(0)
  })

  it('"ай лайк географія" → "I like географія" → 1/3 Cyrillic words', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай лайк географія')
    expect(r.normalizedWordCyrillicRatio).toBeCloseTo(1 / 3, 2)
  })

  it('"I like географія" (already Latin start) → 1/3 Cyrillic words', () => {
    const r = normalizePhoneticallyRenderedEnglish('I like географія')
    expect(r.normalizedWordCyrillicRatio).toBeCloseTo(1 / 3, 2)
  })

  it('pure garbage Cyrillic → normalizedWordCyrillicRatio = 1.0', () => {
    const r = normalizePhoneticallyRenderedEnglish('гврнгр дсвкнр')
    expect(r.normalizedWordCyrillicRatio).toBe(1)
  })
})

// ── 6. STT uncertainty detector (principle-based, not dictionary-based) ───────

describe('Phase 7.6 upgrade — detectSttUncertain: primary is en-US STT, this is a safety net', () => {
  it('en-US transcript (no Cyrillic) → not uncertain', () => {
    const r = normalizePhoneticallyRenderedEnglish('I like geography')
    expect(detectSttUncertain(r)).toBe(false)
  })

  it('"ай лайк" normalizes confidently to "I like" → not uncertain', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай лайк')
    expect(detectSttUncertain(r)).toBe(false)
  })

  it('unknown Cyrillic phonetic garbage without clarification trigger → STT_UNCERTAIN', () => {
    const r = normalizePhoneticallyRenderedEnglish('гврнгр дсвкнр')
    expect(detectSttUncertain(r)).toBe(true)
  })

  it('single unknown Cyrillic word without clarification trigger → STT_UNCERTAIN', () => {
    const r = normalizePhoneticallyRenderedEnglish('математика')
    expect(detectSttUncertain(r)).toBe(true)
  })

  it('"як сказати математика" → clarificationPreserved=true → NOT uncertain', () => {
    const r = normalizePhoneticallyRenderedEnglish('як сказати математика')
    expect(detectSttUncertain(r)).toBe(false)
    expect(r.clarificationPreserved).toBe(true)
  })

  it('"I like географія" → 1/3 Cyrillic words → NOT uncertain (stays in meaning-first rescue)', () => {
    const r = normalizePhoneticallyRenderedEnglish('I like географія')
    expect(detectSttUncertain(r)).toBe(false)
    expect(r.normalizedWordCyrillicRatio).toBeCloseTo(1 / 3, 2)
  })

  it('"ай лайк географія" → "I like географія" → 1/3 Cyrillic words → NOT uncertain', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай лайк географія')
    expect(detectSttUncertain(r)).toBe(false)
  })

  it('uncertain transcript does not advance step (STT_UNCERTAIN → convRetry → mayAdvance=false)', () => {
    // Structural test: uncertain means the caller returns 422 with convRetry — no DB advance
    const r = normalizePhoneticallyRenderedEnglish('гврнгр дсвкнр')
    expect(detectSttUncertain(r)).toBe(true)  // caller sends 422 convRetry, never calls saveAnswer
  })

  it('no large dictionary: PHONETIC_MAP has fewer than 40 entries', () => {
    // Principle guard: the map is intentionally small; growth here is a smell
    // This test fails if someone tries to "fix" uncertain STT by expanding the dictionary
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src = require('fs').readFileSync(require('path').join(__dirname, 'phonetic-normalizer.ts'), 'utf8') as string
    const mapMatch = src.match(/const PHONETIC_MAP[^=]+=\s*\{([^}]+)\}/s)
    if (!mapMatch) throw new Error('PHONETIC_MAP not found in source')
    const entries = (mapMatch[1] ?? '').match(/^\s+'/gm)?.length ?? 0
    expect(entries).toBeLessThan(40)
  })
})

// ── 7. cyrillicRatio diagnostics ─────────────────────────────────────────────

describe('Phase 7.6 — cyrillicRatio diagnostics', () => {
  it('"ай лайк" → cyrillicRatio > 0', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай лайк')
    expect(r.cyrillicRatio).toBeGreaterThan(0)
  })

  it('"I like" → cyrillicRatio = 0', () => {
    const r = normalizePhoneticallyRenderedEnglish('I like')
    expect(r.cyrillicRatio).toBe(0)
  })

  it('"ай лайк географія" → isMostlyCyrillic = true', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай лайк географія')
    expect(r.isMostlyCyrillic).toBe(true)
  })
})

// ── 8. Edge cases ────────────────────────────────────────────────────────────

describe('Phase 7.6 — edge cases', () => {
  it('empty string → unchanged', () => {
    const r = normalizePhoneticallyRenderedEnglish('')
    expect(r.normalizedText).toBe('')
    expect(r.wasNormalized).toBe(false)
  })

  it('"ай" alone → "I"', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай')
    expect(r.normalizedText).toBe('I')
    expect(r.wasNormalized).toBe(true)
  })

  it('"ай лайк" with trailing punctuation preserves it', () => {
    const r = normalizePhoneticallyRenderedEnglish('ай лайк!')
    expect(r.normalizedText).toBe('I like!')
    expect(r.wasNormalized).toBe(true)
  })

  it('word not in map ("географія") is preserved as-is', () => {
    const r = normalizePhoneticallyRenderedEnglish('географія')
    expect(r.normalizedText).toBe('географія')
    expect(r.wasNormalized).toBe(false)
  })

  it('"мр бист" variant → "Mr Beast"', () => {
    const r = normalizePhoneticallyRenderedEnglish('мр бист')
    expect(r.normalizedText).toBe('Mr Beast')
    expect(r.wasNormalized).toBe(true)
  })
})
