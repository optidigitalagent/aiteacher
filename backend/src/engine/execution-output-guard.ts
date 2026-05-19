// ── Exercise Execution Output Guard ──────────────────────────────────────────
// Validates teacher AI response against the active exercise execution state.
//
// Complements stale-item-guard.ts (which handles item-number patterns) by catching
// EXERCISE-level violations:
//   • Announcing an inactive exercise number ("Exercise 2/3/4")
//   • Claiming visible content is missing when payload is present
//   • Premature completion/transition claims without engine signal
//
// Authority contract:
//   Engine/canonical cursor → single source of active exercise truth.
//   Teacher text cannot transition exercises.
//   This guard enforces that contract at the output boundary.

import { loadEngineState } from './exercise-sync.js'
import type { EngineExerciseState } from './types.js'

// ── Execution State Contract ──────────────────────────────────────────────────

export interface VisiblePayloadStatus {
  hasVisiblePayload: boolean
  hasReadingText:    boolean
  hasTextBlocks:     boolean
  hasOptions:        boolean
  payloadFields:     string[]
}

export interface ExerciseExecutionState {
  lessonId:             string
  phase:                'EXERCISES'
  activeExerciseId:     string
  activeExerciseNumber: number
  activeExerciseType:   string
  activeExerciseTitle:  string
  activeItemIndex:      number
  itemTotal:            number
  currentItemText:      string
  cursorVersion:        number
  visiblePayloadStatus: VisiblePayloadStatus
}

// ── Builder — reads from engine only, never from LessonState ─────────────────

export async function buildExerciseExecutionState(
  lessonId: string,
): Promise<ExerciseExecutionState | null> {
  try {
    const engState = await loadEngineState(lessonId)
    if (!engState?.currentExerciseState) return null
    const exState = engState.currentExerciseState
    if (exState.status !== 'active') return null

    const spec  = exState.spec
    const step  = spec.steps[exState.currentStepIndex]

    const hasReadingText = !!(spec.readingText)
    const hasTextBlocks  = !!(spec.textBlocks && spec.textBlocks.length > 0)
    const hasOptions     = !!(spec.options && spec.options.length > 0)

    const payloadFields: string[] = []
    if (hasReadingText) payloadFields.push('readingText')
    if (hasTextBlocks)  payloadFields.push(`textBlocks=${spec.textBlocks!.length}`)
    if (hasOptions)     payloadFields.push(`options=${spec.options!.length}`)
    if (spec.promptCards?.length)  payloadFields.push(`promptCards=${spec.promptCards.length}`)
    if (spec.statements?.length)   payloadFields.push(`statements=${spec.statements.length}`)

    return {
      lessonId,
      phase:                'EXERCISES',
      activeExerciseId:     spec.exerciseId,
      activeExerciseNumber: spec.meta.exerciseNumber,
      activeExerciseType:   spec.exerciseType,
      activeExerciseTitle:  spec.title,
      activeItemIndex:      exState.currentStepIndex,
      itemTotal:            spec.steps.length,
      currentItemText:      step?.question ?? '',
      cursorVersion:        engState.cursorVersion ?? 0,
      visiblePayloadStatus: {
        hasVisiblePayload: hasReadingText || hasTextBlocks || hasOptions,
        hasReadingText,
        hasTextBlocks,
        hasOptions,
        payloadFields,
      },
    }
  } catch {
    return null
  }
}

// ── Execution State Prompt Block ──────────────────────────────────────────────
// Injected above engine prompt context in every EXERCISES-phase AI turn.
// This is the single strongest instruction that prevents inactive exercise claims.

export function buildExecutionStatePromptBlock(state: ExerciseExecutionState): string {
  const { activeExerciseNumber, activeExerciseType, activeItemIndex, itemTotal, currentItemText } = state
  const { hasReadingText, hasTextBlocks, hasOptions, payloadFields } = state.visiblePayloadStatus

  const payloadLine = payloadFields.length > 0 ? payloadFields.join(', ') : 'none'

  const forbiddenLines: string[] = [
    `• Do NOT announce, introduce, reference, or mention Exercise ${activeExerciseNumber + 1} or any higher exercise number.`,
    `• Only Exercise #${activeExerciseNumber} is active. No other exercise exists for you this turn.`,
    `• Do NOT complete or skip Exercise ${activeExerciseNumber} unless engine [EXERCISE RESULT] says so.`,
    `• Do NOT return to old items. Active item is #${activeItemIndex + 1}: "${currentItemText}".`,
  ]

  if (hasOptions || hasTextBlocks || hasReadingText) {
    forbiddenLines.push(`• Do NOT claim content is missing — visible payload is present: ${payloadLine}`)
  }
  if (!hasReadingText && !hasTextBlocks && activeExerciseType === 'phrase_classification') {
    forbiddenLines.push(`• This exercise has NO reading text. Do NOT say "look at the text" or "the text says".`)
  }

  return [
    `=== STRICT EXERCISE EXECUTION STATE (engine-authoritative — highest priority) ===`,
    `Active exercise: #${activeExerciseNumber} ${activeExerciseType} "${currentItemText && currentItemText.slice(0, 60)}"`,
    `Active item: ${activeItemIndex + 1}/${itemTotal} | Visible payload: ${payloadLine || 'instruction + items only'}`,
    ``,
    `FORBIDDEN THIS TURN:`,
    ...forbiddenLines,
    `=== END STRICT EXECUTION STATE ===`,
  ].join('\n')
}

// ── Output Guard ──────────────────────────────────────────────────────────────

export type ViolationType =
  | 'inactive_exercise_claim'
  | 'missing_content_claim'
  | 'premature_completion_claim'
  | null

export interface ExecutionGuardResult {
  safe:          boolean
  text:          string
  violation:     string | null
  violationType: ViolationType
}

// Matches "Exercise N" — any exercise number reference
const EXERCISE_NUM_RE = /\bExercise\s+(\d{1,2})\b/gi

// Matches "let's move to Exercise N", "now Exercise N", "Next is Exercise N"
const TRANSITION_TO_EXERCISE_RE =
  /\b(?:(?:let'?s|now)\s+(?:move\s+(?:on\s+)?to|do|go\s+to|continue\s+with|start)\s+Exercise\s+(\d{1,2})|next\s+(?:is\s+)?Exercise\s+(\d{1,2})|move\s+(?:on\s+)?to\s+Exercise\s+(\d{1,2}))\b/gi

// Matches "Exercise N is done", "we've finished Exercise N", "that completes Exercise N"
const EXERCISE_COMPLETE_RE =
  /\b(?:Exercise\s+\d+\s+(?:is\s+)?(?:done|complete[d]?|finished|over)|(?:that\s+completes?|we(?:'ve)?\s+finished|we\s+have\s+finished)\s+Exercise\s+\d+)\b/gi

// Matches claims about invisible / missing content
const MISSING_CONTENT_RE =
  /(?:(?:text|reading|passage|article|content|exercise|section)\s+(?:is\s+)?(?:not\s+)?(?:loaded|missing|unavailable|not\s+visible|cannot\s+be\s+(?:seen|loaded|done))|cannot\s+do\s+this\s+(?:safely\s+)?(?:exercise\s+)?(?:because\s+of\s+)?missing|this\s+(?:section|reading|exercise)\s+(?:is|isn'?t)\s+(?:fully\s+)?(?:loaded|ready|available)|not\s+fully\s+loaded|we\s+can'?t\s+(?:see|do|access)\s+the\s+(?:text|reading|content)|remaining\s+exercises\s+are\s+unsupported)/gi

export function guardExecutionOutput(
  text:   string,
  state:  ExerciseExecutionState | null,
  phase:  string,
): ExecutionGuardResult {
  if (phase !== 'EXERCISES' || !state) {
    return { safe: true, text, violation: null, violationType: null }
  }

  const { activeExerciseNumber, activeItemIndex, currentItemText } = state
  const { hasReadingText, hasTextBlocks, hasOptions }              = state.visiblePayloadStatus

  let rewritten     = text
  let violation:     string | null  = null
  let violationType: ViolationType  = null

  // ── Pass 1: Transition to inactive exercise ───────────────────────────────
  rewritten = rewritten.replace(TRANSITION_TO_EXERCISE_RE, (match) => {
    const nums = [...match.matchAll(/\d+/g)].map(m => parseInt(m[0], 10))
    if (nums.some(n => n !== activeExerciseNumber)) {
      violation     ??= match
      violationType ??= 'inactive_exercise_claim'
      return `Let's stay on Exercise ${activeExerciseNumber}`
    }
    return match
  })

  // ── Pass 2: Exercise completion without engine signal ─────────────────────
  rewritten = rewritten.replace(EXERCISE_COMPLETE_RE, (match) => {
    const nums = [...match.matchAll(/\d+/g)].map(m => parseInt(m[0], 10))
    if (nums.some(n => n !== activeExerciseNumber)) {
      violation     ??= match
      violationType ??= 'premature_completion_claim'
      return `We're still on Exercise ${activeExerciseNumber}`
    }
    // Even for active exercise, flag if engine didn't send complete signal
    violation     ??= match
    violationType ??= 'premature_completion_claim'
    return `We're still on Exercise ${activeExerciseNumber}`
  })

  // ── Pass 3: Any inactive exercise number mention ──────────────────────────
  rewritten = rewritten.replace(EXERCISE_NUM_RE, (match, numStr) => {
    const n = parseInt(numStr, 10)
    if (n !== activeExerciseNumber) {
      violation     ??= match
      violationType ??= 'inactive_exercise_claim'
      // Replace the number only — surrounding text may still be relevant
      return `Exercise ${activeExerciseNumber}`
    }
    return match
  })

  // ── Pass 4: Missing content claim when payload is present ─────────────────
  const hasContent = hasOptions || hasTextBlocks || hasReadingText
  if (hasContent) {
    const missingMatch = rewritten.match(MISSING_CONTENT_RE)
    if (missingMatch) {
      violation     ??= missingMatch[0]
      violationType ??= 'missing_content_claim'
      rewritten = rewritten.replace(MISSING_CONTENT_RE, '(content is visible on screen)')
    }
  }

  if (violation !== null) {
    // Append canonical anchor when inactive exercise was claimed, ensuring
    // student hears the correct exercise and item regardless of rewrite quality.
    const capturedType = violationType as ViolationType
    if (capturedType === 'inactive_exercise_claim' && currentItemText) {
      const alreadyHasItem = rewritten.includes(currentItemText.slice(0, 15))
      if (!alreadyHasItem) {
        rewritten = rewritten.trimEnd()
        rewritten += `. Let's continue with Exercise ${activeExerciseNumber} — Number ${activeItemIndex + 1}: "${currentItemText}"`
      }
    }
    return { safe: false, text: rewritten.trim(), violation, violationType }
  }

  return { safe: true, text, violation: null, violationType: null }
}
