import { describe, expect, it } from 'vitest'

import {
  classifyVoiceTranscript,
  normalizeTranscriptToExpectedAnswer,
} from '../voice-turn-stabilizer.js'

describe('paid lesson expected-answer transcript cleanup', () => {
  it('keeps a clean expected answer unchanged', () => {
    const result = normalizeTranscriptToExpectedAnswer('Hobby.', ['hobby'])
    expect(result?.text).toBe('hobby')
    expect(result?.reason).toBe('exact_expected_answer')
  })

  it('uses the final expected answer when the student self-corrects in one turn', () => {
    const result = normalizeTranscriptToExpectedAnswer('Harvey. Hobby.', ['hobby'])
    expect(result?.text).toBe('hobby')
    expect(result?.reason).toBe('sentence_final_expected_answer')
  })

  it('uses the current expected answer instead of a previous-item phrase', () => {
    const result = normalizeTranscriptToExpectedAnswer('Get fit. Free time.', ['free time'])
    expect(result?.text).toBe('free time')
    expect(result?.reason).toBe('sentence_final_expected_answer')
  })

  it('uses the current expected answer when short STT noise follows it', () => {
    const result = normalizeTranscriptToExpectedAnswer('Free time. Weekend.', ['free time'])
    expect(result?.text).toBe('free time')
    expect(result?.reason).toBe('sentence_any_expected_answer')
  })

  it('uses the current expected answer when a previous answer precedes it', () => {
    const result = normalizeTranscriptToExpectedAnswer('Spare time. Free time.', ['free time'])
    expect(result?.text).toBe('free time')
    expect(result?.reason).toBe('sentence_final_expected_answer')
  })

  it('recovers expected answer phrases from noisy speech-verb tails', () => {
    const result = normalizeTranscriptToExpectedAnswer("On. K nine. I won't say keen on.", ['keen on'])
    expect(result?.text).toBe('keen on')
    expect(result?.reason).toBe('answer_phrase_tail')
  })

  it('does not strip meaningful negation without a speech-verb tail', () => {
    expect(normalizeTranscriptToExpectedAnswer('not keen on', ['keen on'])).toBeNull()
  })
})

describe('voice transcript classifier still accepts short textbook answers', () => {
  it('accepts one-word fill-gap answers', () => {
    const result = classifyVoiceTranscript('Hobby.', 'fill_gap')
    expect(result.usable).toBe(true)
    expect(result.normalizedText).toBe('Hobby.')
  })
})
