// ── Spoken Answer Interpreter ─────────────────────────────────────────────────
// Orchestrates the full interpretation pipeline:
//   raw STT → normalization → segmentation → self-correction resolution
//   → clause extraction → slot extraction → canonical answer → repair hint
//
// Authority contract:
//   - Does NOT decide allowProgression
//   - Does NOT call AI/LLM
//   - Returns SpokenInterpretationResult — consumed by Validation and Teacher Brain
//   - Validation (soft-speaking-validator) uses missingSlots for progression gate
//   - Teacher Brain uses interpretedAnswer + teacherRepairHint for verbal response

import type {
  SpokenInterpretationInput,
  SpokenInterpretationResult,
  AnswerSlot,
  InterpretationIssueType,
  ExtractedClause,
  ExtractedSlot,
} from './types.js'
import { normalizeTranscript } from './transcript-normalizer.js'
import { segmentUtterance } from './utterance-segmenter.js'
import { hasSelfCorrection, resolveSelfCorrection } from './self-correction-resolver.js'
import { extractClauses } from './clause-extractor.js'
import { extractSlots } from './slot-extractor.js'

// ── Grammar-fill type detection ───────────────────────────────────────────────

const GRAMMAR_FILL_TYPES = new Set([
  'grammar_fill',
  'grammar_focus_fill',
  'fill_in_the_gap',
  'grammar_drill',
  'fill_in_blank',
])

function isGrammarFillType(exerciseType: string): boolean {
  return GRAMMAR_FILL_TYPES.has(exerciseType.toLowerCase())
}

// ── Grammar-fill canonical answer extraction ──────────────────────────────────
// For grammar_fill exercises, extract what the student actually said as their
// answer token, resolving self-corrections and sentence-embedded answers.
//
// Examples:
//   resolved="is"              expected="is"  → canonical="is"    (exact)
//   resolved="ease"            expected="is"  → canonical="is"    (phonetic via known map)
//   resolved="what are he doing" expected="is" → canonical="are"  (auxiliary extracted)
//   resolved="have you ever met" expected="have" → canonical="have" (first word)

const PHONETIC_VARIANTS: Record<string, string[]> = {
  is:    ['ease', 'iz', 'ees'],
  are:   ['r'],
  was:   ['woz', 'wuz'],
  were:  ['wer'],
  have:  ['hav', 'hev'],
  has:   ['haz', 'hez'],
  do:    ['doo', 'due', 'dew'],
  does:  ['duz', 'doz'],
  did:   ['dud'],
  will:  ['wil'],
  would: ['wud', 'wood'],
  can:   ['ken'],
  could: ['cud'],
  am:    ['um', 'em'],
}

// Build reverse map: variant → canonical
const REVERSE_PHONETIC: Record<string, string> = {}
for (const [canonical, variants] of Object.entries(PHONETIC_VARIANTS)) {
  for (const variant of variants) {
    REVERSE_PHONETIC[variant] = canonical
  }
}

function resolvePhoneticVariant(token: string): string {
  return REVERSE_PHONETIC[token] ?? token
}

// Auxiliary verbs used in WH-questions (ordered by likelihood as fill target)
const AUXILIARIES = [
  'is', 'are', 'was', 'were', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'can', 'could',
  'should', 'may', 'might', 'shall', 'am',
]

function extractGrammarFillCanonical(
  resolvedUtterance: string,
  expectedAnswer:    string,
): string | undefined {
  const resolvedLower  = resolvedUtterance.toLowerCase().trim()
  const expectedLower  = expectedAnswer.toLowerCase().trim()

  // Exact match
  if (resolvedLower === expectedLower) return expectedLower

  // Single-token resolved (student said one word)
  const resolvedWords = resolvedLower.split(/\s+/).filter(Boolean)
  if (resolvedWords.length === 1) {
    const token     = resolvedWords[0]!
    const phonetic  = resolvePhoneticVariant(token)
    if (phonetic === expectedLower) return expectedLower
    // Return the resolved token itself (what student said, even if wrong)
    return phonetic !== token ? phonetic : token
  }

  // Multi-word: check if expected answer appears verbatim
  if (resolvedLower.includes(expectedLower)) return expectedLower

  // Multi-word: try to extract an auxiliary from a WH-question
  // "what are he doing now" → auxiliary = "are"
  if (/^(what|who|where|when|why|how)\b/.test(resolvedLower)) {
    const words = resolvedLower.split(/\s+/).filter(Boolean)
    // Second word is typically the auxiliary in WH-questions
    const secondWord = words[1] ?? ''
    if (AUXILIARIES.includes(secondWord)) {
      return resolvePhoneticVariant(secondWord)
    }
  }

  // Multi-word: first word may be the answer (e.g. "Have you ever met him" → "have")
  const firstWord = resolvedWords[0] ?? ''
  if (AUXILIARIES.includes(firstWord) || firstWord === expectedLower) {
    return resolvePhoneticVariant(firstWord)
  }

  // Check each token for phonetic match to expected
  for (const token of resolvedWords) {
    if (resolvePhoneticVariant(token) === expectedLower) return expectedLower
  }

  return undefined
}

// ── STT ambiguity resolution for known entities ───────────────────────────────
// Bounded: only applied when knownEntities are provided and utterance is short.
// Uses edit distance to detect likely entity substitutions.

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!)
    }
  }
  return dp[m]![n]!
}

function resolveKnownEntitySTT(
  resolvedUtterance: string,
  knownEntities:     string[],
): string | undefined {
  const tokens = resolvedUtterance.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length > 3) return undefined  // only apply to short utterances

  for (const entity of knownEntities) {
    const entityLower = entity.toLowerCase()
    // Check each token against the entity with proportional edit distance
    for (const token of tokens) {
      if (token === entityLower) return entity
      const maxDist = Math.max(1, Math.floor(entityLower.length / 3))
      if (levenshtein(token, entityLower) <= maxDist) return entity
    }
    // Also check whole utterance collapsed (for "we have" → "weave" → "Viv" pattern)
    const collapsed = tokens.join('')
    if (collapsed.length <= entityLower.length + 2) {
      if (levenshtein(collapsed, entityLower) <= Math.max(1, Math.floor(entityLower.length / 2))) {
        return entity
      }
    }
  }
  return undefined
}

// ── Broken grammar detection ──────────────────────────────────────────────────
// Mirrors the detection in soft-speaking-validator.ts — kept here so the
// interpreter can classify issues without importing from the validator.

function detectBrokenGrammar(normalized: string): boolean {
  if (/^me (inspire|inspires|admire|admires)\b/.test(normalized)) return true
  if (/^may (inspire|inspires|admire|admires)\b/.test(normalized)) return true
  if (/\b(he|she) inspire\b/.test(normalized) && !/\b(he|she) inspires\b/.test(normalized)) return true
  if (/\b\w{3,} inspire me\b/.test(normalized) && !/\b\w{3,} inspires me\b/.test(normalized)) return true
  return false
}

// ── Issue type determination ──────────────────────────────────────────────────

function determineIssueType(params: {
  selfCorrected:    boolean
  missingSlots:     AnswerSlot[]
  clauses:          ExtractedClause[]
  resolvedUtterance: string
  normalizedTranscript: string
  canonicalAnswer?: string
}): InterpretationIssueType {
  const { selfCorrected, missingSlots, resolvedUtterance, normalizedTranscript, canonicalAnswer } = params

  // Short answer
  const wordCount = resolvedUtterance.split(/\s+/).filter(Boolean).length
  if (wordCount < 2 && missingSlots.length > 0) return 'too_short'

  if (selfCorrected && missingSlots.length === 0) return 'self_correction'
  if (selfCorrected && missingSlots.length > 0)   return 'self_correction'

  if (missingSlots.length > 0 && detectBrokenGrammar(normalizedTranscript)) return 'broken_grammar'

  if (canonicalAnswer !== undefined) return 'clear'

  if (missingSlots.length > 0) return 'missing_slot'

  return 'clear'
}

// ── Repair hint builder ───────────────────────────────────────────────────────

function buildRepairHint(params: {
  issueType:       InterpretationIssueType
  missingSlots:    AnswerSlot[]
  slots:           ExtractedSlot[]
  instruction?:    string
  canonicalAnswer?: string
  expectedAnswer?:  string
  interpretedAnswer?: string
}): string | undefined {
  const { issueType, missingSlots, slots, instruction, canonicalAnswer, expectedAnswer, interpretedAnswer } = params

  if (missingSlots.length === 0 && issueType === 'clear') return undefined

  const subjectSlot = slots.find(s => s.slot === 'subject')
  const subjectVal  = subjectSlot?.value

  switch (missingSlots[0]) {
    case 'reason': {
      const sub    = subjectVal ?? 'they'
      const prefix = subjectVal ? `Good start. ${subjectVal} inspires you. ` : 'Good start. '
      if (instruction && /inspir/i.test(instruction)) {
        return `${prefix}Now add why: "${sub} inspires me because ..."`
      }
      if (instruction && /like|enjoy|prefer|favour/i.test(instruction)) {
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
      return `Try to form a question.`
    case 'answer':
      return `Now give your answer in a full sentence.`
    default:
      break
  }

  // Grammar fill: canonical ≠ expected → repair hint
  if (canonicalAnswer && expectedAnswer && canonicalAnswer !== expectedAnswer) {
    return `Close — you said "${canonicalAnswer}". The correct form is "${expectedAnswer}".`
  }

  // STT/pronunciation repair
  if (issueType === 'pronunciation_or_stt' && interpretedAnswer) {
    return `I understand — you mean ${interpretedAnswer}. Say it once: ${interpretedAnswer}.`
  }

  return undefined
}

// ── Confidence computation ────────────────────────────────────────────────────

function computeConfidence(
  missingSlots:  AnswerSlot[],
  requiredSlots: AnswerSlot[],
  issueType:     InterpretationIssueType,
  selfCorrected: boolean,
): number {
  if (missingSlots.length === 0 && issueType === 'clear')     return 0.95
  if (missingSlots.length === 0 && selfCorrected)              return 0.85
  if (missingSlots.length === requiredSlots.length)            return 0.9   // all missing — very confident about that
  if (missingSlots.length > 0 && issueType === 'broken_grammar') return 0.75
  if (missingSlots.length > 0)                                 return 0.7
  return 0.8
}

// ── Main export ───────────────────────────────────────────────────────────────

export function interpretSpokenAnswer(input: SpokenInterpretationInput): SpokenInterpretationResult {
  const {
    rawTranscript,
    exerciseType,
    expectedAnswer,
    knownEntities  = [],
    requiredSlots  = [],
    instruction,
  } = input

  console.log(
    `[interpretation] start exercise_type=${exerciseType} ` +
    `raw="${rawTranscript.slice(0, 80)}"`,
  )

  // ── Step 1: Normalize ──────────────────────────────────────────────────────
  const normalizedTranscript = normalizeTranscript(rawTranscript)

  // ── Step 2: Segment ───────────────────────────────────────────────────────
  const segments = segmentUtterance(rawTranscript)

  // ── Step 3: Self-correction resolution ────────────────────────────────────
  const selfCorrected     = hasSelfCorrection(normalizedTranscript)
  const resolvedUtterance = selfCorrected
    ? resolveSelfCorrection(rawTranscript, normalizedTranscript)
    : normalizedTranscript

  if (selfCorrected) {
    console.log(`[interpretation] self_correction resolved="${resolvedUtterance.slice(0, 60)}"`)
  }

  // ── Step 4: Clause extraction ─────────────────────────────────────────────
  const clauses = extractClauses(resolvedUtterance)

  // ── Step 5: Slot extraction ───────────────────────────────────────────────
  const { slots, missingSlots } = extractSlots(clauses, requiredSlots)

  // ── Step 6: Grammar-fill canonical answer ─────────────────────────────────
  let canonicalAnswer: string | undefined
  if (isGrammarFillType(exerciseType) && expectedAnswer) {
    canonicalAnswer = extractGrammarFillCanonical(resolvedUtterance, expectedAnswer)
    if (canonicalAnswer) {
      console.log(
        `[interpretation] canonical="${canonicalAnswer}" expected="${expectedAnswer}" ` +
        `issue=${canonicalAnswer !== expectedAnswer ? 'clear' : 'correct'}`,
      )
    }
  }

  // ── Step 7: Known entity STT resolution ───────────────────────────────────
  let interpretedAnswer: string | undefined
  if (!canonicalAnswer && knownEntities.length > 0) {
    const entityMatch = resolveKnownEntitySTT(resolvedUtterance, knownEntities)
    if (entityMatch) {
      interpretedAnswer = entityMatch
      canonicalAnswer   = entityMatch
      console.log(
        `[interpretation] stt_variant raw="${resolvedUtterance.slice(0, 40)}" ` +
        `interpreted="${entityMatch}"`,
      )
    }
  }

  // Also check expected answer as a known-entity candidate for single-token pronunciation variants
  if (!canonicalAnswer && expectedAnswer && !isGrammarFillType(exerciseType)) {
    const allEntities = [expectedAnswer, ...knownEntities]
    const entityMatch = resolveKnownEntitySTT(resolvedUtterance, allEntities)
    if (entityMatch) {
      interpretedAnswer = entityMatch
      canonicalAnswer   = entityMatch
    }
  }

  // ── Step 8: Subject as interpreted answer fallback ────────────────────────
  const subjectSlot = slots.find(s => s.slot === 'subject')
  if (!interpretedAnswer && subjectSlot) {
    interpretedAnswer = subjectSlot.value
  }

  // ── Step 9: Issue type ────────────────────────────────────────────────────
  const issueType = determineIssueType({
    selfCorrected,
    missingSlots,
    clauses,
    resolvedUtterance,
    normalizedTranscript,
    canonicalAnswer,
  })

  // ── Step 10: Repair hint ──────────────────────────────────────────────────
  const teacherRepairHint = buildRepairHint({
    issueType,
    missingSlots,
    slots,
    instruction,
    canonicalAnswer,
    expectedAnswer,
    interpretedAnswer,
  })

  // ── Step 11: Confidence ───────────────────────────────────────────────────
  const confidence = computeConfidence(missingSlots, requiredSlots, issueType, selfCorrected)

  if (missingSlots.length > 0) {
    console.log(
      `[interpretation] resolved="${resolvedUtterance.slice(0, 60)}" ` +
      `slots=${slots.map(s => s.slot).join(',') || 'none'}` +
      `,!${missingSlots.join(',!')} issue=${issueType}`,
    )
  }

  return {
    rawTranscript,
    normalizedTranscript,
    segments,
    resolvedUtterance,
    clauses,
    slots,
    missingSlots,
    interpretedAnswer,
    canonicalAnswer,
    confidence,
    issueType,
    teacherRepairHint: teacherRepairHint ?? undefined,
    debug: {
      selfCorrected,
      clauseTypes:     clauses.map(c => c.type),
      requiredSlots,
      presentSlots:    slots.map(s => s.slot),
    },
  }
}
