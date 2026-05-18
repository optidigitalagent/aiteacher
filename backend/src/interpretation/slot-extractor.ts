// ── Slot Extractor ────────────────────────────────────────────────────────────
// Extracts required answer slots from classified clauses.
// This is the authoritative source of slot presence/absence.
//
// CRITICAL — Reason slot rule:
//   Reason MUST come from a causal_clause or explanatory_clause.
//   "Anita inspired me." → subject present, reason ABSENT.
//   "Anita inspired me because she worked hard." → subject + reason present.
//   "Anita inspired me. She never gave up." → subject + reason present.
//   "I like X." → subject present, reason ABSENT (no causal connector).

import type { AnswerSlot, ExtractedClause, ExtractedSlot } from './types.js'

// Words that are NOT entity names for subject detection
const STOPWORDS = new Set([
  'i', 'me', 'my', 'he', 'she', 'they', 'it', 'we', 'you', 'his', 'her', 'their',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'am',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'and', 'or', 'but', 'so',
  'that', 'this', 'as', 'do', 'does', 'did',
  'not', 'no', 'may', 'can', 'will', 'would', 'could', 'should',
])

const NON_NAME_WORDS = new Set([
  'may', 'can', 'will', 'would', 'could', 'should', 'shall', 'must', 'might',
  'inspire', 'inspires', 'inspired', 'inspiring', 'admire', 'admires', 'admired',
  'not', 'also', 'very', 'really', 'quite', 'just', 'only', 'even', 'still',
  'like', 'think', 'know', 'want', 'need', 'feel', 'see', 'look', 'make', 'take',
  'said', 'say', 'tell', 'told', 'get', 'got', 'put', 'give', 'gave',
  'has', 'had', 'have', 'having', 'been', 'being', 'thing', 'things',
  'never', 'always', 'sometimes', 'often', 'hard', 'work', 'works',
])

const PREFERENCE_MARKERS = new Set([
  'like', 'likes', 'love', 'loves', 'enjoy', 'enjoys', 'prefer', 'prefers',
  'favourite', 'favorite', 'hate', 'hates', 'dislike', 'dislikes',
  'interested', 'keen', 'passionate',
])

const TIME_MARKERS = new Set([
  'now', 'currently', 'today', 'yesterday', 'moment', 'lately', 'recently',
  'present', 'week', 'month',
])

const PLACE_PREPOSITIONS = ['at ', 'in ', 'near ', 'outside ', 'inside ']

const QUESTION_STARTERS = new Set([
  'what', 'who', 'where', 'when', 'why', 'how',
  'do', 'does', 'did', 'can', 'could', 'would', 'will',
  'is', 'are', 'have', 'has',
])

function semanticWordCount(words: string[]): number {
  return words.filter(w => w.length > 1 && !STOPWORDS.has(w)).length
}

function isNameCandidate(word: string): boolean {
  return word.length > 1 && !STOPWORDS.has(word) && !NON_NAME_WORDS.has(word)
}

// ── Per-slot extractors ───────────────────────────────────────────────────────

function extractSubject(clauses: ExtractedClause[]): ExtractedSlot | null {
  // Primary search: main_statement and answer_fragment
  // Also search causal_clause — the subject appears before "because" in single-sentence answers
  // e.g. "Anita inspired me because she worked hard." → entire clause is causal_clause
  const candidates = clauses.filter(
    c => c.type === 'main_statement' || c.type === 'answer_fragment' || c.type === 'causal_clause',
  )
  for (const clause of candidates) {
    const words = clause.normalized.split(/\s+/).filter(Boolean)
    const name  = words.find(isNameCandidate)
    if (name) {
      return { slot: 'subject', value: name, confidence: 0.85, sourceClause: clause.text }
    }
  }
  return null
}

function extractReason(clauses: ExtractedClause[]): ExtractedSlot | null {
  // Reason ONLY from causal or explanatory clause — never from main_statement alone
  const reasonClause = clauses.find(
    c => c.type === 'causal_clause' || c.type === 'explanatory_clause',
  )
  if (!reasonClause) return null
  const words    = reasonClause.normalized.split(/\s+/).filter(Boolean)
  const semWords = semanticWordCount(words)
  if (semWords < 1) return null
  return { slot: 'reason', value: reasonClause.text, confidence: 0.9, sourceClause: reasonClause.text }
}

function extractPreference(clauses: ExtractedClause[]): ExtractedSlot | null {
  for (const clause of clauses) {
    const words   = clause.normalized.split(/\s+/).filter(Boolean)
    const prefWord = words.find(w => PREFERENCE_MARKERS.has(w))
    if (prefWord) {
      return { slot: 'preference', value: clause.text, confidence: 0.85, sourceClause: clause.text }
    }
  }
  return null
}

function extractTime(clauses: ExtractedClause[]): ExtractedSlot | null {
  for (const clause of clauses) {
    const words    = clause.normalized.split(/\s+/).filter(Boolean)
    const timeWord = words.find(w => TIME_MARKERS.has(w))
    if (timeWord) {
      return { slot: 'time', value: timeWord, confidence: 0.85, sourceClause: clause.text }
    }
  }
  return null
}

function extractPlace(clauses: ExtractedClause[]): ExtractedSlot | null {
  for (const clause of clauses) {
    const norm = clause.normalized
    for (const prep of PLACE_PREPOSITIONS) {
      if (norm.includes(prep)) {
        return { slot: 'place', value: clause.text, confidence: 0.8, sourceClause: clause.text }
      }
    }
  }
  return null
}

function extractQuestion(clauses: ExtractedClause[]): ExtractedSlot | null {
  const qClause = clauses.find(c => c.type === 'question_attempt')
  if (qClause) {
    return { slot: 'question', value: qClause.text, confidence: 0.9, sourceClause: qClause.text }
  }
  for (const clause of clauses) {
    if (clause.text.includes('?')) {
      return { slot: 'question', value: clause.text, confidence: 0.8, sourceClause: clause.text }
    }
    const firstWord = clause.normalized.split(/\s+/)[0] ?? ''
    if (QUESTION_STARTERS.has(firstWord)) {
      return { slot: 'question', value: clause.text, confidence: 0.75, sourceClause: clause.text }
    }
  }
  return null
}

function extractObject(clauses: ExtractedClause[]): ExtractedSlot | null {
  for (const clause of clauses) {
    if (clause.type !== 'main_statement' && clause.type !== 'answer_fragment') continue
    const words = clause.normalized.split(/\s+/).filter(Boolean)
    if (semanticWordCount(words) >= 2) {
      return { slot: 'object', value: clause.text, confidence: 0.7, sourceClause: clause.text }
    }
  }
  return null
}

function extractAnswer(clauses: ExtractedClause[]): ExtractedSlot | null {
  for (const clause of clauses) {
    if (clause.type === 'filler' || clause.type === 'correction_fragment') continue
    const words = clause.normalized.split(/\s+/).filter(Boolean)
    if (semanticWordCount(words) >= 2) {
      return { slot: 'answer', value: clause.text, confidence: 0.7, sourceClause: clause.text }
    }
  }
  return null
}

// ── Main export ───────────────────────────────────────────────────────────────

export function extractSlots(
  clauses:       ExtractedClause[],
  requiredSlots: AnswerSlot[],
): { slots: ExtractedSlot[]; missingSlots: AnswerSlot[] } {
  const extractors: Partial<Record<AnswerSlot, () => ExtractedSlot | null>> = {
    subject:    () => extractSubject(clauses),
    reason:     () => extractReason(clauses),
    preference: () => extractPreference(clauses),
    object:     () => extractObject(clauses),
    time:       () => extractTime(clauses),
    place:      () => extractPlace(clauses),
    question:   () => extractQuestion(clauses),
    answer:     () => extractAnswer(clauses),
    // auxiliary, verb, option — grammar-fill specific, resolved at interpreter level
    auxiliary:  () => null,
    verb:       () => null,
    option:     () => null,
  }

  const slots:        ExtractedSlot[] = []
  const missingSlots: AnswerSlot[]    = []

  for (const slot of requiredSlots) {
    const extractor = extractors[slot]
    const result    = extractor ? extractor() : null
    if (result) {
      slots.push(result)
    } else {
      missingSlots.push(slot)
    }
  }

  return { slots, missingSlots }
}
