// ── Step Progression Manager ──────────────────────────────────────────────────
// Controls movement between steps and exercises.
// All advancement is driven by explicit events (correct answer, skip, auto).
// GPT never calls these methods directly.

import { v4 as uuid } from 'uuid'
import type {
  EngineExerciseState,
  ExerciseSpec,
  StepAttempt,
  EngineValidationResult,
  ExerciseStatus,
} from './types.js'

// ── Factory: initialise fresh exercise state ──────────────────────────────────

export function initExerciseState(spec: ExerciseSpec): EngineExerciseState {
  return {
    exerciseId:     spec.exerciseId,
    spec,
    currentStepIndex: 0,
    completedSteps: [],
    failedSteps:    [],
    stepAttempts:   [],
    retryCount:     0,
    hintsGiven:     0,
    status:         spec.meta.runtimeMode === 'unsupported' ? 'skipped' : 'active',
    startedAt:      new Date().toISOString(),
  }
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function getCurrentStep(state: EngineExerciseState) {
  return state.spec.steps[state.currentStepIndex] ?? null
}

export function isExerciseComplete(state: EngineExerciseState): boolean {
  if (state.status === 'completed' || state.status === 'skipped') return true
  return state.currentStepIndex >= state.spec.steps.length
}

export function isExerciseSkipped(spec: ExerciseSpec): boolean {
  return spec.meta.runtimeMode === 'unsupported'
}

// ── Record attempt ────────────────────────────────────────────────────────────

export function recordAttempt(
  state: EngineExerciseState,
  studentAnswer: string,
  validation: EngineValidationResult,
): EngineExerciseState {
  const step = getCurrentStep(state)
  if (!step) return state

  const attempt: StepAttempt = {
    stepId:        step.stepId,
    stepIndex:     state.currentStepIndex,
    studentAnswer,
    correct:       validation.correct,
    score:         validation.score,
    attemptNumber: state.retryCount + 1,
    hintsUsed:     state.hintsGiven,
    timestamp:     new Date().toISOString(),
  }

  const newAttempts = [...state.stepAttempts, attempt]
  const newFailed   = (!validation.correct && !state.failedSteps.includes(state.currentStepIndex))
    ? [...state.failedSteps, state.currentStepIndex]
    : state.failedSteps

  return {
    ...state,
    stepAttempts: newAttempts,
    failedSteps:  newFailed,
    retryCount:   validation.correct ? 0 : state.retryCount + 1,
    hintsGiven:   state.hintsGiven + (validation.hintsRemaining < (step.hints.length - state.retryCount) ? 1 : 0),
  }
}

// ── Advance to next step ──────────────────────────────────────────────────────
// Returns new state with currentStepIndex incremented and correction reset.

export function advanceStep(state: EngineExerciseState): EngineExerciseState {
  const idx = state.currentStepIndex

  const newCompleted = state.completedSteps.includes(idx)
    ? state.completedSteps
    : [...state.completedSteps, idx]

  const nextIndex = idx + 1
  const isLast    = nextIndex >= state.spec.steps.length

  const newStatus: ExerciseStatus = isLast ? 'completed' : 'active'

  return {
    ...state,
    currentStepIndex: nextIndex,
    completedSteps:   newCompleted,
    retryCount:       0,
    hintsGiven:       0,
    status:           newStatus,
    completedAt:      isLast ? new Date().toISOString() : undefined,
  }
}

// ── Skip exercise ──────────────────────────────────────────────────────────────

export function skipExercise(state: EngineExerciseState): EngineExerciseState {
  return {
    ...state,
    status:      'skipped',
    completedAt: new Date().toISOString(),
  }
}

// ── Hint request ──────────────────────────────────────────────────────────────

export function getNextHint(state: EngineExerciseState): string | null {
  const step = getCurrentStep(state)
  if (!step) return null
  const hintIndex = Math.min(state.hintsGiven, step.hints.length - 1)
  return step.hints[hintIndex] ?? null
}

// ── Auto-advance check ─────────────────────────────────────────────────────────
// Returns true if the current step should advance without explicit validation.

export function shouldAutoAdvance(state: EngineExerciseState): boolean {
  const step = getCurrentStep(state)
  if (!step) return false
  return (
    step.progressionCondition === 'auto_skip' ||
    state.spec.meta.runtimeMode === 'unsupported'
  )
}

// ── Statistics ────────────────────────────────────────────────────────────────

export function getExerciseStats(state: EngineExerciseState) {
  const totalSteps    = state.spec.steps.length
  const correctSteps  = state.completedSteps.filter(i => !state.failedSteps.includes(i)).length
  const score         = totalSteps > 0 ? correctSteps / totalSteps : 0

  return {
    totalSteps,
    completedSteps: state.completedSteps.length,
    failedSteps:    state.failedSteps.length,
    score:          Math.round(score * 100) / 100,
    hintsGiven:     state.hintsGiven,
  }
}
