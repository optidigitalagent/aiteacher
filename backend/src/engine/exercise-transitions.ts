// ── Exercise Transition Rules ─────────────────────────────────────────────────
// Determines what happens when an exercise ends and what comes next.
// Pure functions — no side effects, no Redis, no AI calls.

import type {
  ExerciseSpec,
  EngineLessonState,
  TransitionContext,
  EngineAction,
} from './types.js'
import { filterAvailableExercises } from './exercise-loader.js'

// ── Find the next exercise to run ─────────────────────────────────────────────

export function findNextExercise(ctx: TransitionContext): ExerciseSpec | null {
  const { queue, currentIndex, completedExerciseNumbers } = ctx

  // Start searching after current position
  const remaining = queue.slice(currentIndex + 1)

  // Filter out exercises blocked by unmet dependencies
  const available = filterAvailableExercises(remaining, completedExerciseNumbers)

  return available[0] ?? null
}

// ── Determine engine action after step result ─────────────────────────────────

export interface StepOutcome {
  correct: boolean
  shouldReveal: boolean
  isLastStep: boolean
  isSkipped: boolean
}

export function resolveEngineAction(outcome: StepOutcome): EngineAction {
  if (outcome.isSkipped) return 'exercise_skipped'

  if (!outcome.correct && !outcome.shouldReveal) return 'step_wrong'

  if (outcome.shouldReveal) return 'step_revealed'

  if (outcome.isLastStep) return 'exercise_complete'

  return 'step_correct'
}

// ── Check if all exercises are done ──────────────────────────────────────────

export function isLessonComplete(state: EngineLessonState): boolean {
  const { exerciseQueue, completedExerciseIds, skippedExerciseIds } = state
  const doneIds = new Set([...completedExerciseIds, ...skippedExerciseIds])
  return exerciseQueue.every(ex => doneIds.has(ex.exerciseId))
}

// ── Resolve completed exercise numbers list ───────────────────────────────────
// Used by dependency checks: which exercise NUMBERS have been completed.

export function resolveCompletedExerciseNumbers(state: EngineLessonState): number[] {
  const completedSet = new Set(state.completedExerciseIds)
  return state.exerciseQueue
    .filter(ex => completedSet.has(ex.exerciseId))
    .map(ex => ex.meta.exerciseNumber)
}

// ── Auto-advance unsupported exercise ─────────────────────────────────────────

export function shouldAutoSkip(spec: ExerciseSpec): boolean {
  return spec.meta.runtimeMode === 'unsupported'
}

// ── Validate that exercise dependencies are met ───────────────────────────────

export function canStartExercise(spec: ExerciseSpec, completedExerciseNumbers: number[]): boolean {
  if (!spec.meta.dependsOn) return true
  return completedExerciseNumbers.includes(spec.meta.dependsOn)
}
