// ── Clause Extractor ─────────────────────────────────────────────────────────
// Classifies each sentence segment into a clause type.
// Clause type determines which slots can be satisfied by that clause.
//
// Reason slot MUST come from causal_clause or explanatory_clause.
// "Anita inspired me." alone → main_statement only → no reason.
// "Anita inspired me because she worked hard." → main_statement + causal_clause.
// "Anita inspired me. She never gave up." → main_statement + explanatory_clause.

import type { ExtractedClause, ClauseType } from './types.js'
import { normalizeTranscript } from './transcript-normalizer.js'

// Causal connectors that mark a reason clause
const CAUSAL_CONNECTOR_RE = /\b(because|since|due\s+to|that\s*'?s\s+why|that\s+is\s+why)\b/i
// Causal "so" before a subject pronoun ("so I", "so she") — not intensifier "so kind"
const CAUSAL_SO_RE = /\bso\s+(i|he|she|they|it|we|you)\b/i
// Causal "as" as conjunction before pronoun ("as he is kind") — not inside "class"/"has"
const CAUSAL_AS_RE = /\bas\s+(he|she|they|it|i|we|you)\b/i

// Third-person pronoun at start → explanatory clause after main_statement
const THIRD_PERSON_START_RE = /^(he|she|they|it)\b/i
// Question-word starters
const QUESTION_START_RE = /^(what|who|where|when|why|how|do|does|did|can|could|would|will|is|are|have|has)\b/i
// Correction markers
const CORRECTION_MARKER_RE = /^(not\s+\S|sorry\s*$|no\s*,?\s*$)/i
// Pure filler
const FILLER_RE = /^(ok|okay|yes|yeah|sure|right|fine|good|great|alright|um|uh|hmm|well|mm)\s*$/i

function classifyClause(
  text: string,
  normalized: string,
  prevType: ClauseType | null,
): ClauseType {
  if (FILLER_RE.test(normalized)) return 'filler'
  if (CORRECTION_MARKER_RE.test(normalized)) return 'correction_fragment'
  if (QUESTION_START_RE.test(normalized)) return 'question_attempt'

  if (
    CAUSAL_CONNECTOR_RE.test(normalized) ||
    CAUSAL_SO_RE.test(normalized) ||
    CAUSAL_AS_RE.test(normalized)
  ) {
    return 'causal_clause'
  }

  // After a main_statement, a clause starting with a 3rd-person pronoun = explanatory reason
  if (prevType === 'main_statement' && THIRD_PERSON_START_RE.test(normalized)) {
    const words = normalized.split(/\s+/).filter(Boolean)
    // Must have at least 2 words beyond the pronoun to count as a real explanatory clause
    if (words.length >= 3) return 'explanatory_clause'
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length
  if (wordCount < 3) return 'answer_fragment'

  return 'main_statement'
}

export function extractClauses(rawTranscript: string): ExtractedClause[] {
  const segments = rawTranscript
    .trim()
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  const clauses: ExtractedClause[] = []
  let prevType: ClauseType | null = null

  for (const seg of segments) {
    const norm = normalizeTranscript(seg)
    if (!norm) continue
    const type = classifyClause(seg, norm, prevType)
    clauses.push({ type, text: seg, normalized: norm })
    prevType = type
  }

  return clauses
}
