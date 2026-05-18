// ── Interpretation Types ──────────────────────────────────────────────────────
// Formal types for the spoken-answer interpretation pipeline.
// The pipeline runs before validation/progression decisions.
// No AI calls — deterministic only.

export type AnswerSlot =
  | 'subject'
  | 'reason'
  | 'object'
  | 'answer'
  | 'question'
  | 'auxiliary'
  | 'verb'
  | 'option'
  | 'place'
  | 'time'
  | 'preference'

export type ClauseType =
  | 'main_statement'
  | 'causal_clause'
  | 'explanatory_clause'
  | 'answer_fragment'
  | 'question_attempt'
  | 'correction_fragment'
  | 'filler'
  | 'off_task'

export type InterpretationIssueType =
  | 'clear'
  | 'missing_slot'
  | 'broken_grammar'
  | 'pronunciation_or_stt'
  | 'self_correction'
  | 'off_task'
  | 'too_short'
  | 'unclear'

export interface ExtractedClause {
  type:       ClauseType
  text:       string
  normalized: string
}

export interface ExtractedSlot {
  slot:         AnswerSlot
  value:        string
  confidence:   number
  sourceClause: string
}

export interface SpokenInterpretationInput {
  rawTranscript:    string
  exerciseType:     string
  instruction?:     string
  itemText?:        string
  expectedAnswer?:  string
  acceptedAnswers?: string[]
  knownEntities?:   string[]
  requiredSlots?:   AnswerSlot[]
  attemptCount?:    number
  inputMode?:       'voice' | 'text'
}

export interface SpokenInterpretationResult {
  rawTranscript:        string
  normalizedTranscript: string
  segments:             string[]
  resolvedUtterance:    string
  clauses:              ExtractedClause[]
  slots:                ExtractedSlot[]
  missingSlots:         AnswerSlot[]
  interpretedAnswer?:   string
  canonicalAnswer?:     string
  confidence:           number
  issueType:            InterpretationIssueType
  teacherRepairHint?:   string
  debug:                Record<string, unknown>
}
