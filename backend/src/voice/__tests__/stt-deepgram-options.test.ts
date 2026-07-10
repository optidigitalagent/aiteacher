// Verifies the Deepgram Live API options built in stt.ts are valid for
// the streaming endpoint. detect_language is a PrerecordedSchema-only field
// and causes HTTP 400 when sent to wss://api.deepgram.com/v1/listen.
// See: https://developers.deepgram.com/docs/language-detection

import { describe, it, expect } from 'vitest'
import { DEEPGRAM_LIVE_OPTIONS, DEEPGRAM_KIDS_LIVE_OPTIONS } from '../stt.js'

describe('DEEPGRAM_LIVE_OPTIONS — Live API parameter contract', () => {
  // ── Required parameters that must be preserved ────────────────────────────

  it('encoding is linear16', () => {
    expect(DEEPGRAM_LIVE_OPTIONS.encoding).toBe('linear16')
  })

  it('sample_rate is 16000', () => {
    expect(DEEPGRAM_LIVE_OPTIONS.sample_rate).toBe(16000)
  })

  it('channels is 1', () => {
    expect(DEEPGRAM_LIVE_OPTIONS.channels).toBe(1)
  })

  it('interim_results is true', () => {
    expect(DEEPGRAM_LIVE_OPTIONS.interim_results).toBe(true)
  })

  it('endpointing is 300', () => {
    expect(DEEPGRAM_LIVE_OPTIONS.endpointing).toBe(300)
  })

  it('utterance_end_ms is 1500', () => {
    expect(DEEPGRAM_LIVE_OPTIONS.utterance_end_ms).toBe(1500)
  })

  it('adult model is multilingual-capable by default', () => {
    expect(DEEPGRAM_LIVE_OPTIONS.model).toBe('nova-3')
  })

  // ── Fix verification — detect_language must be absent ─────────────────────
  // detect_language belongs to PrerecordedSchema, not LiveSchema.
  // Sending it to the Live streaming endpoint returns HTTP 400.

  it('does NOT contain detect_language (PrerecordedSchema-only field causes 400)', () => {
    expect(Object.prototype.hasOwnProperty.call(DEEPGRAM_LIVE_OPTIONS, 'detect_language')).toBe(false)
  })

  // ── Explicit language replaces detect_language ────────────────────────────

  it('has explicit language=multi for adult RU/UA/EN turns', () => {
    expect(DEEPGRAM_LIVE_OPTIONS.language).toBe('multi')
  })

  // ── All required keys present ─────────────────────────────────────────────

  it('contains all required Live API parameters', () => {
    const required = [
      'model', 'language', 'smart_format', 'interim_results',
      'endpointing', 'utterance_end_ms', 'encoding', 'sample_rate', 'channels',
    ] as const
    for (const key of required) {
      expect(DEEPGRAM_LIVE_OPTIONS).toHaveProperty(key)
    }
  })

  // ── No unexpected batch-only fields ──────────────────────────────────────

  it('does NOT contain batch-only fields (detect_entities, utterances, paragraphs)', () => {
    const batchOnly = ['detect_entities', 'utterances', 'paragraphs', 'detect_topics']
    for (const key of batchOnly) {
      expect(Object.prototype.hasOwnProperty.call(DEEPGRAM_LIVE_OPTIONS, key)).toBe(false)
    }
  })
})

// ── utterance_end_ms minimum constraint (HTTP 400 guard) ─────────────────────
// Deepgram requires utterance_end_ms >= 1000ms. Values below 1000 cause HTTP 400
// before WebSocket Open. This was the root cause of Kids STT connection failures.
// See: https://developers.deepgram.com/docs/understanding-end-of-speech-detection

describe('utterance_end_ms minimum constraint — HTTP 400 guard', () => {

  it('adult utterance_end_ms is >= 1000 (Deepgram minimum)', () => {
    expect(DEEPGRAM_LIVE_OPTIONS.utterance_end_ms).toBeGreaterThanOrEqual(1000)
  })

  it('Kids utterance_end_ms is >= 1000 (Deepgram minimum — P0 fix: was 700, caused HTTP 400)', () => {
    expect(DEEPGRAM_KIDS_LIVE_OPTIONS.utterance_end_ms).toBeGreaterThanOrEqual(1000)
  })

  it('Kids utterance_end_ms (1000) is still faster than adult (1500)', () => {
    expect(DEEPGRAM_KIDS_LIVE_OPTIONS.utterance_end_ms).toBeLessThan(DEEPGRAM_LIVE_OPTIONS.utterance_end_ms!)
  })
})
