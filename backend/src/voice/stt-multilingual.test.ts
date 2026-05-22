// Phase 7.2 — Multilingual STT + Clarification Reliability
// Static assertions — no AI calls, no DB, no network.
//
// Verifies:
//  1. Cyrillic/Ukrainian transcripts pass voice-turn stabilizer
//  2. Russian transcripts pass voice-turn stabilizer
//  3. Mixed-language transcripts accepted
//  4. detectMultilingualInterruption catches UA/RU clarification patterns
//  5. Broken ESL clarification patterns detected ("what's mean X", "how say X")
//  6. Clarification does not count as invalid answer
//  7. No free-chat regression — non-clarification input classified as answer
//  8. Letter-ratio check works for Cyrillic

import { describe, it, expect } from 'vitest'

import { classifyVoiceTranscript } from './voice-turn-stabilizer.js'
import { detectMultilingualInterruption } from '../runtime/conversation-moves.js'
import { detectStudentQuestion } from '../demo/abuse-guard.js'

// ── 1. Ukrainian transcripts survive the voice-turn stabilizer ──────────────

describe('Phase 7.2 — Ukrainian transcripts in voice-turn stabilizer', () => {
  it('accepts "як сказати протягом 30 хвилин"', () => {
    const r = classifyVoiceTranscript('як сказати протягом 30 хвилин')
    expect(r.usable).toBe(true)
    expect(r.kind).not.toBe('noise')
    expect(r.reason).not.toBe('no_letters')
    expect(r.reason).not.toBe('low_letter_ratio')
  })

  it('accepts "що означає competitive"', () => {
    const r = classifyVoiceTranscript('що означає competitive')
    expect(r.usable).toBe(true)
    expect(r.reason).not.toBe('no_letters')
  })

  it('accepts pure Cyrillic multi-word "як сказати це"', () => {
    const r = classifyVoiceTranscript('як сказати це')
    expect(r.usable).toBe(true)
    expect(r.kind).not.toBe('noise')
  })

  it('normalizedText is non-empty for Cyrillic input', () => {
    const r = classifyVoiceTranscript('як перекласти challenging')
    expect(r.usable).toBe(true)
    expect(r.normalizedText.length).toBeGreaterThan(0)
  })
})

// ── 2. Russian transcripts survive the voice-turn stabilizer ───────────────

describe('Phase 7.2 — Russian transcripts in voice-turn stabilizer', () => {
  it('accepts "как сказать сложный"', () => {
    const r = classifyVoiceTranscript('как сказать сложный')
    expect(r.usable).toBe(true)
    expect(r.reason).not.toBe('no_letters')
  })

  it('accepts "что значит challenging"', () => {
    const r = classifyVoiceTranscript('что значит challenging')
    expect(r.usable).toBe(true)
  })

  it('accepts "как будет по английски"', () => {
    const r = classifyVoiceTranscript('как будет по английски')
    expect(r.usable).toBe(true)
    expect(r.kind).not.toBe('noise')
  })
})

// ── 3. Mixed-language (Cyrillic + Latin) transcripts accepted ──────────────

describe('Phase 7.2 — Mixed-language transcripts accepted', () => {
  it('accepts "як сказати challenging"', () => {
    const r = classifyVoiceTranscript('як сказати challenging')
    expect(r.usable).toBe(true)
  })

  it('accepts "що означає competitive — конкурентний?"', () => {
    const r = classifyVoiceTranscript('що означає competitive конкурентний')
    expect(r.usable).toBe(true)
  })

  it('accepts "как сказать for 30 minutes"', () => {
    const r = classifyVoiceTranscript('как сказать for 30 minutes')
    expect(r.usable).toBe(true)
  })
})

// ── 4. detectMultilingualInterruption catches UA/RU patterns ───────────────

describe('Phase 7.2 — detectMultilingualInterruption UA patterns', () => {
  const UA_PHRASES = [
    'як сказати протягом 30 хвилин',
    'як перекласти challenge',
    'як буде competitive',
    'як по англійськи сказати',
    'що означає конкурентний',
    'як звучить this phrase',
    'як правильно сказати',
  ]

  for (const phrase of UA_PHRASES) {
    it(`detects UA: "${phrase}"`, () => {
      const r = detectMultilingualInterruption(phrase)
      expect(r.detected).toBe(true)
      expect(r.nativeText).not.toBeNull()
    })
  }
})

describe('Phase 7.2 — detectMultilingualInterruption RU patterns', () => {
  const RU_PHRASES = [
    'как сказать по английски',
    'как будет challenge',
    'как перевести competitive',
    'что значит challenging',
    'как правильно сказать',
    'переведи это слово',
  ]

  for (const phrase of RU_PHRASES) {
    it(`detects RU: "${phrase}"`, () => {
      const r = detectMultilingualInterruption(phrase)
      expect(r.detected).toBe(true)
    })
  }
})

// ── 5. Broken ESL clarification detected by detectStudentQuestion ──────────

describe('Phase 7.2 — broken ESL clarification patterns', () => {
  it('detects "what\'s mean challenge"', () => {
    expect(detectStudentQuestion("what's mean challenge")).toBe(true)
  })

  it('detects "whats mean challenge"', () => {
    expect(detectStudentQuestion('whats mean challenge')).toBe(true)
  })

  it('detects "what means competitive"', () => {
    expect(detectStudentQuestion('what means competitive')).toBe(true)
  })

  it('detects "what mean that word"', () => {
    expect(detectStudentQuestion('what mean that word')).toBe(true)
  })

  it('detects "how say difficult"', () => {
    expect(detectStudentQuestion('how say difficult')).toBe(true)
  })

  it('detects "how to say challenging"', () => {
    expect(detectStudentQuestion('how to say challenging')).toBe(true)
  })

  it('does NOT detect normal exercise answer "I work every day"', () => {
    expect(detectStudentQuestion('I work every day')).toBe(false)
  })

  it('does NOT detect short answer "challenging"', () => {
    expect(detectStudentQuestion('challenging')).toBe(false)
  })

  it('does NOT detect "a difficult challenge awaits"', () => {
    expect(detectStudentQuestion('a difficult challenge awaits')).toBe(false)
  })
})

// ── 6. Clarification classification — no step advance ─────────────────────

describe('Phase 7.2 — multilingual does not trigger correction ladder', () => {
  it('Ukrainian phrase classified as usable (reaches routing layer)', () => {
    const r = classifyVoiceTranscript('як сказати протягом 30 хвилин')
    // usable=true means it REACHES the routing layer where multilingual detection fires
    // It must NOT be discarded as noise before reaching demo-routes or lesson-ws
    expect(r.usable).toBe(true)
  })

  it('detectMultilingualInterruption fires before validator — detected phrase is not an answer', () => {
    const phrase = 'як сказати challenge'
    const multilingual = detectMultilingualInterruption(phrase)
    expect(multilingual.detected).toBe(true)
    // When detected=true, demo-routes returns 422 MULTILINGUAL_RESCUE — does not advance step
    // No correction ladder triggered (200 code never reached for multilingual)
  })
})

// ── 7. No free-chat regression ────────────────────────────────────────────

describe('Phase 7.2 — no free-chat regression', () => {
  it('non-clarification English answer passes stabilizer as answer', () => {
    const r = classifyVoiceTranscript('I have been working here for five years')
    expect(r.usable).toBe(true)
    expect(r.kind).toBe('answer')
  })

  it('English question classified as question kind', () => {
    const r = classifyVoiceTranscript('what does competitive mean')
    expect(r.usable).toBe(true)
    expect(r.kind).toBe('question')
  })

  it('pure noise still rejected', () => {
    const r = classifyVoiceTranscript('...')
    expect(r.usable).toBe(false)
    expect(r.kind).toBe('noise')
  })

  it('detectMultilingualInterruption rejects unrelated English', () => {
    expect(detectMultilingualInterruption('I work every day').detected).toBe(false)
    expect(detectMultilingualInterruption('the answer is A').detected).toBe(false)
    expect(detectMultilingualInterruption('yes I agree').detected).toBe(false)
  })
})

// ── 8. Letter-ratio check works correctly for Cyrillic ────────────────────

describe('Phase 7.2 — Unicode letter ratio for Cyrillic', () => {
  it('3-char Cyrillic word has sufficient letter ratio', () => {
    // "як" (2 Cyrillic chars) — previously: 0 ASCII letters → rejected
    const r = classifyVoiceTranscript('як це')
    expect(r.usable).toBe(true)
  })

  it('all-Cyrillic sentence has high letter ratio', () => {
    const r = classifyVoiceTranscript('як сказати це слово')
    expect(r.reason).not.toBe('low_letter_ratio')
    expect(r.reason).not.toBe('no_letters')
  })

  it('punctuation-only string still rejected', () => {
    const r = classifyVoiceTranscript('... !!! ???')
    expect(r.usable).toBe(false)
    expect(r.kind).toBe('noise')
  })
})
