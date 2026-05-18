// Teaching Mode Runtime — defines and detects the current pedagogical mode.
// The runtime mode shapes which behavioral constraints and context blocks apply.

export type TeachingMode =
  | 'INSTRUCTION'    // First introduction: exercise + format + example + item 1
  | 'DEMONSTRATION'  // Showing an example before student produces
  | 'STUDENT_TASK'   // Student's turn: item presented, waiting for answer
  | 'HINT'           // Correction turn B or C — escalating guidance
  | 'CORRECTION'     // Correction turn A — first wrong attempt
  | 'RETRY'          // Correction turn D — reveal + ask student to repeat
  | 'TRANSITION'     // Moving between items or exercises

export interface TeachingModeInput {
  itemIndex:          number
  correctionTurn:     string | null
  completedItemCount: number
  exerciseCompleted:  boolean
  isUnsupported:      boolean
  runtimeMode:        string
}

export function detectTeachingMode(input: TeachingModeInput): TeachingMode {
  if (input.exerciseCompleted || input.isUnsupported) return 'TRANSITION'

  if (input.runtimeMode === 'grammar_explanation' ||
      input.runtimeMode === 'teacher_explanation') {
    return 'INSTRUCTION'
  }

  if (input.runtimeMode === 'soft_speaking' ||
      input.runtimeMode === 'warmup_activation') {
    // Soft exercises: no correction ladder — always STUDENT_TASK after introduction
    if (input.itemIndex === 0 && input.completedItemCount === 0 && !input.correctionTurn) {
      return 'INSTRUCTION'
    }
    return 'STUDENT_TASK'
  }

  // Deterministic and matching exercises
  if (!input.correctionTurn) {
    if (input.itemIndex === 0 && input.completedItemCount === 0) {
      return 'INSTRUCTION'
    }
    return 'STUDENT_TASK'
  }

  switch (input.correctionTurn) {
    case 'A': return 'CORRECTION'
    case 'B': return 'HINT'
    case 'C': return 'HINT'
    case 'D': return 'RETRY'
    default:  return 'STUDENT_TASK'
  }
}

export function describeModeForContext(mode: TeachingMode): string {
  switch (mode) {
    case 'INSTRUCTION':   return 'INTRODUCE exercise: name + instruction + one example + item 1'
    case 'DEMONSTRATION': return 'DEMONSTRATE: one example (different item) + return to item 1'
    case 'STUDENT_TASK':  return 'AWAIT answer: item is visible — do NOT re-read it'
    case 'CORRECTION':    return 'CORRECTION TURN A: one guiding question, zero answer content'
    case 'HINT':          return 'CORRECTION TURN B/C: escalating hint — structural guidance'
    case 'RETRY':         return 'CORRECTION TURN D: reveal full answer + ask to repeat'
    case 'TRANSITION':    return 'TRANSITION: confirm completion + introduce next exercise'
  }
}
