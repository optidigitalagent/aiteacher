/**
 * Kids STT Config Parity Tests
 *
 * Verifies that Kids and adult Deepgram configs are correctly differentiated:
 * - Kids use shorter utterance_end_ms for faster finalization of single words
 * - Both use identical audio format (encoding, sample_rate, channels)
 * - Adult config is not changed by Kids config
 */

import { describe, it, expect } from 'vitest'
import { DEEPGRAM_LIVE_OPTIONS, DEEPGRAM_KIDS_LIVE_OPTIONS } from '../stt.js'

describe('Kids vs Adult STT config parity', () => {

  it('Kids utterance_end_ms is shorter than adult (700 < 1500)', () => {
    expect(DEEPGRAM_KIDS_LIVE_OPTIONS.utterance_end_ms).toBe(700)
    expect(DEEPGRAM_LIVE_OPTIONS.utterance_end_ms).toBe(1500)
    expect(DEEPGRAM_KIDS_LIVE_OPTIONS.utterance_end_ms).toBeLessThan(DEEPGRAM_LIVE_OPTIONS.utterance_end_ms!)
  })

  it('Both configs share identical audio format', () => {
    expect(DEEPGRAM_KIDS_LIVE_OPTIONS.encoding).toBe(DEEPGRAM_LIVE_OPTIONS.encoding)
    expect(DEEPGRAM_KIDS_LIVE_OPTIONS.sample_rate).toBe(DEEPGRAM_LIVE_OPTIONS.sample_rate)
    expect(DEEPGRAM_KIDS_LIVE_OPTIONS.channels).toBe(DEEPGRAM_LIVE_OPTIONS.channels)
  })

  it('Both configs use nova-2 model', () => {
    expect(DEEPGRAM_KIDS_LIVE_OPTIONS.model).toBe('nova-2')
    expect(DEEPGRAM_LIVE_OPTIONS.model).toBe('nova-2')
  })

  it('Both configs use explicit language=en', () => {
    expect(DEEPGRAM_KIDS_LIVE_OPTIONS.language).toBe('en')
    expect(DEEPGRAM_LIVE_OPTIONS.language).toBe('en')
  })

  it('Adult utterance_end_ms unchanged at 1500ms', () => {
    expect(DEEPGRAM_LIVE_OPTIONS.utterance_end_ms).toBe(1500)
  })

  it('Kids config has endpointing=300 (same as adult)', () => {
    expect(DEEPGRAM_KIDS_LIVE_OPTIONS.endpointing).toBe(300)
  })

  it('Kids config has interim_results=true', () => {
    expect(DEEPGRAM_KIDS_LIVE_OPTIONS.interim_results).toBe(true)
  })

  it('Neither config has detect_language (PrerecordedSchema-only, causes HTTP 400)', () => {
    expect(Object.prototype.hasOwnProperty.call(DEEPGRAM_KIDS_LIVE_OPTIONS, 'detect_language')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(DEEPGRAM_LIVE_OPTIONS, 'detect_language')).toBe(false)
  })
})
