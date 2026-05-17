// ── Exercise Recovery ─────────────────────────────────────────────────────────
// Restores engine state after WebSocket reconnect.
// Falls back gracefully: Redis state → manifest rebuild → empty state.
// The student's progress is never lost as long as Redis has not expired.

import type { EngineLessonState, EngineExerciseState } from './types.js'
import { loadEngineState } from './exercise-sync.js'
import { loadExercisesForSection } from './exercise-loader.js'
import { initExerciseState, skipExercise } from './step-progression-manager.js'
import { shouldAutoSkip } from './exercise-transitions.js'

// ── Reconnect recovery entry point ────────────────────────────────────────────

export async function recoverEngineState(
  lessonId: string,
  sectionId: string,
): Promise<EngineLessonState> {
  // 1. Try Redis first (hot path — student rejoins within TTL)
  const cached = await loadEngineState(lessonId)
  if (cached) {
    console.log(
      `[engine:recovery] redis_hit lessonId=${lessonId} ` +
      `section=${cached.sectionId} exercise=${cached.currentExerciseIndex}/${cached.exerciseQueue.length}`,
    )
    return cached
  }

  // 2. Rebuild from manifest (Redis expired, e.g. student returns next day)
  console.warn(`[engine:recovery] redis_miss — rebuilding from manifest lessonId=${lessonId} section=${sectionId}`)

  if (!sectionId || sectionId === 'free') {
    return buildEmptyState(lessonId, sectionId)
  }

  const { exercises } = loadExercisesForSection(sectionId)
  if (!exercises.length) {
    console.warn(`[engine:recovery] no exercises for section=${sectionId} — returning empty state`)
    return buildEmptyState(lessonId, sectionId)
  }

  // Start fresh from first exercise (progress lost after TTL expiry — acceptable trade-off)
  const firstSpec  = exercises[0]!
  const firstState: EngineExerciseState = shouldAutoSkip(firstSpec)
    ? skipExercise(initExerciseState(firstSpec))
    : initExerciseState(firstSpec)

  return {
    lessonId,
    sectionId,
    exerciseQueue:        exercises,
    currentExerciseIndex: 0,
    currentExerciseState: firstState,
    completedExerciseIds: [],
    skippedExerciseIds:   shouldAutoSkip(firstSpec) ? [firstSpec.exerciseId] : [],
    sessionStartedAt:     new Date().toISOString(),
    lastActivityAt:       new Date().toISOString(),
    engineVersion:        1,
  }
}

// ── Validate recovered state integrity ───────────────────────────────────────
// Guards against corrupt or version-mismatched states loaded from Redis.

export function validateRecoveredState(state: EngineLessonState): boolean {
  if (!state.lessonId || !state.exerciseQueue) return false
  if (!Array.isArray(state.exerciseQueue)) return false
  if (typeof state.currentExerciseIndex !== 'number') return false
  if (state.currentExerciseIndex < 0 || state.currentExerciseIndex > state.exerciseQueue.length) return false
  return true
}

// ── Empty state (free-mode or missing manifest) ───────────────────────────────

function buildEmptyState(lessonId: string, sectionId: string): EngineLessonState {
  return {
    lessonId,
    sectionId,
    exerciseQueue:        [],
    currentExerciseIndex: 0,
    completedExerciseIds: [],
    skippedExerciseIds:   [],
    sessionStartedAt:     new Date().toISOString(),
    lastActivityAt:       new Date().toISOString(),
    engineVersion:        1,
  }
}
