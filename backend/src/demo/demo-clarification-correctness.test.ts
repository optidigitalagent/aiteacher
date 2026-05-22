// Phase 7.3 — Demo Clarification Answer Correctness
// Static assertions — no AI calls, no DB, no network.
//
// Verifies:
//  1. buildMultilingualPhraseAnswer returns correct Cyrillic phrase translations
//  2. buildMultilingualPhraseAnswer returns correct English idiom explanations
//  3. Clarification responses never contain unrelated grammar MCQ text
//  4. detectPhraseQuestion correctly identifies phrase lookup inputs
//  5. detectMultilingualInterruption catches "how to say [Cyrillic]" patterns
//  6. Current step prompt is preserved in all clarification responses
//  7. No step advance — response shape is clarification, not completion

import { describe, it, expect } from 'vitest'

import {
  buildMultilingualPhraseAnswer,
  detectPhraseQuestion,
  detectMultilingualInterruption,
} from '../runtime/conversation-moves.js'

const STEP_PROMPT = 'Will you go to the party if it rains?'

// ── 1. Cyrillic phrase → English translation ──────────────────────────────────

describe('Phase 7.3 — Cyrillic phrase translations', () => {
  it('"How to say смішний фільм" returns funny movie/film', () => {
    const result = buildMultilingualPhraseAnswer('How to say смішний фільм', STEP_PROMPT)
    const lower = result.toLowerCase()
    expect(lower).toMatch(/funny\s+(movie|film)/)
  })

  it('"Окей але як сказати смішний фільм" returns funny movie', () => {
    const result = buildMultilingualPhraseAnswer('Окей але як сказати смішний фільм', STEP_PROMPT)
    const lower = result.toLowerCase()
    expect(lower).toMatch(/funny\s+(movie|film)/)
  })

  it('"як сказати протягом 30 хвилин" returns "for 30 minutes"', () => {
    const result = buildMultilingualPhraseAnswer('як сказати протягом 30 хвилин', STEP_PROMPT)
    const lower = result.toLowerCase()
    expect(lower).toContain('for 30 minutes')
  })

  it('"як сказати протягом" returns time-related answer', () => {
    const result = buildMultilingualPhraseAnswer('як сказати протягом', STEP_PROMPT)
    const lower = result.toLowerCase()
    expect(lower).toMatch(/for|period|time/)
  })

  it('"как сказать успел закончить" returns "managed to finish"', () => {
    const result = buildMultilingualPhraseAnswer('как сказать успел закончить', STEP_PROMPT)
    const lower = result.toLowerCase()
    expect(lower).toContain('managed to finish')
  })

  it('"що означає смішний фільм" returns funny movie', () => {
    const result = buildMultilingualPhraseAnswer('що означає смішний фільм', STEP_PROMPT)
    const lower = result.toLowerCase()
    expect(lower).toMatch(/funny\s+(movie|film)/)
  })

  it('"в течение 30 минут" returns "for 30 minutes"', () => {
    const result = buildMultilingualPhraseAnswer('как перевести в течение 30 минут', STEP_PROMPT)
    const lower = result.toLowerCase()
    expect(lower).toContain('for 30 minutes')
  })

  it('"встиг закінчити" returns "managed to finish"', () => {
    const result = buildMultilingualPhraseAnswer('як сказати встиг закінчити', STEP_PROMPT)
    const lower = result.toLowerCase()
    expect(lower).toContain('managed to finish')
  })
})

// ── 2. English idiom → explanation ───────────────────────────────────────────

describe('Phase 7.3 — English idiom explanations', () => {
  it('"what does keep pulling you back in mean" explains the idiom', () => {
    const result = buildMultilingualPhraseAnswer('what does keep pulling you back in mean', STEP_PROMPT)
    const lower = result.toLowerCase()
    // Must explain "return to it" or "continue" concept
    expect(lower).toMatch(/return|continue|want to/)
  })

  it('"what\'s mean challenge" explains challenge', () => {
    const result = buildMultilingualPhraseAnswer("what's mean challenge", STEP_PROMPT)
    const lower = result.toLowerCase()
    expect(lower).toMatch(/difficult|test|skill|determination/)
  })

  it('"what means competitive" explains competitive', () => {
    const result = buildMultilingualPhraseAnswer('what means competitive', STEP_PROMPT)
    const lower = result.toLowerCase()
    expect(lower).toMatch(/win|better|others/)
  })

  it('"how to say give up" explains give up', () => {
    const result = buildMultilingualPhraseAnswer('how to say give up', STEP_PROMPT)
    const lower = result.toLowerCase()
    expect(lower).toMatch(/stop|quit|trying/)
  })
})

// ── 3. Clarification responses NEVER contain unrelated grammar text ───────────

describe('Phase 7.3 — No unrelated grammar content in clarification', () => {
  const FORBIDDEN_PHRASES = [
    'will cancel',
    'first conditional',
    'if it rains, i will',
    'if + present simple',
    'wrong because',
    'correct answer is',
  ]

  function assertNoGrammarText(input: string, label: string): void {
    const result = buildMultilingualPhraseAnswer(input, STEP_PROMPT)
    const lower = result.toLowerCase()
    for (const forbidden of FORBIDDEN_PHRASES) {
      expect(lower, `${label} must not contain "${forbidden}"`).not.toContain(forbidden)
    }
  }

  it('Cyrillic phrase answer has no grammar MCQ text', () => {
    assertNoGrammarText('How to say смішний фільм', 'смішний фільм response')
  })

  it('Ukrainian time phrase has no grammar MCQ text', () => {
    assertNoGrammarText('як сказати протягом 30 хвилин', 'протягом response')
  })

  it('Russian achievement phrase has no grammar MCQ text', () => {
    assertNoGrammarText('как сказать успел закончить', 'успел закончить response')
  })

  it('English idiom answer has no grammar MCQ text', () => {
    assertNoGrammarText('what does keep pulling you back in mean', 'keep pulling you back in response')
  })

  it('English broken ESL has no grammar MCQ text', () => {
    assertNoGrammarText("what's mean challenge", "what's mean challenge response")
  })
})

// ── 4. Current step prompt is preserved ───────────────────────────────────────

describe('Phase 7.3 — Step prompt preserved / no step advance', () => {
  it('Cyrillic rescue returns step prompt anchor', () => {
    const result = buildMultilingualPhraseAnswer('як сказати протягом 30 хвилин', STEP_PROMPT)
    // Response must contain an anchor back to the current step
    expect(result).toContain(STEP_PROMPT)
  })

  it('English idiom answer returns step prompt anchor', () => {
    const result = buildMultilingualPhraseAnswer('what does keep pulling you back in mean', STEP_PROMPT)
    expect(result).toContain(STEP_PROMPT)
  })

  it('Fallback (unknown Cyrillic phrase) returns step prompt anchor', () => {
    const result = buildMultilingualPhraseAnswer('як сказати абвгдеж', STEP_PROMPT)
    expect(result).toContain(STEP_PROMPT)
  })

  it('buildMultilingualPhraseAnswer does not return empty string', () => {
    const result = buildMultilingualPhraseAnswer('як сказати смішний фільм', STEP_PROMPT)
    expect(result.trim().length).toBeGreaterThan(10)
  })
})

// ── 5. detectPhraseQuestion gate ──────────────────────────────────────────────

describe('Phase 7.3 — detectPhraseQuestion gate', () => {
  // Should detect
  it('detects "how to say смішний фільм"', () => {
    expect(detectPhraseQuestion('How to say смішний фільм')).toBe(true)
  })
  it('detects "як сказати протягом"', () => {
    expect(detectPhraseQuestion('як сказати протягом')).toBe(true)
  })
  it('detects "как сказать успел закончить"', () => {
    expect(detectPhraseQuestion('как сказать успел закончить')).toBe(true)
  })
  it('detects "what does keep pulling you back in mean"', () => {
    expect(detectPhraseQuestion('what does keep pulling you back in mean')).toBe(true)
  })
  it('detects "what\'s mean challenge"', () => {
    expect(detectPhraseQuestion("what's mean challenge")).toBe(true)
  })
  it('detects "what means competitive"', () => {
    expect(detectPhraseQuestion('what means competitive')).toBe(true)
  })
  it('detects "how say difficult"', () => {
    expect(detectPhraseQuestion('how say difficult')).toBe(true)
  })
  it('detects "how to say challenging"', () => {
    expect(detectPhraseQuestion('how to say challenging')).toBe(true)
  })
  it('detects "що означає challenge"', () => {
    expect(detectPhraseQuestion('що означає challenge')).toBe(true)
  })

  // Should NOT detect (normal exercise answers)
  it('does NOT detect "I will go to the party if it does not rain"', () => {
    expect(detectPhraseQuestion('I will go to the party if it does not rain')).toBe(false)
  })
  it('does NOT detect "yes I agree"', () => {
    expect(detectPhraseQuestion('yes I agree')).toBe(false)
  })
  it('does NOT detect "challenging"', () => {
    expect(detectPhraseQuestion('challenging')).toBe(false)
  })
  it('does NOT detect "I work every day"', () => {
    expect(detectPhraseQuestion('I work every day')).toBe(false)
  })
  it('does NOT detect "the answer is B"', () => {
    expect(detectPhraseQuestion('the answer is B')).toBe(false)
  })
})

// ── 6. detectMultilingualInterruption — Phase 7.3 new cases ──────────────────

describe('Phase 7.3 — detectMultilingualInterruption extended', () => {
  it('detects "How to say смішний фільм" (English query + Cyrillic phrase)', () => {
    expect(detectMultilingualInterruption('How to say смішний фільм').detected).toBe(true)
  })

  it('detects "Окей але як сказати смішний фільм"', () => {
    expect(detectMultilingualInterruption('Окей але як сказати смішний фільм').detected).toBe(true)
  })

  it('still does NOT detect pure English exercise answer', () => {
    expect(detectMultilingualInterruption('I will go if it stops raining').detected).toBe(false)
  })

  it('still does NOT detect English idiom question (no Cyrillic)', () => {
    // English-only idiom questions go via detectStudentQuestion → buildClarificationAnswer
    expect(detectMultilingualInterruption('what does keep pulling you back in mean').detected).toBe(false)
  })
})

// ── 7. Edge cases & safety ────────────────────────────────────────────────────

describe('Phase 7.3 — Edge cases', () => {
  it('empty string does not throw', () => {
    expect(() => buildMultilingualPhraseAnswer('', STEP_PROMPT)).not.toThrow()
  })

  it('detectPhraseQuestion does not throw on empty string', () => {
    expect(() => detectPhraseQuestion('')).not.toThrow()
  })

  it('very long input is handled safely', () => {
    const long = 'як сказати ' + 'а'.repeat(200)
    expect(() => buildMultilingualPhraseAnswer(long, STEP_PROMPT)).not.toThrow()
  })

  it('buildMultilingualPhraseAnswer with empty stepPrompt does not crash', () => {
    const result = buildMultilingualPhraseAnswer('як сказати смішний фільм', '')
    expect(result.trim().length).toBeGreaterThan(5)
  })
})
