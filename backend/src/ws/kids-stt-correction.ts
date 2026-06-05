// Kids target-word STT correction module
// Applied only in Kids target-answer context (kidsBrainV1Active + known target word).
// Conservative rules: never corrects social speech or multi-word transcripts.

import { checkSTTTolerance } from '../validation/stt-tolerance.js'
import { levenshtein } from '../validation/stt-tolerance.js'

// Phrases signaling social/off-topic speech that must never be corrected to target.
export const KIDS_SOCIAL_NEVER_CORRECT: ReadonlySet<string> = new Set([
  'hello', 'hi', 'hey', 'great', 'wow', 'cool', 'nice', 'awesome', 'yay',
  'yes', 'yeah', 'yep', 'okay', 'ok', 'sure', 'wait', 'what', 'huh',
  'no', 'stop', 'help',
])

export interface KidsTargetWordCorrectionResult {
  correctedText: string
  correctionApplied: boolean
  correctionReason: string
}

export function applyKidsTargetWordCorrection(
  rawTranscript: string,
  targetWord: string,
  sessionId: string,
): KidsTargetWordCorrectionResult {
  // Check for multiple words before stripping spaces (regex strips spaces along with punctuation)
  const rawTrimmedLower = rawTranscript.trim().toLowerCase()
  if (rawTrimmedLower.includes(' ')) {
    return { correctedText: rawTranscript, correctionApplied: false, correctionReason: 'multi_word' }
  }

  const rawNorm    = rawTrimmedLower.replace(/[^a-z]/g, '')
  const targetNorm = targetWord.trim().toLowerCase()

  if (!rawNorm || !targetNorm) {
    return { correctedText: rawTranscript, correctionApplied: false, correctionReason: 'empty' }
  }

  // Guard: never correct known social speech phrases
  if (KIDS_SOCIAL_NEVER_CORRECT.has(rawNorm)) {
    return { correctedText: rawTranscript, correctionApplied: false, correctionReason: 'social_speech_guarded' }
  }

  // Already correct
  if (rawNorm === targetNorm) {
    return { correctedText: rawTranscript, correctionApplied: false, correctionReason: 'already_correct' }
  }

  // Primary check: use stt-tolerance (exact, phonetic map, levenshtein ≤ 1 for ≤ 6 chars)
  const toleranceResult = checkSTTTolerance(rawNorm, targetNorm)
  if (toleranceResult.matched) {
    console.log(
      `[kids-stt-correction] session=${sessionId} raw="${rawNorm}" target="${targetNorm}" ` +
      `method=${toleranceResult.method} confidence=${toleranceResult.confidence.toFixed(2)}`,
    )
    return { correctedText: targetWord, correctionApplied: true, correctionReason: toleranceResult.method }
  }

  // Extended check: levenshtein ≤ 2 for short target words (covers blew→blue, glue→blue)
  // Only for target words ≤ 7 chars to limit false positive scope.
  if (targetNorm.length <= 7 && rawNorm.length <= 7) {
    const dist = levenshtein(rawNorm, targetNorm)
    if (dist <= 2) {
      console.log(
        `[kids-stt-correction] session=${sessionId} raw="${rawNorm}" target="${targetNorm}" ` +
        `method=fuzzy_extended distance=${dist}`,
      )
      return { correctedText: targetWord, correctionApplied: true, correctionReason: `fuzzy_dist${dist}` }
    }
  }

  return { correctedText: rawTranscript, correctionApplied: false, correctionReason: 'no_match' }
}
