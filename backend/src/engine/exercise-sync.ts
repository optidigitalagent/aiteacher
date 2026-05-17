// ── Exercise Sync ─────────────────────────────────────────────────────────────
// Redis persistence for EngineLessonState.
// Separate key from LessonState — engine state is independent.
// All writes use 4-hour TTL, matching the lesson state TTL.

import redis from '../db/redis.js'
import type { EngineLessonState } from './types.js'

const ENGINE_TTL = 14_400  // 4 hours, same as LESSON_TTL

export function engineStateKey(lessonId: string): string {
  return `engine:lesson:${lessonId}`
}

export async function loadEngineState(lessonId: string): Promise<EngineLessonState | null> {
  try {
    const raw = await redis.get(engineStateKey(lessonId))
    if (!raw) return null
    const state = JSON.parse(raw) as EngineLessonState
    // Forward-compatible: ensure new fields exist on old states
    state.skippedExerciseIds  ??= []
    state.completedExerciseIds ??= []
    state.engineVersion        ??= 1
    return state
  } catch (err) {
    console.error(`[engine:sync] failed to load state lessonId=${lessonId}`, err)
    return null
  }
}

export async function saveEngineState(lessonId: string, state: EngineLessonState): Promise<void> {
  state.lastActivityAt = new Date().toISOString()
  try {
    await redis.set(engineStateKey(lessonId), JSON.stringify(state), 'EX', ENGINE_TTL)
  } catch (err) {
    console.error(`[engine:sync] failed to save state lessonId=${lessonId}`, err)
    throw err
  }
}

export async function deleteEngineState(lessonId: string): Promise<void> {
  await redis.del(engineStateKey(lessonId))
}
