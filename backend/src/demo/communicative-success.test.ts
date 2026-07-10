// Phase 7.5 — Communicative Success > Grammar Perfection
// Static assertions — no AI calls, no DB, no network.
//
// Verifies:
//  1. isCommunicativelySubstantive accepts short communicative answers
//  2. isCommunicativelySubstantive rejects empty / filler / collapsed answers
//  3. buildCommunicativeRecast produces natural recasts for LOW severity grammar
//  4. assessGrammarSeverity (via soft-speaking-validator) distinguishes LOW vs HIGH
//  5. Regression: multilingual rescue still works
//  6. Regression: clarification still works (detectPhraseQuestion)
//  7. Regression: semantic collapse (word salad) NOT silently accepted

import { describe, it, expect } from 'vitest'
import { isCommunicativelySubstantive } from '../demo/abuse-guard.js'
import { buildCommunicativeRecast } from '../runtime/conversation-moves.js'
import { validateSoftSpeakingAnswer } from '../validation/soft-speaking-validator.js'
import { detectMultilingualInterruption, detectPhraseQuestion } from '../runtime/conversation-moves.js'

const STEP_PROMPT = 'Tell me about something you enjoy.'

// ── 1. isCommunicativelySubstantive — ACCEPTED cases ─────────────────────────

describe('Phase 7.5 — isCommunicativelySubstantive: ACCEPTED (communicative)', () => {
  it('"I watching funny movie" is communicatively substantive', () => {
    expect(isCommunicativelySubstantive('I watching funny movie')).toBe(true)
  })
  it('"I go America and watch Mr Beast" is communicatively substantive', () => {
    expect(isCommunicativelySubstantive('I go America and watch Mr Beast')).toBe(true)
  })
  it('"My teacher inspire me" is communicatively substantive', () => {
    expect(isCommunicativelySubstantive('My teacher inspire me')).toBe(true)
  })
  it('"I like geography because interesting countries" is communicatively substantive', () => {
    expect(isCommunicativelySubstantive('I like geography because interesting countries')).toBe(true)
  })
  it('"I want communication with millionaires" is communicatively substantive', () => {
    expect(isCommunicativelySubstantive('I want communication with millionaires')).toBe(true)
  })
  it('"I going school every day" is communicatively substantive', () => {
    expect(isCommunicativelySubstantive('I going school every day')).toBe(true)
  })
  it('"My friend inspire me a lot" is communicatively substantive', () => {
    expect(isCommunicativelySubstantive('My friend inspire me a lot')).toBe(true)
  })
})

// ── 2. isCommunicativelySubstantive — REJECTED cases ─────────────────────────

describe('Phase 7.5 — isCommunicativelySubstantive: REJECTED (not substantive)', () => {
  it('"ok" is not communicatively substantive', () => {
    expect(isCommunicativelySubstantive('ok')).toBe(false)
  })
  it('"yes" is not communicatively substantive', () => {
    expect(isCommunicativelySubstantive('yes')).toBe(false)
  })
  it('"I" (single word) is not communicatively substantive', () => {
    expect(isCommunicativelySubstantive('I')).toBe(false)
  })
  it('empty string is not communicatively substantive', () => {
    expect(isCommunicativelySubstantive('')).toBe(false)
  })
  it('"walking going wanting friend come dog chips" (word salad without subject) is not substantive', () => {
    // No subject pronoun → not substantive
    expect(isCommunicativelySubstantive('walking going wanting friend come dog chips')).toBe(false)
  })
})

// ── 3. buildCommunicativeRecast — natural recasts for LOW severity grammar ────

describe('Phase 7.5 — buildCommunicativeRecast: natural recasts', () => {
  it('"I watching funny movie" → recast with "watching a funny movie"', () => {
    const r = buildCommunicativeRecast('I watching funny movie', STEP_PROMPT, 0)
    expect(r).not.toBeNull()
    expect(r!.toLowerCase()).toContain("you're watching")
    expect(r!.toLowerCase()).toContain('funny movie')
  })

  it('"I go America" → recast mentioning "went to America"', () => {
    const r = buildCommunicativeRecast('I go America', STEP_PROMPT, 0)
    expect(r).not.toBeNull()
    expect(r!.toLowerCase()).toContain('america')
  })

  it('"My teacher inspire me" → recast with "your teacher inspires you"', () => {
    const r = buildCommunicativeRecast('My teacher inspire me', STEP_PROMPT, 0)
    expect(r).not.toBeNull()
    expect(r!.toLowerCase()).toContain('teacher inspires you')
  })

  it('"I like geography because interesting countries" → acknowledges geography interest', () => {
    const r = buildCommunicativeRecast('I like geography because interesting countries', STEP_PROMPT, 0)
    expect(r).not.toBeNull()
    expect(r!.toLowerCase()).toContain('geography')
  })

  it('"I want communication with millionaires" → acknowledges the goal', () => {
    const r = buildCommunicativeRecast('I want communication with millionaires', STEP_PROMPT, 0)
    expect(r).not.toBeNull()
    expect(r!.toLowerCase()).toContain('millionaires')
  })

  it('recast does not contain "try again" or grammar correction demand', () => {
    const inputs = [
      'I watching funny movie',
      'My teacher inspire me',
      'I go America',
    ]
    for (const input of inputs) {
      const r = buildCommunicativeRecast(input, STEP_PROMPT, 0)
      if (r) {
        const lower = r.toLowerCase()
        expect(lower, `"${input}" recast should not contain "try again"`).not.toContain('try again')
        expect(lower, `"${input}" recast should not contain "correct grammar"`).not.toContain('correct grammar')
        expect(lower, `"${input}" recast should not contain "wrong"`).not.toContain('wrong')
      }
    }
  })

  it('recast ends with a followup or returns the step prompt', () => {
    const r = buildCommunicativeRecast('I watching funny movie', STEP_PROMPT, 0)
    expect(r).not.toBeNull()
    // Must contain either a question, "let's", "now", or the step prompt itself
    expect(r).toMatch(/[?]|let[''']?s|now|Tell me|enjoy|recommend|interesting|long/)
  })

  it('does not throw on empty string', () => {
    expect(() => buildCommunicativeRecast('', STEP_PROMPT, 0)).not.toThrow()
  })
})

// ── 4. soft-speaking-validator: LOW severity grammar — communicative tolerance ─

describe('Phase 7.5 — soft-speaking-validator: LOW severity grammar accepted early', () => {
  const BASE_INPUT = {
    exerciseId: 'ex-test',
    exerciseNumber: 1,
    exerciseType: 'soft_speaking',
    instruction: 'Tell me who inspires you and why.',
    itemText: '',
    minWords: 2,
  }

  it('"My teacher inspire me" at attempt 1 asks for the missing reason', () => {
    const result = validateSoftSpeakingAnswer({
      ...BASE_INPUT,
      studentTranscript: 'My teacher inspire me',
      attemptCount: 1,
    })
    expect(result.allowProgression).toBe(false)
    expect(['missing_reason', 'broken_grammar']).toContain(result.issueType)
    expect(result.repairPrompt).toContain('because')
  })

  it('"I watching funny movie" at attempt 1 should soft-accept (LOW severity)', () => {
    const result = validateSoftSpeakingAnswer({
      ...BASE_INPUT,
      instruction: 'What are you watching these days?',
      studentTranscript: 'I watching funny movie',
      attemptCount: 1,
    })
    expect(result.allowProgression).toBe(true)
  })

  it('"I go America and watch videos" at attempt 1 should soft-accept (LOW severity)', () => {
    const result = validateSoftSpeakingAnswer({
      ...BASE_INPUT,
      instruction: 'Tell me about your plans.',
      studentTranscript: 'I go America and watch videos',
      attemptCount: 1,
    })
    expect(result.allowProgression).toBe(true)
  })
})

// ── 5. Intervention required: semantic collapse ───────────────────────────────

describe('Phase 7.5 — HIGH severity: semantic collapse triggers scaffold', () => {
  const BASE_INPUT = {
    exerciseId: 'ex-test',
    exerciseNumber: 1,
    exerciseType: 'soft_speaking',
    instruction: 'Tell me about your hobby.',
    itemText: '',
    minWords: 2,
  }

  it('"I walking going wanting friend come dog chips" at attempt 0 should NOT allow progression', () => {
    const result = validateSoftSpeakingAnswer({
      ...BASE_INPUT,
      studentTranscript: 'I walking going wanting friend come dog chips',
      attemptCount: 0,
    })
    // HIGH severity: 3+ gerunds → no communicative fast-path
    expect(result.allowProgression).toBe(false)
    expect(result.needsRetry).toBe(true)
  })
})

// ── 6. Regression: multilingual rescue still works ───────────────────────────

describe('Phase 7.5 — Regression: multilingual rescue intact', () => {
  it('detects "як сказати смішний фільм" as multilingual interruption', () => {
    expect(detectMultilingualInterruption('як сказати смішний фільм').detected).toBe(true)
  })
  it('detects "как сказать интересный" as multilingual interruption', () => {
    expect(detectMultilingualInterruption('как сказать интересный').detected).toBe(true)
  })
  it('pure English answer is NOT multilingual interruption', () => {
    expect(detectMultilingualInterruption('I watching funny movie').detected).toBe(false)
  })
  it('pure English communicative answer is NOT multilingual interruption', () => {
    expect(detectMultilingualInterruption('My teacher inspire me').detected).toBe(false)
  })
})

// ── 7. Regression: clarification detection still works ───────────────────────

describe('Phase 7.5 — Regression: phrase question detection intact', () => {
  it('"how to say смішний фільм" still detected as phrase question', () => {
    expect(detectPhraseQuestion('how to say смішний фільм')).toBe(true)
  })
  it('"what means competitive" still detected as phrase question', () => {
    expect(detectPhraseQuestion('what means competitive')).toBe(true)
  })
  it('"I watching funny movie" is NOT a phrase question', () => {
    expect(detectPhraseQuestion('I watching funny movie')).toBe(false)
  })
  it('"My teacher inspire me" is NOT a phrase question', () => {
    expect(detectPhraseQuestion('My teacher inspire me')).toBe(false)
  })
  it('"I go America and watch Mr Beast" is NOT a phrase question', () => {
    expect(detectPhraseQuestion('I go America and watch Mr Beast')).toBe(false)
  })
})

// ── 8. Regression: step not advanced on pure filler ──────────────────────────

describe('Phase 7.5 — Regression: filler / off-task still rejected by validator', () => {
  const BASE_INPUT = {
    exerciseId: 'ex-test',
    exerciseNumber: 1,
    exerciseType: 'soft_speaking',
    instruction: 'Tell me who inspires you and why.',
    itemText: '',
    minWords: 2,
  }

  it('"ok" (pure filler) does not allow progression at attempt 0', () => {
    const result = validateSoftSpeakingAnswer({
      ...BASE_INPUT,
      studentTranscript: 'ok',
      attemptCount: 0,
    })
    expect(result.allowProgression).toBe(false)
  })

  it('"yes" (pure filler) does not allow progression at attempt 0', () => {
    const result = validateSoftSpeakingAnswer({
      ...BASE_INPUT,
      studentTranscript: 'yes',
      attemptCount: 0,
    })
    expect(result.allowProgression).toBe(false)
  })
})
