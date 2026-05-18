// ── Soft-Speaking Validator ────────────────────────────────────────────────────
// Deterministic quality gate for soft-speaking exercises (discussion, personal_fill,
// pair_speaking, guided_speaking, any_response).
//
// Backend decides allowProgression — AI never makes this call.
// No LLM calls. Cheap deterministic checks only.
//
// Slot detection is now delegated to the interpretation pipeline (interpretSpokenAnswer).
// This validator owns the pedagogical policy layer: retry strategy, acceptable_with_repair,
// max-attempt soft-accept, and repair prompt selection.

import redis, { LESSON_TTL } from '../db/redis.js'
import { interpretSpokenAnswer } from '../interpretation/index.js'
import type { AnswerSlot as InterpAnswerSlot } from '../interpretation/index.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SoftSpeakingIssueType =
  | 'too_short'
  | 'readiness_intent'
  | 'unclear_subject'
  | 'missing_reason'
  | 'missing_subject'
  | 'missing_object'
  | 'missing_answer'
  | 'missing_required_slot'
  | 'broken_grammar'
  | 'pronunciation_or_stt'
  | 'off_task'
  | 'acceptable_with_repair'
  | 'accepted'

export type SoftSpeakingTaskKind =
  | 'reason_required'
  | 'personal_answer'
  | 'preference'
  | 'description'
  | 'question_answer_pair'
  | 'generic_discussion'

export type AnswerSlot =
  | 'subject'
  | 'reason'
  | 'preference'
  | 'object'
  | 'time'
  | 'place'
  | 'question'
  | 'answer'

export interface SoftSpeakingTaskSpec {
  taskKind:       SoftSpeakingTaskKind
  requiredSlots:  AnswerSlot[]
  grammarTarget?: string
}

export interface SlotDetectionResult {
  presentSlots:       AnswerSlot[]
  missingSlots:       AnswerSlot[]
  interpretedMeaning?: string
  confidence:         number
}

export interface SoftSpeakingInput {
  exerciseId:        string
  exerciseNumber:    number
  exerciseType:      string
  instruction:       string
  itemText:          string
  studentTranscript: string
  attemptCount:      number
  minWords?:         number
}

export interface SoftSpeakingValidationResult {
  allowProgression:      boolean
  needsRetry:            boolean
  isPartiallyAcceptable: boolean
  issueType:             SoftSpeakingIssueType
  interpretedMeaning?:   string
  repairPrompt?:         string
  teacherHint?:          string
  confidence:            number
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
    const key  = softAttemptsKey(lessonId, exerciseId)
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

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getWords(normalized: string): string[] {
  return normalized.split(' ').filter(w => w.length > 0)
}

// ── Semantic stopwords ────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'i', 'me', 'my', 'he', 'she', 'they', 'it', 'we', 'you', 'his', 'her', 'their',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'am',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'and', 'or', 'but', 'so',
  'that', 'this', 'as', 'do', 'does', 'did',
  'not', 'no', 'may', 'can', 'will', 'would', 'could', 'should',
])

// Grammar / modal words that should not be treated as subject names
const NON_NAME_WORDS = new Set([
  'may', 'can', 'will', 'would', 'could', 'should', 'shall', 'must', 'might',
  'inspire', 'inspires', 'inspired', 'inspiring', 'admire', 'admires', 'admired',
  'not', 'also', 'very', 'really', 'quite', 'just', 'only', 'even', 'still',
  'like', 'think', 'know', 'want', 'need', 'feel', 'see', 'look', 'make', 'take',
  'said', 'say', 'tell', 'told', 'get', 'got', 'put', 'give', 'gave',
  'has', 'had', 'have', 'having', 'been', 'being', 'thing', 'things',
])

const FILLER_PHRASES = new Set([
  'ok', 'okay', 'yes', 'yeah', 'sure', 'continue', 'next', "i don't know", 'idk',
  'no', 'hmm', 'uh', 'um', 'right', 'fine', 'good', 'great', 'alright', "let's",
  'lets', 'let', 'go', 'start', 'begin', 'again', 'now', 'please', 'well', 'just',
])

// ── Filler / readiness patterns ───────────────────────────────────────────────

const PURE_FILLER = /^(ok|okay|yes|yeah|sure|let's|lets|continue|next|i don't know|idk|no|hmm|uh|um|right|fine|good|great|alright)\.?$/i
const READINESS_PATTERNS = /^(i('m| am) ready|ready|let's go|lets go|let's start|lets start|start|begin|go ahead|yes i'm ready|yes i am ready)\.?$/i

// ── Semantic helpers ──────────────────────────────────────────────────────────

function semanticWordCount(words: string[]): number {
  return words.filter(w => w.length > 1 && !STOPWORDS.has(w)).length
}

function hasSubstantiveContent(words: string[]): boolean {
  return words.some(w => w.length > 1 && !STOPWORDS.has(w) && !FILLER_PHRASES.has(w) && !NON_NAME_WORDS.has(w))
}

function findSubjectGuess(words: string[], fallback: string): string {
  const nameCandidate = words.find(
    w => w.length > 3 && !STOPWORDS.has(w) && !FILLER_PHRASES.has(w) && !NON_NAME_WORDS.has(w),
  )
  if (nameCandidate) return nameCandidate
  const anyCandidate = words.find(
    w => w.length > 1 && !STOPWORDS.has(w) && !FILLER_PHRASES.has(w) && !NON_NAME_WORDS.has(w),
  )
  return anyCandidate ?? fallback
}

// ── STT self-correction detection ────────────────────────────────────────────

function hasSelfCorrection(normalized: string): boolean {
  return /\bnot\s+\w+\b/.test(normalized) ||
    /\bi mean\b/.test(normalized) ||
    /\bi meant\b/.test(normalized)
}

function extractCorrectedPart(normalized: string): string {
  const iMeanMatch = normalized.match(/i mean\s+(.+)$/)
  if (iMeanMatch) return iMeanMatch[1].trim()
  // For "not X" patterns the full string still contains the intended content
  return normalized
}

// Detects "Anita inspired me. She never gave up." — two-sentence form where the
// second sentence (starting with a 3rd-person pronoun) provides an explanation.
// Uses the raw (non-normalized) transcript to preserve sentence boundaries.
function hasSecondExplanatoryClause(rawTranscript: string): boolean {
  const sentences = rawTranscript
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 2)
  if (sentences.length < 2) return false
  for (let i = 1; i < sentences.length; i++) {
    const norm  = normalizeText(sentences[i]!)
    const words = getWords(norm)
    // Second clause must begin with a 3rd-person pronoun and have ≥2 semantic words
    if (/^(he|she|they|it)\b/.test(norm) && semanticWordCount(words) >= 2) return true
  }
  return false
}

// ── Broken grammar detection ──────────────────────────────────────────────────
// Catches SOV inversion, object-first patterns, and missing subject-verb agreement.

function detectBrokenGrammar(normalized: string): boolean {
  if (/^me (inspire|inspires|admire|admires)\b/.test(normalized)) return true
  // "may inspire" — "may" is likely STT for "me" (non-native speaker)
  if (/^may (inspire|inspires|admire|admires)\b/.test(normalized)) return true
  // Missing -s: "he inspire" instead of "he inspires"
  if (/\b(he|she) inspire\b/.test(normalized) && !/\b(he|she) inspires\b/.test(normalized)) return true
  // SOV: "Jordan inspire me" (missing -s on third-person singular)
  if (/\b\w{3,} inspire me\b/.test(normalized) && !/\b\w{3,} inspires me\b/.test(normalized)) return true
  return false
}

// ══════════════════════════════════════════════════════════════════════════════
// ── inferSoftSpeakingTask ─────────────────────────────────────────────────────
// Parses the exercise instruction to determine what kind of speaking task it is
// and which semantic slots the student must fill.
// No exercise numbers, no section IDs — instruction text only.
// ══════════════════════════════════════════════════════════════════════════════

export function inferSoftSpeakingTask(instruction: string): SoftSpeakingTaskSpec {
  const norm = normalizeText(instruction)

  // "ask and answer" / "form a question" → question_answer_pair
  if (
    /ask and answer/.test(norm) ||
    /form (a|the) question/.test(norm) ||
    /make (a|the) question/.test(norm)
  ) {
    return { taskKind: 'question_answer_pair', requiredSlots: ['question', 'answer'] }
  }

  const slots: AnswerSlot[] = []
  let taskKind: SoftSpeakingTaskKind = 'generic_discussion'

  const hasWho   = /\bwho\b/.test(norm)
  const hasWhy   = /\bwhy\b/.test(norm)
  const hasWhat  = /\bwhat\b/.test(norm)
  const hasWhere = /\bwhere\b/.test(norm)
  const hasWhen  = /\bwhen\b/.test(norm)

  // "who ... and why" → reason_required with subject + reason
  if (hasWho && hasWhy) {
    taskKind = 'reason_required'
    slots.push('subject', 'reason')
  } else if (hasWho) {
    taskKind = 'personal_answer'
    slots.push('subject')
  } else if (hasWhy) {
    // "why" without "who" — reason still required
    taskKind = 'reason_required'
    slots.push('reason')
  }

  // "what you like/enjoy/prefer/favourite" → preference (possibly + reason for "and why")
  if (hasWhat && /\b(like|enjoy|prefer|favourite|favorite|love|hate|interest)\b/.test(norm)) {
    taskKind = 'preference'
    if (!slots.includes('preference')) slots.push('preference')
    if (hasWhy && !slots.includes('reason')) slots.push('reason')
  } else if (hasWhat) {
    // "what you are reading" / "what you are doing" → object/description
    if (slots.length === 0) taskKind = 'description'
    if (!slots.includes('object')) slots.push('object')
  }

  // "where" → place slot
  if (hasWhere && !slots.includes('place')) slots.push('place')

  // "when" → time slot
  if (hasWhen && !slots.includes('time')) slots.push('time')

  return { taskKind, requiredSlots: slots }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Slot presence markers ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Strict causal connectors only — explicit "why" words.
// "that's why" normalized becomes "that s why" (apostrophe → space).
// NOT included: 'always', 'never', 'he is', 'makes me', 'helped me', qualities like
// 'is kind', etc. — those describe a person but are NOT causal connectors and produce
// false positives via substring matching (e.g. 'as' inside "class" / "has" / "passionate").
const REASON_MARKERS = [
  'because', 'since', 'due to', 'that s why', 'that is why',
]

// 'so' is causal only when followed by a subject pronoun ("so I", "so he", …),
// not as an intensifier ("so kind", "so inspired").
const CAUSAL_SO_RE = /\bso\b\s+(i|he|she|they|it|we|you)\b/

// 'as' is causal only when used as a conjunction before a pronoun+clause
// ("as he is kind") — word-boundary guard prevents matching 'as' inside "class"/"has".
const CAUSAL_AS_RE = /\bas\b\s+(he|she|they|it|i|we|you)\b/

const PREFERENCE_MARKERS = [
  'like', 'likes', 'love', 'loves', 'enjoy', 'enjoys', 'prefer', 'prefers',
  'favourite', 'favorite', 'really into', 'passionate about',
  "don't like", "doesn't like", 'hate', 'hates', 'dislike', 'dislikes',
  'interested in', 'keen on',
]

const TIME_MARKERS = [
  'now', 'at the moment', 'currently', 'right now', 'these days',
  'today', 'yesterday', 'last week', 'last month', 'this week',
  'at present', 'for now', 'lately', 'recently',
]

const PLACE_PREPOSITIONS = ['at', 'in', 'near', 'next to', 'outside', 'inside', 'by', 'around']

const QUESTION_STARTERS = new Set([
  'what', 'who', 'where', 'when', 'why', 'how',
  'do', 'does', 'did', 'can', 'could', 'would', 'will',
  'is', 'are', 'have', 'has',
])

// ══════════════════════════════════════════════════════════════════════════════
// ── detectAnswerSlots ─────────────────────────────────────────────────────────
// Checks which required semantic slots are present in the student transcript.
// Deterministic only — no LLM.
// ══════════════════════════════════════════════════════════════════════════════

function detectSlotPresence(slot: AnswerSlot, normalized: string, words: string[], rawTranscript?: string): boolean {
  switch (slot) {
    case 'subject':
      // Person/entity present — non-stopword, non-filler, non-grammar word
      return words.some(
        w => w.length > 1 && !STOPWORDS.has(w) && !FILLER_PHRASES.has(w) && !NON_NAME_WORDS.has(w),
      )

    case 'reason': {
      // Explicit causal connector (word-boundary safe)
      if (REASON_MARKERS.some(m => normalized.includes(m))) return true
      // Causal 'so': "so I work hard" — not intensifier "so kind"
      if (CAUSAL_SO_RE.test(normalized)) return true
      // Causal 'as': "as he is kind" — word-boundary guard prevents "class"/"has" matches
      if (CAUSAL_AS_RE.test(normalized)) return true
      // Two-sentence form: "Anita inspired me. She never gave up."
      if (rawTranscript !== undefined && hasSecondExplanatoryClause(rawTranscript)) return true
      return false
    }

    case 'preference':
      return PREFERENCE_MARKERS.some(p => normalized.includes(p))

    case 'object':
      // Student is describing something — at least 2 semantic words present
      return semanticWordCount(words) >= 2

    case 'time':
      return TIME_MARKERS.some(t => normalized.includes(t))

    case 'place': {
      const placeRegex = new RegExp(`\\b(${PLACE_PREPOSITIONS.join('|')})\\s+\\w{2,}`)
      return placeRegex.test(normalized)
    }

    case 'question':
      // Question word at start, or contains "?"
      if (normalized.includes('?')) return true
      return QUESTION_STARTERS.has(words[0] ?? '')

    case 'answer':
      // Any substantive response with enough content
      return semanticWordCount(words) >= 2

    default:
      return false
  }
}

export function detectAnswerSlots(
  transcript: string,
  requiredSlots: AnswerSlot[],
  rawTranscript?: string,
): SlotDetectionResult {
  const normalized = normalizeText(transcript)
  const words      = getWords(normalized)

  const presentSlots: AnswerSlot[] = []
  const missingSlots: AnswerSlot[] = []

  for (const slot of requiredSlots) {
    if (detectSlotPresence(slot, normalized, words, rawTranscript)) {
      presentSlots.push(slot)
    } else {
      missingSlots.push(slot)
    }
  }

  const confidence = missingSlots.length === 0
    ? 0.9
    : presentSlots.length === 0
      ? 0.95
      : 0.7

  const subjectGuess = findSubjectGuess(words, '')
  const interpretedMeaning = presentSlots.includes('subject') && subjectGuess
    ? subjectGuess
    : undefined

  return { presentSlots, missingSlots, interpretedMeaning, confidence }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── buildPedagogicalRetry ─────────────────────────────────────────────────────
// Builds a short, human-sounding teacher repair prompt.
// Targets only the FIRST missing slot — repair one thing at a time.
// Instruction-context-aware so the hint fits the exercise.
// ══════════════════════════════════════════════════════════════════════════════

export function buildPedagogicalRetry(
  instruction: string,
  missingSlots: AnswerSlot[],
  subjectGuess = 'someone',
): string {
  if (missingSlots.length === 0) return ''

  const firstMissing = missingSlots[0]!
  const norm = normalizeText(instruction)

  switch (firstMissing) {
    case 'reason': {
      if (/inspir/.test(norm)) {
        const sub = subjectGuess !== 'someone' ? subjectGuess : 'they'
        const prefix = subjectGuess !== 'someone'
          ? `Good start. ${subjectGuess} inspires you. `
          : 'Good start. '
        return `${prefix}Now add why: "${sub} inspires me because ..."`
      }
      if (/like|enjoy|prefer|favourite|favorite/.test(norm)) {
        return `Good start. Now say why you like it.`
      }
      return `Good start. Now add why.`
    }
    case 'subject':
      return `Good start. Who are you talking about?`
    case 'preference':
      return `What do you like or enjoy? Tell me your preference.`
    case 'object':
      return `What specifically? Give me a name or example.`
    case 'time':
      return `When? For example: "at the moment" or "right now".`
    case 'place':
      return `Where exactly? Try: "at school" or "in London".`
    case 'question':
      return `Try to form a question. For example: "What do you enjoy doing?"`
    case 'answer':
      return `Now give your answer in a full sentence.`
    default:
      return `Please give a fuller answer.`
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── validateWithSlots ─────────────────────────────────────────────────────────
// Core slot-based validation. Generic — works for any instruction-inferred task.
//
// Ordering invariant:
//   1. detectAnswerSlots runs FIRST.
//   2. missingSlots.length > 0 ALWAYS blocks progression — no override.
//   3. acceptable_with_repair and max_attempts_soft_accept only fire when
//      ALL required slots are present (missingSlots.length === 0).
// ══════════════════════════════════════════════════════════════════════════════

function validateWithSlots(
  normalized: string,
  words: string[],
  instruction: string,
  taskSpec: SoftSpeakingTaskSpec,
  attemptCount: number,
  rawTranscript?: string,
  preComputedSlotResult?: SlotDetectionResult,
): SoftSpeakingValidationResult {
  // Off-task: no substantive content at all
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
      repairPrompt:          `First answer this one: ${instruction}`,
      confidence:            0.95,
    }
  }

  // Generic discussion — no specific slots required, just need some content
  if (taskSpec.requiredSlots.length === 0) {
    const semWords = semanticWordCount(words)
    if (semWords < 3 && attemptCount < 3) {
      return {
        allowProgression:      false,
        needsRetry:            true,
        isPartiallyAcceptable: false,
        issueType:             'too_short',
        repairPrompt:          `Try to give a fuller answer. ${instruction}`,
        confidence:            0.8,
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

  const semWords = semanticWordCount(words)

  // STT self-correction: extract intended content from corrected portion
  const hasSelfCorrect = hasSelfCorrection(normalized)
  const correctedText  = hasSelfCorrect ? extractCorrectedPart(normalized) : normalized
  const correctedWords = getWords(correctedText)

  const brokenGrammar  = detectBrokenGrammar(normalized)
  const subjectGuess   = findSubjectGuess(correctedWords, 'someone')

  // Slot detection runs FIRST — required slots are a hard gate before any other check.
  // acceptable_with_repair, broken_grammar, and max_attempts can only allow progression
  // when ALL required slots are present.
  // When a pre-computed interpretation result is available, use it — avoids duplicate work.
  const slotResult = preComputedSlotResult ?? detectAnswerSlots(correctedText, taskSpec.requiredSlots, rawTranscript)

  // ── Required-slots gate: missingSlots always block progression ──────────────
  // This runs before max_attempts and before broken_grammar/repair paths.
  if (slotResult.missingSlots.length > 0) {
    // Broken grammar AND slots missing — guide toward full correct form
    if (brokenGrammar && semWords >= 1) {
      return {
        allowProgression:      false,
        needsRetry:            true,
        isPartiallyAcceptable: false,
        issueType:             'broken_grammar',
        interpretedMeaning:    subjectGuess !== 'someone' ? subjectGuess : undefined,
        repairPrompt:          subjectGuess !== 'someone'
          ? `Good idea — ${subjectGuess}. Say it like this: "${subjectGuess} inspires me because ..." Now you try.`
          : `Good idea. Try: "... inspires me because ..." Now you try.`,
        confidence:            0.75,
      }
    }

    // STT/self-correction in progress
    if (hasSelfCorrect && semWords >= 2) {
      const repairMsg = buildPedagogicalRetry(instruction, slotResult.missingSlots, subjectGuess)
      const interpretedPrefix = subjectGuess !== 'someone' ? `I understand — you mean ${subjectGuess}. ` : ''
      return {
        allowProgression:      false,
        needsRetry:            true,
        isPartiallyAcceptable: true,
        issueType:             'pronunciation_or_stt',
        interpretedMeaning:    subjectGuess !== 'someone' ? `I understand — you mean ${subjectGuess}` : undefined,
        repairPrompt:          `${interpretedPrefix}${repairMsg}`,
        confidence:            0.65,
      }
    }

    // Not enough content
    if (semWords < 2) {
      return {
        allowProgression:      false,
        needsRetry:            true,
        isPartiallyAcceptable: false,
        issueType:             'too_short',
        repairPrompt:          instruction
          ? `Tell me more. ${instruction}`
          : 'Please answer with a complete sentence.',
        confidence:            0.9,
      }
    }

    // Some slots present but first required slot missing — targeted repair
    if (slotResult.presentSlots.length > 0) {
      const repairMsg    = buildPedagogicalRetry(instruction, slotResult.missingSlots, subjectGuess)
      const firstMissing = slotResult.missingSlots[0]!
      const issueType: SoftSpeakingIssueType =
        firstMissing === 'reason'     ? 'missing_reason'       :
        firstMissing === 'subject'    ? 'missing_subject'       :
        firstMissing === 'object'     ? 'missing_object'        :
        firstMissing === 'answer'     ? 'missing_answer'        :
        'missing_required_slot'
      return {
        allowProgression:      false,
        needsRetry:            true,
        isPartiallyAcceptable: true,
        issueType,
        repairPrompt:          repairMsg,
        confidence:            slotResult.confidence,
      }
    }

    // No required slots detected at all but has some semantic content
    return {
      allowProgression:      false,
      needsRetry:            true,
      isPartiallyAcceptable: false,
      issueType:             'unclear_subject',
      repairPrompt:          instruction
        ? `Good start. Now answer properly: ${instruction}`
        : 'Please give a complete answer.',
      confidence:            0.7,
    }
  }

  // ── All required slots present ──────────────────────────────────────────────
  // Only reach here when missingSlots.length === 0.

  // Max attempts soft-accept: prevents infinite retry loops after 3 genuine tries.
  // Runs ONLY after required slots are confirmed present.
  if (attemptCount >= 3 && semWords >= 2) {
    console.log(`[soft-speaking] max_attempts_soft_accept task=${taskSpec.taskKind} semantic_words=${semWords}`)
    return {
      allowProgression:      true,
      needsRetry:            false,
      isPartiallyAcceptable: true,
      issueType:             'acceptable_with_repair',
      confidence:            0.5,
      teacherHint:           "Well done for trying. Let's keep going.",
    }
  }

  if (brokenGrammar) {
    // All slots present, grammar broken → accept with grammar repair hint
    const hint = subjectGuess !== 'someone'
      ? `Good. Better: "${subjectGuess} inspires me because ..."`
      : `Good. Try to use a complete sentence.`
    return {
      allowProgression:      true,
      needsRetry:            false,
      isPartiallyAcceptable: true,
      issueType:             'acceptable_with_repair',
      interpretedMeaning:    subjectGuess !== 'someone' ? subjectGuess : undefined,
      teacherHint:           hint,
      confidence:            0.75,
    }
  }

  return {
    allowProgression:      true,
    needsRetry:            false,
    isPartiallyAcceptable: false,
    issueType:             'accepted',
    confidence:            slotResult.confidence,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function validateSoftSpeakingAnswer(input: SoftSpeakingInput): SoftSpeakingValidationResult {
  const normalized = normalizeText(input.studentTranscript)
  const words      = getWords(normalized)

  // Readiness intent — intercepted by lesson-ws before this, but guard here too
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

  // Infer task structure from instruction — fully generic, no exercise/section hardcoding
  const taskSpec = inferSoftSpeakingTask(input.instruction)

  // ── Run formal interpretation pipeline ───────────────────────────────────────
  // interpretSpokenAnswer performs:
  //   1. Normalization  2. Segmentation  3. Self-correction resolution
  //   4. Clause extraction  5. Formal slot extraction
  // Its missingSlots result is the authoritative gate for progression.
  let preComputedSlotResult: SlotDetectionResult | undefined
  if (taskSpec.requiredSlots.length > 0) {
    const interpretation = interpretSpokenAnswer({
      rawTranscript:  input.studentTranscript,
      exerciseType:   input.exerciseType,
      instruction:    input.instruction,
      itemText:       input.itemText,
      requiredSlots:  taskSpec.requiredSlots as InterpAnswerSlot[],
      attemptCount:   input.attemptCount,
      inputMode:      'voice',
    })

    // Map interpretation result to the SlotDetectionResult shape used by validateWithSlots
    const subjectSlot = interpretation.slots.find(s => s.slot === 'subject')
    preComputedSlotResult = {
      presentSlots:       interpretation.slots.map(s => s.slot as AnswerSlot),
      missingSlots:       interpretation.missingSlots as AnswerSlot[],
      interpretedMeaning: subjectSlot?.value,
      confidence:         interpretation.confidence,
    }

    // Log the authoritative interpretation result
    if (interpretation.missingSlots.length > 0) {
      console.log(
        `[soft-speaking] interpretation_result exercise=${input.exerciseNumber} ` +
        `missing=${interpretation.missingSlots.join(',')} issue=${interpretation.issueType} ` +
        `allowProgression=false`,
      )
    } else {
      console.log(
        `[soft-speaking] interpretation_result exercise=${input.exerciseNumber} ` +
        `all_slots_present issue=${interpretation.issueType} allowProgression=pending_policy`,
      )
    }
  }

  const result = validateWithSlots(
    normalized, words, input.instruction, taskSpec, input.attemptCount,
    input.studentTranscript, preComputedSlotResult,
  )

  if (result.allowProgression) {
    console.log(`[soft-speaking] accepted_all_slots exercise=${input.exerciseNumber} allowProgression=true`)
  }

  return result
}
