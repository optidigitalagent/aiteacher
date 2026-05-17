// ── Session Memory — Redis-backed per-lesson counters ─────────────────────────
// Short-lived: TTL matches lesson TTL (4 hours).
// Used for in-session adaptation only — not persisted long-term.

import redis from '../db/redis.js'
import type { SessionMemory } from './types.js'

const SESSION_MEMORY_TTL = 14_400 // 4 hours, same as lesson state

function sessionMemoryKey(lessonId: string): string {
  return `memory:session:${lessonId}`
}

export async function getSessionMemory(lessonId: string, userId: string): Promise<SessionMemory> {
  try {
    const raw = await redis.get(sessionMemoryKey(lessonId))
    if (raw) return JSON.parse(raw) as SessionMemory
  } catch {
    // fall through to default
  }
  return {
    lessonId,
    userId,
    mistakeStreak: 0,
    hintsUsed: 0,
    voiceAttempts: 0,
    correctionTypes: [],
    recentTopics: [],
  }
}

export async function updateSessionMemoryOnValidation(
  lessonId: string,
  userId: string,
  isCorrect: boolean,
  exerciseType: string,
  topic?: string,
): Promise<void> {
  try {
    const mem = await getSessionMemory(lessonId, userId)

    mem.mistakeStreak = isCorrect ? 0 : mem.mistakeStreak + 1
    mem.correctionTypes = isCorrect
      ? mem.correctionTypes
      : [...mem.correctionTypes.slice(-9), exerciseType]

    if (topic && !mem.recentTopics.includes(topic)) {
      mem.recentTopics = [...mem.recentTopics.slice(-4), topic]
    }

    await redis.set(sessionMemoryKey(lessonId), JSON.stringify(mem), 'EX', SESSION_MEMORY_TTL)
  } catch (err) {
    console.error('[session-memory] update error (ignored):', err)
  }
}

export async function incrementVoiceAttempt(lessonId: string, userId: string): Promise<void> {
  try {
    const mem = await getSessionMemory(lessonId, userId)
    mem.voiceAttempts++
    await redis.set(sessionMemoryKey(lessonId), JSON.stringify(mem), 'EX', SESSION_MEMORY_TTL)
  } catch (err) {
    console.error('[session-memory] voice increment error (ignored):', err)
  }
}

export async function incrementHintsUsed(lessonId: string, userId: string): Promise<void> {
  try {
    const mem = await getSessionMemory(lessonId, userId)
    mem.hintsUsed++
    await redis.set(sessionMemoryKey(lessonId), JSON.stringify(mem), 'EX', SESSION_MEMORY_TTL)
  } catch (err) {
    console.error('[session-memory] hints increment error (ignored):', err)
  }
}
