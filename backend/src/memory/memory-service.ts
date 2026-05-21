// ── Memory Service — Public API ────────────────────────────────────────────────
// All write paths are fail-soft: never throw into lesson flow.
// AI Teacher may only call getTeacherMemorySummary() — never write methods.

import { query, withTransaction } from '../db/postgres.js'
import {
  writeValidationEvent,
  writeExerciseCompletedEvent,
  writeLessonCompletedEvent,
  writeLessonMemorySummary,
} from './memory-events.js'
import { buildTeacherMemorySummary, formatTeacherMemorySummaryForPrompt, buildLongTermMasteryContextBlock } from './memory-summary-builder.js'
import { updateSessionMemoryOnValidation, getSessionMemory } from './session-memory.js'
import { aggregateWeakTopics } from './mistake-analyzer.js'
import { aggregateMasteryFromSession } from './mastery-aggregator.js'
import type {
  ValidationEventInput,
  ExerciseCompletedInput,
  LessonCompletedInput,
  TeacherMemorySummary,
} from './types.js'

// ── Ensure profile row exists ─────────────────────────────────────────────────

async function ensureProfile(userId: string): Promise<void> {
  await query(
    `INSERT INTO student_memory_profiles (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  )
}

// ── Recompute and persist profile from recent events ──────────────────────────

async function refreshProfile(userId: string): Promise<void> {
  // Load last 200 validation events to compute stats
  const eventsRes = await query<{
    is_correct: boolean
    exercise_type: string
    topic: string | null
    mistake_types: string[]
  }>(
    `SELECT is_correct, exercise_type, topic, mistake_types
     FROM student_memory_events
     WHERE user_id = $1 AND event_type = 'validation'
     ORDER BY created_at DESC
     LIMIT 200`,
    [userId],
  )
  const events = eventsRes.rows

  const total = events.length
  const correct = events.filter(e => e.is_correct).length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  const mistakeEvents = events
    .filter(e => !e.is_correct)
    .map(e => ({
      exerciseType: e.exercise_type,
      topic: e.topic ?? undefined,
      mistakeTypes: Array.isArray(e.mistake_types) ? e.mistake_types : [],
    }))
  const weakTopics = aggregateWeakTopics(mistakeEvents, 5)

  // Count lessons
  const lessonRes = await query<{ cnt: string }>(
    `SELECT COUNT(DISTINCT lesson_id)::text AS cnt
     FROM student_memory_events
     WHERE user_id = $1 AND event_type = 'lesson_complete'`,
    [userId],
  )
  const totalLessons = parseInt(lessonRes.rows[0]?.cnt ?? '0', 10)

  // Derive learning speed from average retry count
  const retryRes = await query<{ avg_retry: number }>(
    `SELECT AVG(retry_count) AS avg_retry
     FROM student_memory_events
     WHERE user_id = $1 AND event_type = 'validation' AND is_correct = false`,
    [userId],
  )
  const avgRetry = Number(retryRes.rows[0]?.avg_retry ?? 0)
  const learningSpeed = avgRetry <= 1 ? 'fast' : avgRetry <= 2.5 ? 'normal' : 'slow'

  // Confidence trend: compare last 20 events accuracy vs previous 20
  const recentAcc = events.slice(0, 20).filter(e => e.is_correct).length / Math.max(1, Math.min(20, events.length))
  const olderAcc  = events.slice(20, 40).filter(e => e.is_correct).length / Math.max(1, Math.min(20, events.slice(20).length))
  const confidenceTrend = recentAcc > olderAcc + 0.1 ? 'improving' : recentAcc < olderAcc - 0.1 ? 'declining' : 'stable'

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE student_memory_profiles
       SET average_accuracy = $2,
           learning_speed = $3,
           confidence_trend = $4,
           weak_topics = $5,
           total_lessons = $6,
           total_exercises_attempted = $7,
           total_correct = $8,
           updated_at = NOW()
       WHERE user_id = $1`,
      [
        userId,
        accuracy,
        learningSpeed,
        confidenceTrend,
        JSON.stringify(weakTopics),
        totalLessons,
        total,
        correct,
      ],
    )
  })
}

// ── Public API ─────────────────────────────────────────────────────────────────

export const memoryService = {
  // Called after every validation result — fire-and-forget from WS layer
  async recordValidationEvent(input: ValidationEventInput): Promise<void> {
    try {
      await ensureProfile(input.userId)
      await Promise.all([
        writeValidationEvent(input),
        updateSessionMemoryOnValidation(
          input.lessonId,
          input.userId,
          input.isCorrect,
          input.exerciseType,
          input.topic,
        ),
      ])
    } catch (err) {
      console.error('[memory] recordValidationEvent error (ignored):', err)
    }
  },

  // Called when an exercise is fully completed — fire-and-forget
  async recordExerciseCompleted(input: ExerciseCompletedInput): Promise<void> {
    try {
      await ensureProfile(input.userId)
      await writeExerciseCompletedEvent(input)
    } catch (err) {
      console.error('[memory] recordExerciseCompleted error (ignored):', err)
    }
  },

  // Called when a lesson ends — fire-and-forget, updates long-term profile
  async recordLessonCompleted(input: LessonCompletedInput): Promise<void> {
    try {
      await ensureProfile(input.userId)
      await writeLessonCompletedEvent(input)
      await writeLessonMemorySummary(input)
      await refreshProfile(input.userId)
      // Phase 3D.2: Lesson-end mastery aggregation — fire-and-forget, fail-soft
      aggregateMasteryFromSession(input.userId, input.lessonId).catch((err) => {
        console.warn('[memory] mastery aggregation failed (ignored):', err instanceof Error ? err.message : err)
      })
      console.log(`[memory] lesson_complete recorded userId=${input.userId} lesson=${input.lessonId}`)
    } catch (err) {
      console.error('[memory] recordLessonCompleted error (ignored):', err)
    }
  },

  // Read-only: called by prompt builder before AI call
  async getTeacherMemorySummary(userId: string): Promise<TeacherMemorySummary | null> {
    return buildTeacherMemorySummary(userId)
  },

  // Formatted string ready for injection into system prompt.
  // Phase 3D.3: appends long-term mastery advisory block after base memory block.
  // Both sections are advisory-only: phrasing and hint depth only, never correctness or progression.
  async getTeacherMemoryPromptBlock(userId: string): Promise<string> {
    try {
      const [summary, masteryBlock] = await Promise.all([
        buildTeacherMemorySummary(userId),
        buildLongTermMasteryContextBlock(userId),
      ])
      const baseBlock = summary ? formatTeacherMemorySummaryForPrompt(summary) : ''
      if (!baseBlock && !masteryBlock) return ''
      return [baseBlock, masteryBlock].filter(Boolean).join('\n\n')
    } catch (err) {
      console.error('[memory] prompt block error (ignored):', err)
      return ''
    }
  },

  // Read session memory (current lesson stats only)
  async getSessionMemory(lessonId: string, userId: string) {
    return getSessionMemory(lessonId, userId)
  },
}
