// Voice turn transcript stabilizer.
// Runs BEFORE engine/orchestrator submission to validate STT quality.

export type TranscriptKind = 'answer' | 'question' | 'noise' | 'too_short' | 'repeat'

export interface VoiceTranscriptClassification {
  usable: boolean
  kind: TranscriptKind
  normalizedText: string
  reason: string
}

// Exercise types where a single word or short phrase is a valid answer.
const SHORT_ANSWER_EXERCISE_TYPES = new Set([
  'fill_gap',
  'gapped_text',
  'multiple_choice',
  'matching',
  'vocabulary_matching',
  'collocations',
  'find_opposites',
  'reconstruction',
  'form_transformation',
  'grammar_transform',
  'error_correction',
  'phrase_classification',
  'find_in_text',
  'read_and_write_names',
  'remember_this',
])

const QUESTION_INTENT_RE = [
  /^(why|what|how|when|where|who|which)\b/i,
  /\?$/,
  /\b(don'?t understand|confused|what do you mean|not sure|what should|i'?m lost)\b/i,
]

function isQuestionIntent(text: string): boolean {
  return QUESTION_INTENT_RE.some(p => p.test(text.trim()))
}

function normalizeToken(word: string): string {
  return word.toLowerCase().replace(/[.!?,;:'''"]+$/, '').trim()
}

// Remove CONSECUTIVE duplicate tokens from a transcript string.
// "View. View. View. Will." → "View. Will."
// "What what what's me me me" → "What what's me"
// Does NOT remove non-consecutive repetition ("I will. I will buy.").
export function deduplicateConsecutiveTokens(text: string): string {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const result: string[] = []
  let prevNorm = ''
  for (const word of words) {
    const norm = normalizeToken(word)
    if (norm && norm === prevNorm) continue  // skip consecutive duplicate
    result.push(word)
    if (norm) prevNorm = norm
  }
  return result.join(' ')
}

// Count how many tokens were removed as consecutive duplicates.
function consecutiveDupRatio(text: string): number {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return 0
  let removed = 0
  let prevNorm = ''
  for (const word of words) {
    const norm = normalizeToken(word)
    if (norm && norm === prevNorm) removed++
    else if (norm) prevNorm = norm
  }
  return removed / words.length
}

// Classify a raw STT transcript before submitting to the exercise engine.
// exerciseType is optional — if provided, enables short-answer tolerance for specific types.
export function classifyVoiceTranscript(
  raw: string,
  exerciseType?: string,
): VoiceTranscriptClassification {
  const text = raw.trim()

  if (!text) {
    return { usable: false, kind: 'noise', normalizedText: '', reason: 'empty' }
  }

  // Basic letter-content check — catches pure punctuation/symbol noise
  const letters = (text.match(/[a-zA-Z]/g) ?? []).length
  if (letters === 0) {
    return { usable: false, kind: 'noise', normalizedText: '', reason: 'no_letters' }
  }
  if (text.length > 3 && letters / text.length < 0.30) {
    return { usable: false, kind: 'noise', normalizedText: '', reason: 'low_letter_ratio' }
  }

  // Consecutive duplicate ratio — detect Deepgram repetition artifact
  const dupRatio = consecutiveDupRatio(text)
  const deduped   = deduplicateConsecutiveTokens(text)
  const dedupedTrimmed = deduped.trim()

  if (dupRatio > 0.50) {
    // More than half the tokens are consecutive duplicates — strong repetition artifact
    const dedupedWords = dedupedTrimmed.split(/\s+/).filter(Boolean)
    if (dedupedWords.length < 2) {
      // Nothing useful survives dedup
      return { usable: false, kind: 'repeat', normalizedText: '', reason: 'heavy_repetition_unsalvageable' }
    }
    // Some content survives — submit it so teacher can handle gracefully
    return {
      usable: true,
      kind:   'repeat',
      normalizedText: dedupedTrimmed,
      reason: `deduped_heavy_repetition pct=${Math.round(dupRatio * 100)}`,
    }
  }

  // Use deduped text for remaining checks
  const finalText = dedupedTrimmed || text
  if (!finalText) {
    return { usable: false, kind: 'noise', normalizedText: '', reason: 'empty_after_dedup' }
  }

  // Question intent — always usable regardless of length
  if (isQuestionIntent(finalText)) {
    return { usable: true, kind: 'question', normalizedText: finalText, reason: 'question_intent' }
  }

  // Length validation
  const words = finalText.split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return { usable: false, kind: 'too_short', normalizedText: '', reason: 'no_words' }
  }

  if (words.length === 1) {
    const word = words[0]!.toLowerCase().replace(/[^a-z]/g, '')
    // MCQ single-letter answer (a/b/c/d) — always valid
    if (/^[a-d]$/.test(word)) {
      return { usable: true, kind: 'answer', normalizedText: finalText, reason: 'mcq_letter' }
    }
    // Short-answer exercise types accept any single word
    if (exerciseType && SHORT_ANSWER_EXERCISE_TYPES.has(exerciseType)) {
      return { usable: true, kind: 'answer', normalizedText: finalText, reason: 'single_word_valid_exercise_type' }
    }
    // Unknown exercise type — allow; teacher/engine will validate
    return { usable: true, kind: 'answer', normalizedText: finalText, reason: 'single_word_allowed' }
  }

  // 2+ words — generally usable
  return { usable: true, kind: 'answer', normalizedText: finalText, reason: 'normal' }
}
