// Teacher Brain Isolation Layer
//
// Enforces the strict verbal-only contract for the AI Teacher Brain.
// AI reads state as advisory context; it NEVER controls progression, validation,
// or exercise structure. Backend systems are the sole source of truth.

// ── Input/Output contracts ────────────────────────────────────────────────────

export type TeacherResponseGoal =
  | 'greet'
  | 'introduce_exercise'
  | 'explain_task'
  | 'correct_attempt'
  | 'encourage_correct'
  | 'give_hint'
  | 'clarify_confusion'
  | 'transition_phrase'
  | 'summarize_completion'

export type ValidationAlignmentResult =
  | 'CORRECT'
  | 'PARTIAL'
  | 'INCORRECT'
  | 'ACCEPTABLE_STT'
  | 'OPEN_ENDED_REVIEW_REQUIRED'
  | null

export interface TeacherBrainInputContract {
  lessonState: {
    phase: string
    currentExerciseNum: number
    itemIndex: number
    correctionTurn: string | null
    activeExerciseType: string | undefined
  }
  engineCursor?: {
    exerciseNumber: number
    exerciseType: string
    currentItem: string
    itemIndex: number
    itemTotal: number
  } | null
  validationResult: ValidationAlignmentResult
  currentStep: string | null
  studentAnswer: string | null
  allowedResponseGoal: TeacherResponseGoal
}

export interface TeacherBrainOutputContract {
  teacherText: string
  tone?: 'calm' | 'encouraging' | 'corrective'
}

// ── Forbidden output fields ────────────────────────────────────────────────────
//
// If these appear in AI JSON output, they must be stripped and the violation logged.
// AI must never return these as authoritative values — only backend systems may set them.

export const FORBIDDEN_AI_OUTPUT_FIELDS = [
  'nextExerciseId',
  'nextItemId',
  'isCorrect',
  'allowProgression',
  'completedExercise',
  'frontendState',
  'validationOverride',
] as const satisfies readonly string[]

// ── Audit helper ───────────────────────────────────────────────────────────────
//
// Call after parsing AI JSON. Logs a warning for each forbidden field present.
// Does not throw — isolation is enforced at the call site, not here.

export function auditAIResponseForControlFields(
  raw: Record<string, unknown>,
  lessonId: string,
  phase: string,
): void {
  const violations: string[] = []
  for (const field of FORBIDDEN_AI_OUTPUT_FIELDS) {
    if (field in raw && raw[field] !== null && raw[field] !== undefined) {
      violations.push(field)
    }
  }
  if (violations.length > 0) {
    console.warn(
      `[teacher_brain:isolation] control_fields_ignored` +
      ` fields=[${violations.join(', ')}]` +
      ` phase=${phase} lessonId=${lessonId}`,
    )
  }
}

// ── State-aware safe fallbacks ─────────────────────────────────────────────────
//
// Replaces generic "I'm thinking..." / "Go ahead." fallback messages.
// Stays focused on the current backend cursor state.

export function buildSafeFallback(
  phase: string,
  currentItem: string | null | undefined,
  exerciseNum: number,
  correctionTurn: string | null | undefined,
): string {
  if (correctionTurn) {
    return `Let's stay on this item. Try once more.`
  }
  if (phase === 'EXERCISES' && currentItem) {
    const cleanItem = currentItem.replace(/^\d+[.)]\s*/, '').trim()
    return `Let's continue. ${cleanItem}`
  }
  if (phase === 'EXERCISES' && exerciseNum > 0) {
    return `Let's continue with Exercise ${exerciseNum}.`
  }
  return `Let's continue.`
}

// ── Response goal inference ────────────────────────────────────────────────────
//
// Derives the appropriate TeacherResponseGoal from the current validation state.
// Used for logging and prompt goal injection.

export function inferResponseGoalFromValidation(
  correctionTurn: string | null,
  hasValidation: boolean,
  isCorrect: boolean,
): TeacherResponseGoal {
  if (!hasValidation) return 'clarify_confusion'
  if (isCorrect) return 'encourage_correct'
  if (correctionTurn) return 'give_hint'
  return 'correct_attempt'
}
