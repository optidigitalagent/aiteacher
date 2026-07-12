import { describe, expect, it } from 'vitest'
import { sanitizeTeacherTextForTts } from '../tts-text.js'

describe('teacher TTS text sanitizer', () => {
  it('removes gap-fill underscores without revealing or saying the missing word', () => {
    expect(sanitizeTeacherTextForTts('Number 1: My ___ is photography.')).toBe('Number 1: My is photography.')
    expect(sanitizeTeacherTextForTts('What do you do in your ___?')).toBe('What do you do in your?')
    expect(sanitizeTeacherTextForTts('I joined a gym to ___.')).toBe('I joined a gym to.')
  })
})
