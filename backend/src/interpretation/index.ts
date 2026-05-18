// ── Interpretation Module ─────────────────────────────────────────────────────
// Public API for the spoken-answer interpretation pipeline.
//
// Primary use:
//   import { interpretSpokenAnswer } from '../interpretation/index.js'
//
// The pipeline is deterministic — no AI calls.
// Produces SpokenInterpretationResult used by:
//   - soft-speaking-validator.ts (slot-based progression gate)
//   - lesson-ws.ts (grammar-fill voice canonical answer)
//   - Teacher Brain context (interpreted meaning, repair hints)

export { interpretSpokenAnswer } from './spoken-answer-interpreter.js'
export type {
  SpokenInterpretationInput,
  SpokenInterpretationResult,
  AnswerSlot,
  ExtractedClause,
  ExtractedSlot,
  ClauseType,
  InterpretationIssueType,
} from './types.js'
