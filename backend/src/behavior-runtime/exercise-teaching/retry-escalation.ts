// Retry Escalation — produces varied, evolving hint content per exercise type and correction turn.
//
// Every retry must introduce:
//   A: New framing (identify the knowledge gap — ask, don't tell)
//   B: New information (structural rule or category — not the answer)
//   C: Narrowed focus (almost the answer — first letter/word/pattern)
//   D: Controlled reveal (full answer + brief rule + request to repeat)
//
// Matching exercises have shorter ladders: reveal on B.

import { getHintPolicy, getRetryPolicy } from './exercise-format-registry.js'

export interface RetryEscalationInput {
  exerciseType:    string
  correctionTurn:  'A' | 'B' | 'C' | 'D'
  currentItem:     string
  studentAnswer:   string
  correctAnswer:   string  // teacher-only — only included in output at turn D
  itemIndex:       number
  runtimeMode:     string
}

export interface RetryEscalationResult {
  hint:         string   // Specific guidance for this turn
  instruction:  string   // Constraint block for prompt injection
  shouldReveal: boolean
}

export function buildRetryEscalation(input: RetryEscalationInput): RetryEscalationResult {
  const { exerciseType, correctionTurn, currentItem, studentAnswer, correctAnswer, runtimeMode } = input
  const hintPolicy  = getHintPolicy(exerciseType)
  const retryPolicy = getRetryPolicy(exerciseType)

  const shouldReveal = correctionTurn === 'D' || (correctionTurn === 'B' && hintPolicy.revealOnTurn === 'B')

  const hintMap: Record<string, string> = {
    A: hintPolicy.turnA,
    B: hintPolicy.turnB,
    C: hintPolicy.turnC,
    D: hintPolicy.turnD,
  }

  const rawHint = hintMap[correctionTurn] ?? hintPolicy.turnA

  const lines: string[] = [
    `── RETRY ESCALATION (TURN ${correctionTurn}) ──`,
    `Student answered: "${studentAnswer}"`,
    `Current item: "${currentItem.slice(0, 80)}${currentItem.length > 80 ? '...' : ''}"`,
    '',
    `TURN ${correctionTurn} STRATEGY: ${rawHint}`,
    '',
  ]

  if (shouldReveal) {
    lines.push(
      `REVEAL REQUIRED: Say "The answer is ${correctAnswer}." + brief rule + ask student to repeat.`,
      `After student repeats correctly: confirm once and advance to next item.`,
    )
  } else {
    lines.push(`Do NOT reveal the answer yet. Hint only.`)
  }

  // Escalation notes
  const escalationNote = retryPolicy.escalationNotes[
    correctionTurn === 'A' ? 0 :
    correctionTurn === 'B' ? 1 :
    correctionTurn === 'C' ? 2 : 3
  ]
  if (escalationNote) {
    lines.push(`Escalation note: ${escalationNote}`)
  }

  // Anti-repetition — never reuse the same hint phrasing as turn A
  if (correctionTurn !== 'A') {
    lines.push(
      `⚠ CHANGE THE FRAMING — do NOT re-ask the same question from Turn A.`,
      `Turn A targeted: [grammar knowledge gap]. Turn ${correctionTurn} must approach from a DIFFERENT angle.`,
    )
  }

  // Closing requirement for turns A/B/C
  if (!shouldReveal) {
    lines.push(
      `CLOSING REQUIREMENT: After your hint, end with: "Try again — [item]" so student knows what to answer.`,
    )
  }

  return {
    hint:         rawHint,
    instruction:  lines.join('\n'),
    shouldReveal,
  }
}

// ── Opening instruction builder ───────────────────────────────────────────────
// Returns the type-specific opening instruction for the first presentation of an exercise.

import { getTeacherInstructionPolicy } from './exercise-format-registry.js'

export function buildOpeningInstruction(
  exerciseType: string,
  exerciseNumber: number,
): string {
  const policy = getTeacherInstructionPolicy(exerciseType)
  const opening = policy.openingTemplate.replace('{N}', String(exerciseNumber))
  const lines: string[] = [
    `── EXERCISE OPENING (Exercise ${exerciseNumber}) ──`,
    `Opening: "${opening}"`,
    `Answer format: "${policy.answerFormatSpec}"`,
    `Forbidden at intro:`,
    ...policy.forbiddenAtIntro.map(f => `  • ${f}`),
  ]
  return lines.join('\n')
}
