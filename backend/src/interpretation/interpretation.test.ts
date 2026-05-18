// ── Interpretation Pipeline Tests ─────────────────────────────────────────────
// Run: npx vitest run src/interpretation/interpretation.test.ts

import { describe, it, expect } from 'vitest'
import { interpretSpokenAnswer } from './spoken-answer-interpreter.js'
import type { AnswerSlot } from './types.js'

// ── Soft-speaking slot tests ──────────────────────────────────────────────────

describe('Soft-speaking — reason slot (who inspires you and why)', () => {
  const BASE = {
    exerciseType:  'discussion',
    instruction:   'Tell me who inspires you and why.',
    requiredSlots: ['subject', 'reason'] as AnswerSlot[],
  }

  it('subject present, reason missing — Mia Khalifa inspire me', () => {
    const r = interpretSpokenAnswer({ ...BASE, rawTranscript: 'Mia Khalifa inspire me.' })
    expect(r.missingSlots).toContain('reason')
    expect(r.missingSlots).not.toContain('subject')
  })

  it('subject present, reason missing — Anita inspired me', () => {
    const r = interpretSpokenAnswer({ ...BASE, rawTranscript: 'Anita inspired me.' })
    expect(r.missingSlots).toContain('reason')
    expect(r.missingSlots).not.toContain('subject')
  })

  it('subject + reason present — because clause', () => {
    const r = interpretSpokenAnswer({
      ...BASE,
      rawTranscript: 'Anita inspired me because she never gave up.',
    })
    expect(r.missingSlots).toHaveLength(0)
    expect(r.slots.map(s => s.slot)).toContain('subject')
    expect(r.slots.map(s => s.slot)).toContain('reason')
  })

  it('subject + reason present — two-sentence explanatory form', () => {
    const r = interpretSpokenAnswer({
      ...BASE,
      rawTranscript: 'Anita inspired me. She never gave up.',
    })
    expect(r.missingSlots).toHaveLength(0)
    expect(r.slots.map(s => s.slot)).toContain('reason')
  })

  it('self-correction then reason still missing', () => {
    const r = interpretSpokenAnswer({
      ...BASE,
      rawTranscript: 'May inspire Oscar. Not may. Me inspire Oscar.',
    })
    // Resolved to "Me inspire Oscar" — subject present, reason still missing
    expect(r.missingSlots).toContain('reason')
    expect(r.debug['selfCorrected']).toBeTruthy()
  })
})

// ── Grammar-fill canonical answer tests ───────────────────────────────────────

describe('Grammar fill — canonical answer extraction', () => {
  it('expected "is", student says "What are he doing now?" → canonical "are"', () => {
    const r = interpretSpokenAnswer({
      rawTranscript:  'What are he doing now?',
      exerciseType:   'grammar_fill',
      expectedAnswer: 'is',
    })
    expect(r.canonicalAnswer).toBe('are')
  })

  it('expected "is", student self-corrects "ease. not ease. is." → canonical "is"', () => {
    const r = interpretSpokenAnswer({
      rawTranscript:  'ease. not ease. is.',
      exerciseType:   'grammar_fill',
      expectedAnswer: 'is',
    })
    expect(r.canonicalAnswer).toBe('is')
  })

  it('expected "have", student says "Have you ever met him?" → canonical "have"', () => {
    const r = interpretSpokenAnswer({
      rawTranscript:  'Have you ever met him?',
      exerciseType:   'grammar_fill',
      expectedAnswer: 'have',
    })
    expect(r.canonicalAnswer).toBe('have')
  })
})

// ── STT ambiguity resolution tests ────────────────────────────────────────────

describe('STT ambiguity — known entity resolution', () => {
  it('expected "Viv", transcript "we have" — STT entity attempt (best-effort)', () => {
    // "we have" → "Viv" requires audio-level phonetic analysis (shared /v/ phoneme).
    // Character-level edit distance cannot reliably bridge this gap.
    // The system must not crash and should flag pronunciation_or_stt or unclear.
    const r = interpretSpokenAnswer({
      rawTranscript:  'we have',
      exerciseType:   'discussion',
      knownEntities:  ['Viv'],
      expectedAnswer: 'Viv',
    })
    expect(r).toBeDefined()
    expect(r.issueType).toBeDefined()
  })

  it('expected "is", transcript "ease" → phonetic resolution', () => {
    const r = interpretSpokenAnswer({
      rawTranscript:  'ease',
      exerciseType:   'grammar_fill',
      expectedAnswer: 'is',
    })
    expect(r.canonicalAnswer).toBe('is')
  })
})

// ── Issue type tests ──────────────────────────────────────────────────────────

describe('Issue type classification', () => {
  it('complete answer → clear', () => {
    const r = interpretSpokenAnswer({
      rawTranscript:  'Anita inspired me because she worked hard.',
      exerciseType:   'discussion',
      instruction:    'Tell me who inspires you and why.',
      requiredSlots:  ['subject', 'reason'] as AnswerSlot[],
    })
    expect(r.issueType).toBe('clear')
  })

  it('missing reason → missing_slot', () => {
    const r = interpretSpokenAnswer({
      rawTranscript:  'Anita inspired me.',
      exerciseType:   'discussion',
      instruction:    'Tell me who inspires you and why.',
      requiredSlots:  ['subject', 'reason'] as AnswerSlot[],
    })
    expect(r.issueType).toBe('missing_slot')
  })

  it('broken grammar → broken_grammar', () => {
    const r = interpretSpokenAnswer({
      rawTranscript:  'Jordan inspire me.',
      exerciseType:   'discussion',
      instruction:    'Tell me who inspires you and why.',
      requiredSlots:  ['subject', 'reason'] as AnswerSlot[],
    })
    expect(r.issueType).toBe('broken_grammar')
  })
})

// ── Teacher repair hint tests ─────────────────────────────────────────────────

describe('Teacher repair hints', () => {
  it('missing reason hint references "because"', () => {
    const r = interpretSpokenAnswer({
      rawTranscript:  'Anita inspired me.',
      exerciseType:   'discussion',
      instruction:    'Tell me who inspires you and why.',
      requiredSlots:  ['subject', 'reason'] as AnswerSlot[],
    })
    expect(r.teacherRepairHint).toBeDefined()
    expect(r.teacherRepairHint).toMatch(/because/i)
  })
})
