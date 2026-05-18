// ── Soft-Speaking Validator ────────────────────────────────────────────────────
// Deterministic quality gate for soft-speaking exercises (discussion, personal_fill,
// pair_speaking, guided_speaking, any_response).
//
// Backend decides allowProgression — AI never makes this call.
// No LLM calls. Cheap deterministic checks only.

import redis, { LESSON_TTL } from '../db/redis.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SoftSpeakingIssueType =
  | 'too_short'
  | 'readiness_intent'
  | 'unclear_subject'
  | 'missing_reason'
  | 'broken_grammar'
  | 'pronunciation_or_stt'
  | 'off_task'
  | 'acceptable_with_repair'
  | 'accepted'

export interface SoftSpeakingInput {
  exerciseId:    string
  exerciseNumber: number
  exerciseType:  string
  instruction:   string
  itemText:      string
  studentTranscript: string
  attemptCount:  number
  minWords?:     number
}

export interface SoftSpeakingValidationResult {
  allowProgression:     boolean
  needsRetry:           boolean
  isPartiallyAcceptable: boolean
  issueType:            SoftSpeakingIssueType
  interpretedMeaning?:  string
  repairPrompt?:        string
  teacherHint?:         string
  confidence:           number
}

// ── Attempt counter in Redis ──────────────────────────────────────────────────

function softAttemptsKey(lessonId: string, exerciseId: string): string {
  return `ss_attempts:${lessonId}:${exerciseId}`
}

export async function getSoftAttempts(lessonId: string, exerciseId: string): Promise<number> {
  try {
    const v = await redis.get(softAttemptsKey(lessonId, exerciseId))
    return v ? parseInt(v, 10) : 0
  } catch {
    return 0
  }
}

export async function incrementSoftAttempts(lessonId: string, exerciseId: string): Promise<number> {
  try {
    const key = softAttemptsKey(lessonId, exerciseId)
    const next = await redis.incr(key)
    await redis.expire(key, LESSON_TTL)
    return next
  } catch {
    return 1
  }
}

export async function resetSoftAttempts(lessonId: string, exerciseId: string): Promise<void> {
  try {
    await redis.del(softAttemptsKey(lessonId, exerciseId))
  } catch { /* non-fatal */ }
}

// ── Text normalization ────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getWords(normalized: string): string[] {
  return normalized.split(' ').filter(w => w.length > 0)
}

// ── Filler / off-task patterns ────────────────────────────────────────────────

const PURE_FILLER = /^(ok|okay|yes|yeah|sure|let's|lets|continue|next|i don't know|idk|no|hmm|uh|um|right|fine|good|great|alright)\.?$/i
const READINESS_PATTERNS = /^(i('m| am) ready|ready|let's go|lets go|let's start|lets start|start|begin|go ahead|yes i'm ready|yes i am ready)\.?$/i

const FILLER_PHRASES = new Set([
  'ok', 'okay', 'yes', 'yeah', 'sure', 'continue', 'next', 'i don\'t know', 'idk',
  'no', 'hmm', 'uh', 'um', 'right', 'fine', 'good', 'great', 'alright', 'let\'s',
  'lets', 'let', 'go', 'start', 'begin', 'again', 'now', 'please', 'well', 'just',
])

// Semantic stopwords — don't count these toward meaningful content
const STOPWORDS = new Set([
  'i', 'me', 'my', 'he', 'she', 'they', 'it', 'we', 'you', 'his', 'her', 'their',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'am',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'and', 'or', 'but', 'so',
  'that', 'this', 'as', 'do', 'does', 'did',
  'not', 'no', 'may', 'can', 'will', 'would', 'could', 'should',
])

function semanticWordCount(words: string[]): number {
  return words.filter(w => w.length > 1 && !STOPWORDS.has(w)).length
}

// ── STT self-correction detection ────────────────────────────────────────────
// "Not X", "I mean X", "I meant X" → student is correcting themselves
// Patterns: "not may", "not weave" → extract intended meaning

function hasSelfCorrection(normalized: string): boolean {
  return /\bnot\s+\w+\b/.test(normalized) ||
    /\bi mean\b/.test(normalized) ||
    /\bi meant\b/.test(normalized)
}

// Extract what comes AFTER the last correction marker
function extractCorrectedPart(normalized: string): string {
  const notMatch = [...normalized.matchAll(/not\s+(\w+)/g)]
  const iMeanMatch = normalized.match(/i mean\s+(.+)$/)
  if (iMeanMatch) return iMeanMatch[1].trim()
  // For "not X" patterns, what was said after the correction typically
  // contains the actual intended answer — return the full string
  return normalized
}

// ── Subject/person detection ──────────────────────────────────────────────────
// Detects a proper noun or role model reference

const ROLE_INDICATORS = [
  'inspires', 'inspire', 'inspiring', 'admire', 'admires', 'look up to',
  'role model', 'hero', 'idol', 'mentor', 'teaches me', 'taught me',
  'responsible', 'successful', 'kind', 'smart', 'talented', 'brave',
  'strong', 'creative', 'hard-working', 'hardworking', 'dedicated',
  'passionate', 'driven', 'generous', 'caring', 'honest', 'wise',
]

const REASON_MARKERS = [
  'because', 'since', 'as', 'due to', 'the reason', 'he is', 'she is',
  'they are', 'he\'s', 'she\'s', 'they\'re', 'is very', 'are very',
  'he was', 'she was', 'they were', 'always', 'never', 'makes me',
  'make me', 'helped me', 'helps me', 'showed me', 'shows me',
]

// Common grammar/modal/auxiliary words that are unlikely to be person names
const NON_NAME_WORDS = new Set([
  'may', 'can', 'will', 'would', 'could', 'should', 'shall', 'must', 'might',
  'inspire', 'inspires', 'inspired', 'inspiring', 'admire', 'admires', 'admired',
  'not', 'also', 'very', 'really', 'quite', 'just', 'only', 'even', 'still',
  'like', 'think', 'know', 'want', 'need', 'feel', 'see', 'look', 'make', 'take',
  'said', 'say', 'tell', 'told', 'get', 'got', 'put', 'give', 'gave',
  'has', 'had', 'have', 'having', 'been', 'being', 'thing', 'things',
])

// Find the most likely person/subject word — prefer longer, proper-noun-like tokens
function findSubjectGuess(words: string[], fallback: string): string {
  // First pass: look for words that look like names (>3 chars, not known grammar words)
  const nameCandidate = words.find(
    w => w.length > 3 && !STOPWORDS.has(w) && !FILLER_PHRASES.has(w) && !NON_NAME_WORDS.has(w),
  )
  if (nameCandidate) return nameCandidate

  // Second pass: any non-stopword, non-filler, non-grammar word
  const anyCandidate = words.find(
    w => w.length > 1 && !STOPWORDS.has(w) && !FILLER_PHRASES.has(w) && !NON_NAME_WORDS.has(w),
  )
  if (anyCandidate) return anyCandidate

  return fallback
}

function hasPersonSubject(words: string[]): boolean {
  const meaningfulWords = words.filter(
    w => w.length > 1 && !STOPWORDS.has(w) && !FILLER_PHRASES.has(w) && !NON_NAME_WORDS.has(w),
  )
  return meaningfulWords.length > 0
}

// Returns false when the entire utterance is composed only of fillers + stopwords.
// Used to catch "Okay. Let's continue." before semantic slot checks.
function hasSubstantiveContent(words: string[]): boolean {
  return words.some(w => w.length > 1 && !STOPWORDS.has(w) && !FILLER_PHRASES.has(w) && !NON_NAME_WORDS.has(w))
}

function hasInspireVerb(normalized: string): boolean {
  return ROLE_INDICATORS.some(r => normalized.includes(r))
}

function hasReasonMarker(normalized: string): boolean {
  return REASON_MARKERS.some(r => normalized.includes(r))
}

// ── Broken grammar detection ──────────────────────────────────────────────────
// Patterns typical for STT with non-native speakers:
// "Me inspire Oscar", "May inspire Oscar" (me→may via STT)
// Subject-verb inversion in wrong order

function detectBrokenGrammar(normalized: string, words: string[]): boolean {
  // Subject-object-verb inversion: sentence starts with object pronoun + verb
  if (/^me (inspire|inspires|admire|admires)\b/.test(normalized)) return true
  // "May inspire X" — "may" ≠ modal here; likely STT for "me"
  if (/^may (inspire|inspires|admire|admires)\b/.test(normalized)) return true
  // "He inspire" (missing -s)
  if (/\b(he|she) inspire\b/.test(normalized) && !/\b(he|she) inspires\b/.test(normalized)) return true
  return false
}

// ── "Who inspires you and why" semantic gate ──────────────────────────────────
// This is the primary gate for Exercise 1 of section 1.2.

function validateWhoInspiresYou(normalized: string, words: string[], attemptCount: number): SoftSpeakingValidationResult {
  // Off-task: all words are fillers/stopwords — no substantive content
  if (!hasSubstantiveContent(words)) {
    if (attemptCount >= 3) {
      return {
        allowProgression:      true,
        needsRetry:            false,
        isPartiallyAcceptable: true,
        issueType:             'acceptable_with_repair',
        confidence:            0.4,
      }
    }
    return {
      allowProgression:      false,
      needsRetry:            true,
      isPartiallyAcceptable: false,
      issueType:             'off_task',
      repairPrompt:          'First answer this one: who inspires you, and why?',
      confidence:            0.95,
    }
  }

  const hasSelfCorrect = hasSelfCorrection(normalized)
  const correctedText = hasSelfCorrect ? extractCorrectedPart(normalized) : normalized
  const correctedWords = getWords(correctedText)

  const semWords = semanticWordCount(correctedWords)
  const hasPerson = hasPersonSubject(correctedWords.filter(w => !STOPWORDS.has(w)))
  const hasInspire = hasInspireVerb(correctedText)
  const hasReason = hasReasonMarker(correctedText)
  const brokenGrammar = detectBrokenGrammar(normalized, words)

  // Attempt 3+: if meaning is detectable, soft-accept to avoid infinite loop
  if (attemptCount >= 3 && semWords >= 2) {
    console.log(`[soft-speaking] max_attempts_soft_accept exercise semantic_words=${semWords}`)
    return {
      allowProgression:      true,
      needsRetry:            false,
      isPartiallyAcceptable: true,
      issueType:             'acceptable_with_repair',
      confidence:            0.5,
      teacherHint: "Well done for trying. Let's keep going.",
    }
  }

  // Broken grammar (and possibly self-correction in progress)
  if (brokenGrammar && semWords >= 1) {
    const subjectGuess = findSubjectGuess(correctedWords, 'someone')
    const interpreted = `${subjectGuess} inspires me`
    return {
      allowProgression:      false,
      needsRetry:            true,
      isPartiallyAcceptable: false,
      issueType:             'broken_grammar',
      interpretedMeaning:    interpreted,
      repairPrompt: `Good idea — ${subjectGuess}. Say it like this: "${subjectGuess} inspires me because ..." Now you try.`,
      confidence:            0.75,
    }
  }

  // Self-correction in progress — likely STT issue — give benefit of doubt after detecting intent
  if (hasSelfCorrect && semWords >= 2) {
    const subjectGuess = findSubjectGuess(correctedWords, 'someone')
    if (!hasReason) {
      return {
        allowProgression:      false,
        needsRetry:            true,
        isPartiallyAcceptable: true,
        issueType:             'pronunciation_or_stt',
        interpretedMeaning:    `${subjectGuess} inspires me`,
        repairPrompt: `I understand — you mean ${subjectGuess}. Try again: "${subjectGuess} inspires me because ..."`,
        confidence:            0.65,
      }
    }
    // Has reason too — accept with repair
    return {
      allowProgression:      true,
      needsRetry:            false,
      isPartiallyAcceptable: true,
      issueType:             'acceptable_with_repair',
      interpretedMeaning:    `${subjectGuess} inspires me`,
      teacherHint: `Good. Better: "${subjectGuess} inspires me because ..."`,
      confidence:            0.7,
    }
  }

  // Too short — no semantic content
  if (semWords < 2) {
    return {
      allowProgression:      false,
      needsRetry:            true,
      isPartiallyAcceptable: false,
      issueType:             'too_short',
      repairPrompt: `Tell me who inspires you and why. For example: "My teacher inspires me because she is dedicated."`,
      confidence:            0.9,
    }
  }

  // Has person but missing inspire verb and reason — unclear subject or missing content
  if (hasPerson && !hasInspire && !hasReason) {
    const subjectGuess = findSubjectGuess(correctedWords, 'this person')
    return {
      allowProgression:      false,
      needsRetry:            true,
      isPartiallyAcceptable: false,
      issueType:             'unclear_subject',
      repairPrompt: `Good. Now say: "${subjectGuess} inspires me because ..." — tell me why.`,
      confidence:            0.7,
    }
  }

  // Has person + inspire verb but missing reason
  if (hasPerson && hasInspire && !hasReason) {
    const subjectGuess = findSubjectGuess(correctedWords, 'them')
    return {
      allowProgression:      false,
      needsRetry:            true,
      isPartiallyAcceptable: true,
      issueType:             'missing_reason',
      repairPrompt: `Good. Now add why: "${subjectGuess} inspires me because ..."`,
      confidence:            0.8,
    }
  }

  // Has all three: person + inspire + reason → accept
  if (hasPerson && (hasInspire || hasReason)) {
    return {
      allowProgression:      true,
      needsRetry:            false,
      isPartiallyAcceptable: false,
      issueType:             'accepted',
      confidence:            0.9,
    }
  }

  // Fallback — enough content, allow with partial
  if (semWords >= 4) {
    return {
      allowProgression:      true,
      needsRetry:            false,
      isPartiallyAcceptable: true,
      issueType:             'acceptable_with_repair',
      confidence:            0.6,
    }
  }

  // Default retry
  return {
    allowProgression:      false,
    needsRetry:            true,
    isPartiallyAcceptable: false,
    issueType:             'too_short',
    repairPrompt: `Tell me who inspires you and why. For example: "Oscar inspires me because he is responsible."`,
    confidence:            0.7,
  }
}

// ── Generic soft-speaking gate (non-"who inspires" exercises) ─────────────────

function validateGenericSoftSpeaking(
  normalized: string,
  words: string[],
  instruction: string,
  attemptCount: number,
  minWords: number,
): SoftSpeakingValidationResult {
  const semWords = semanticWordCount(words)

  // Too short
  if (semWords < minWords) {
    if (attemptCount >= 3) {
      return {
        allowProgression:      true,
        needsRetry:            false,
        isPartiallyAcceptable: true,
        issueType:             'acceptable_with_repair',
        confidence:            0.5,
        teacherHint:           "Good effort. Let's continue.",
      }
    }
    return {
      allowProgression:      false,
      needsRetry:            true,
      isPartiallyAcceptable: false,
      issueType:             'too_short',
      repairPrompt:          `Try to give a fuller answer. ${instruction ? `Remember: ${instruction}` : 'Use a complete sentence.'}`,
      confidence:            0.85,
    }
  }

  // Off-task filler only
  if (PURE_FILLER.test(normalized)) {
    if (attemptCount >= 3) {
      return {
        allowProgression:      true,
        needsRetry:            false,
        isPartiallyAcceptable: true,
        issueType:             'acceptable_with_repair',
        confidence:            0.4,
      }
    }
    return {
      allowProgression:      false,
      needsRetry:            true,
      isPartiallyAcceptable: false,
      issueType:             'off_task',
      repairPrompt:          instruction ? `First answer this: ${instruction}` : 'Please answer the question with a full sentence.',
      confidence:            0.9,
    }
  }

  return {
    allowProgression:      true,
    needsRetry:            false,
    isPartiallyAcceptable: false,
    issueType:             'accepted',
    confidence:            0.8,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function validateSoftSpeakingAnswer(input: SoftSpeakingInput): SoftSpeakingValidationResult {
  const normalized = normalize(input.studentTranscript)
  const words      = getWords(normalized)

  // Readiness intent — should be intercepted before this validator, but guard here too
  if (READINESS_PATTERNS.test(normalized)) {
    return {
      allowProgression:      false,
      needsRetry:            true,
      isPartiallyAcceptable: false,
      issueType:             'readiness_intent',
      repairPrompt:          input.instruction
        ? `First answer this: ${input.instruction}`
        : 'Please answer the question.',
      confidence:            0.95,
    }
  }

  // Pure off-task filler
  if (PURE_FILLER.test(normalized) && words.length <= 3) {
    if (input.attemptCount >= 3) {
      return {
        allowProgression:      true,
        needsRetry:            false,
        isPartiallyAcceptable: true,
        issueType:             'acceptable_with_repair',
        confidence:            0.4,
      }
    }
    return {
      allowProgression:      false,
      needsRetry:            true,
      isPartiallyAcceptable: false,
      issueType:             'off_task',
      repairPrompt:          input.instruction
        ? `First answer this one: ${input.instruction}`
        : 'Please answer with a complete sentence.',
      confidence:            0.9,
    }
  }

  // Route to exercise-specific semantic gate
  const instr = normalize(input.instruction)
  const isWhoInspiresYou =
    (instr.includes('inspir') && (instr.includes('who') || instr.includes('why'))) ||
    (instr.includes('inspir') && instr.includes('and why'))

  if (isWhoInspiresYou) {
    return validateWhoInspiresYou(normalized, words, input.attemptCount)
  }

  // Generic gate for other soft-speaking types
  const minWords = input.minWords ?? 3
  return validateGenericSoftSpeaking(normalized, words, input.instruction, input.attemptCount, minWords)
}
