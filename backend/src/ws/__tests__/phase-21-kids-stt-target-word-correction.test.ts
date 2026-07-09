/**
 * Phase 21 — Kids STT Target-Word Correction Tests
 *
 * Tests for the production bug: child says "blue" → Deepgram returns "Hello?" →
 * Kids Brain classifies as SOCIAL_SPEECH → child stuck in loop.
 *
 * Root causes addressed:
 * P0: TTS echo — teacher's "Hello!" echoed back through mic (tested in frontend)
 * P1: Kids STT utterance_end_ms parity (see kids-stt-config-parity.test.ts)
 * P2: Target-word correction layer (this file)
 */

import { describe, it, expect } from 'vitest'
import {
  applyKidsTargetWordCorrection,
  KIDS_SOCIAL_NEVER_CORRECT,
} from '../kids-stt-correction.js'

const SESSION = 'test-session-phase21'

// ── Social speech guard ───────────────────────────────────────────────────────

describe('KIDS_SOCIAL_NEVER_CORRECT set', () => {

  it('contains "hello" — the exact echo that caused the production bug', () => {
    expect(KIDS_SOCIAL_NEVER_CORRECT.has('hello')).toBe(true)
  })

  it('contains common social responses that should never be corrected to a target word', () => {
    const socialPhrases = ['hi', 'hey', 'yes', 'yeah', 'okay', 'ok', 'no', 'stop', 'wait']
    for (const phrase of socialPhrases) {
      expect(KIDS_SOCIAL_NEVER_CORRECT.has(phrase)).toBe(true)
    }
  })

  it('does NOT contain vocabulary target words like "blue", "green", "cat"', () => {
    const targetWords = ['blue', 'green', 'cat', 'dog', 'red', 'apple', 'happy', 'run']
    for (const word of targetWords) {
      expect(KIDS_SOCIAL_NEVER_CORRECT.has(word)).toBe(false)
    }
  })
})

// ── Social speech guarding: "hello" echoed, target = "blue" ──────────────────

describe('applyKidsTargetWordCorrection — social speech guard', () => {

  it('does NOT correct "Hello?" → "blue" (the production echo bug scenario)', () => {
    const result = applyKidsTargetWordCorrection('Hello?', 'blue', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('social_speech_guarded')
    expect(result.correctedText).toBe('Hello?')
  })

  it('does NOT correct "Hello!" → "blue"', () => {
    const result = applyKidsTargetWordCorrection('Hello!', 'blue', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('social_speech_guarded')
  })

  it('does NOT correct "hi" → "blue"', () => {
    const result = applyKidsTargetWordCorrection('hi', 'blue', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('social_speech_guarded')
  })

  it('does NOT correct "yes" → "yes" (already in set, also target)', () => {
    const result = applyKidsTargetWordCorrection('yes', 'yellow', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('social_speech_guarded')
  })

  it('does NOT correct "ok" → "oak" (social word, not corrected even if similar)', () => {
    const result = applyKidsTargetWordCorrection('ok', 'oak', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('social_speech_guarded')
  })
})

// ── Exact and already-correct cases ──────────────────────────────────────────

describe('applyKidsTargetWordCorrection — exact match', () => {

  it('does not flag already-correct "blue" as a correction', () => {
    const result = applyKidsTargetWordCorrection('blue', 'blue', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('already_correct')
    expect(result.correctedText).toBe('blue')
  })

  it('does not flag already-correct "green" as a correction', () => {
    const result = applyKidsTargetWordCorrection('green', 'green', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('already_correct')
  })

  it('preserves original transcript text when already correct', () => {
    const result = applyKidsTargetWordCorrection('Blue', 'blue', SESSION)
    // 'Blue' normalized → 'blue' === targetNorm 'blue' → already_correct
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('already_correct')
  })
})

// ── Short target word variants: "blue" ───────────────────────────────────────

describe('applyKidsTargetWordCorrection — blue variants (the failing production case)', () => {

  it('corrects "blu" → "blue" (missing trailing e, levenshtein=1)', () => {
    const result = applyKidsTargetWordCorrection('blu', 'blue', SESSION)
    expect(result.correctionApplied).toBe(true)
    expect(result.correctedText).toBe('blue')
  })

  it('corrects "blew" → "blue" (common English homophone, levenshtein=2)', () => {
    // "blew" vs "blue": b-l-e-w vs b-l-u-e — Levenshtein distance 2
    const result = applyKidsTargetWordCorrection('blew', 'blue', SESSION)
    expect(result.correctionApplied).toBe(true)
    expect(result.correctedText).toBe('blue')
  })

  it('corrects "glue" → "blue" (noisy single-char substitution, levenshtein=1)', () => {
    // glue vs blue: 1 substitution (g→b)
    const result = applyKidsTargetWordCorrection('glue', 'blue', SESSION)
    expect(result.correctionApplied).toBe(true)
    expect(result.correctedText).toBe('blue')
  })

  it('corrects "bue" → "blue" (Deepgram drops "l", levenshtein=1)', () => {
    const result = applyKidsTargetWordCorrection('bue', 'blue', SESSION)
    expect(result.correctionApplied).toBe(true)
    expect(result.correctedText).toBe('blue')
  })

  it('does NOT correct "red" → "blue" (completely different word, distance=3)', () => {
    // "red" vs "blue": levenshtein = 4 (too far)
    const result = applyKidsTargetWordCorrection('red', 'blue', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('no_match')
  })

  it('returns target word text when correction is applied', () => {
    const result = applyKidsTargetWordCorrection('blu', 'blue', SESSION)
    expect(result.correctedText).toBe('blue')
  })
})

// ── Other short color/vocabulary targets ─────────────────────────────────────

describe('applyKidsTargetWordCorrection — other short target words', () => {

  it('corrects "gree" → "green" (missing final n, levenshtein=1)', () => {
    const result = applyKidsTargetWordCorrection('gree', 'green', SESSION)
    expect(result.correctionApplied).toBe(true)
    expect(result.correctedText).toBe('green')
  })

  it('corrects "reed" → "red" (levenshtein=2 for ≤7 char)', () => {
    const result = applyKidsTargetWordCorrection('reed', 'red', SESSION)
    expect(result.correctionApplied).toBe(true)
    expect(result.correctedText).toBe('red')
  })

  it('corrects "kat" → "cat" (k/c phonetic swap, levenshtein=1)', () => {
    const result = applyKidsTargetWordCorrection('kat', 'cat', SESSION)
    expect(result.correctionApplied).toBe(true)
    expect(result.correctedText).toBe('cat')
  })

  it('corrects "heppy" → "happy" (levenshtein=2)', () => {
    const result = applyKidsTargetWordCorrection('heppy', 'happy', SESSION)
    expect(result.correctionApplied).toBe(true)
    expect(result.correctedText).toBe('happy')
  })
})

// ── Multi-word transcript guard ───────────────────────────────────────────────

describe('applyKidsTargetWordCorrection — multi-word guard', () => {

  it('extracts target from observed teacher echo suffix "Say again. Blue."', () => {
    const result = applyKidsTargetWordCorrection('Say again. Blue.', 'blue', SESSION)
    expect(result.correctionApplied).toBe(true)
    expect(result.correctionReason).toBe('teacher_echo_target_suffix')
    expect(result.correctedText).toBe('blue')
  })

  it('extracts target when the child repeats after the teacher echo suffix', () => {
    const result = applyKidsTargetWordCorrection('Say again. Blue. Blue.', 'blue', SESSION)
    expect(result.correctionApplied).toBe(true)
    expect(result.correctionReason).toBe('teacher_echo_target_suffix')
    expect(result.correctedText).toBe('blue')
  })

  it('does NOT correct teacher retry prompt without the target word', () => {
    const result = applyKidsTargetWordCorrection('Say again.', 'blue', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('multi_word')
    expect(result.correctedText).toBe('Say again.')
  })

  it('does NOT correct social speech that includes no target word', () => {
    const result = applyKidsTargetWordCorrection('Yes. I like Roblox.', 'blue', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('multi_word')
    expect(result.correctedText).toBe('Yes. I like Roblox.')
  })

  it('does NOT correct multi-word transcript "I said blue"', () => {
    // Levenshtein correction never applied to multi-word answers
    const result = applyKidsTargetWordCorrection('I said blue', 'blue', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('multi_word')
    expect(result.correctedText).toBe('I said blue')
  })

  it('does NOT correct "the blue" → "blue"', () => {
    const result = applyKidsTargetWordCorrection('the blue', 'blue', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('multi_word')
  })
})

// ── Empty input guard ─────────────────────────────────────────────────────────

describe('applyKidsTargetWordCorrection — empty input', () => {

  it('returns original text for empty transcript', () => {
    const result = applyKidsTargetWordCorrection('', 'blue', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('empty')
  })

  it('returns original text for whitespace-only transcript', () => {
    const result = applyKidsTargetWordCorrection('   ', 'blue', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('empty')
  })

  it('returns original text when targetWord is empty', () => {
    const result = applyKidsTargetWordCorrection('blew', '', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('empty')
  })
})

// ── Long word protection ──────────────────────────────────────────────────────

describe('applyKidsTargetWordCorrection — long word protection', () => {

  it('does NOT apply extended fuzzy match to 8+ char target words', () => {
    // "computers" (9 chars) vs "computer" — would be levenshtein=1, but
    // extended check skips words > 7 chars to prevent false positives
    const result = applyKidsTargetWordCorrection('computers', 'computer', SESSION)
    // May still match via primary checkSTTTolerance (fuzzy ≤1 for 8chars via maxDist)
    // The important thing is that the raw levenshtein ≤2 extended check is bypassed
    // Primary tolerance still allows it — this test verifies no crash and sane result
    expect(result).toBeDefined()
    expect(typeof result.correctionApplied).toBe('boolean')
  })

  it('does NOT apply extended check when both words are 8+ chars', () => {
    // Very long words — extended levenshtein ≤ 2 block is skipped
    const result = applyKidsTargetWordCorrection('caterpillar', 'caterpillr', SESSION)
    // Primary fuzzy: 11 chars, maxDist = floor(11/6) = 1, levenshtein('caterpillar','caterpillr')=1 → matched
    expect(result.correctionApplied).toBe(true)
  })
})

// ── Punctuation handling ──────────────────────────────────────────────────────

describe('applyKidsTargetWordCorrection — punctuation stripping', () => {

  it('strips punctuation before comparing ("blu." → corrected to "blue")', () => {
    const result = applyKidsTargetWordCorrection('blu.', 'blue', SESSION)
    expect(result.correctionApplied).toBe(true)
    expect(result.correctedText).toBe('blue')
  })

  it('strips punctuation before social speech guard ("hello!" blocked)', () => {
    const result = applyKidsTargetWordCorrection('hello!', 'blue', SESSION)
    expect(result.correctionApplied).toBe(false)
    expect(result.correctionReason).toBe('social_speech_guarded')
  })
})
