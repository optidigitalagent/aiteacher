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

  it('recovers the expected answer from a short readiness/filler tail', () => {
    const result = normalizeTranscriptToExpectedAnswer("I'm ready. Hold Hobby.", ['hobby'])
    expect(result?.text).toBe('hobby')
    expect(result?.reason).toBe('readiness_expected_answer_tail')
  })

  it('keeps readiness cleanup bounded to filler words before the answer', () => {
    expect(normalizeTranscriptToExpectedAnswer('My hobby', ['hobby'])).toBeNull()
  })

  it('maps a narrow phonetic alias only for the current expected answer', () => {
    const result = normalizeTranscriptToExpectedAnswer('Get it.', ['get fit'])
    expect(result?.text).toBe('get fit')
    expect(result?.reason).toBe('phonetic_expected_answer_alias')
  })

  it('does not treat the phonetic alias as a generic answer', () => {
    expect(normalizeTranscriptToExpectedAnswer('Get it.', ['free time'])).toBeNull()
  })

  it('recovers expected answer phrases from noisy speech-verb tails', () => {
    const result = normalizeTranscriptToExpectedAnswer("On. K nine. I won't say keen on.", ['keen on'])
    expect(result?.text).toBe('keen on')
    expect(result?.reason).toBe('answer_phrase_tail')
  })

  it('does not strip meaningful negation without a speech-verb tail', () => {
    expect(normalizeTranscriptToExpectedAnswer('not keen on', ['keen on'])).toBeNull()
  })

  it('accepts a full expected phrase repeated two or three times', () => {
    const twice = normalizeTranscriptToExpectedAnswer('Keen on, keen on.', ['keen on'])
    const three = normalizeTranscriptToExpectedAnswer('keen on keen on keen on', ['keen on'])

    expect(twice?.text).toBe('keen on')
    expect(twice?.reason).toBe('repeated_expected_answer_phrase')
    expect(three?.text).toBe('keen on')
    expect(three?.reason).toBe('repeated_expected_answer_phrase')
  })

  it('does not accept repeated phrase cleanup for unrelated current answers', () => {
    expect(normalizeTranscriptToExpectedAnswer('keen on keen on', ['spare time'])).toBeNull()
  })

  it('uses the current expected answer when the student self-corrects without punctuation', () => {
    const result = normalizeTranscriptToExpectedAnswer('Like keen on', ['keen on'])
    expect(result?.text).toBe('keen on')
    expect(result?.reason).toBe('self_corrected_to_expected_answer_tail')
  })

  it('accepts a short mixed answer list when one phrase is the current expected answer', () => {
    const first = normalizeTranscriptToExpectedAnswer('hobby spare time', ['hobby'])
    const second = normalizeTranscriptToExpectedAnswer('keen on like', ['keen on'])

    expect(first?.text).toBe('hobby')
    expect(first?.reason).toBe('short_answer_list_contains_expected')
    expect(second?.text).toBe('keen on')
    expect(second?.reason).toBe('short_answer_list_contains_expected')
  })

  it('does not treat a negated tail as self-correction', () => {
    expect(normalizeTranscriptToExpectedAnswer('not keen on', ['keen on'])).toBeNull()
    expect(normalizeTranscriptToExpectedAnswer('I am not keen on', ['keen on'])).toBeNull()
  })

  it('does not accept negated or possessive mixed answer lists', () => {
    expect(normalizeTranscriptToExpectedAnswer('not keen on like', ['keen on'])).toBeNull()
    expect(normalizeTranscriptToExpectedAnswer('my hobby spare time', ['hobby'])).toBeNull()
  })
})

describe('voice transcript classifier still accepts short textbook answers', () => {
  it('accepts one-word fill-gap answers', () => {
    const result = classifyVoiceTranscript('Hobby.', 'fill_gap')
    expect(result.usable).toBe(true)
    expect(result.normalizedText).toBe('Hobby.')
  })
})
