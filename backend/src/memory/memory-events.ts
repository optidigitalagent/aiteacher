// ── Memory Events — PostgreSQL writes ─────────────────────────────────────────
// All writes are fail-soft: errors are logged but never bubble up to lesson flow.

import { query } from '../db/postgres.js'
import type {
  ValidationEventInput,
  ExerciseCompletedInput,
  LessonCompletedInput,
} from './types.js'
import { deriveMistakeTypes } from './mistake-analyzer.js'

export async function writeValidationEvent(input: ValidationEventInput): Promise<void> {
  const mistakeTypes = input.mistakeTypes ?? deriveMistakeTypes(
    input.exerciseType,
    input.isCorrect,
    input.retryCount,
  )

  await query(
    `INSERT INTO student_memory_events
       (user_id, session_id, lesson_id, event_type, exercise_type,
        topic, section_id, correctness_score, is_correct, retry_count,
        mistake_types, metadata)
     VALUES ($1,$2,$3,'validation',$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      input.userId,
      input.sessionId,
      input.lessonId,
      input.exerciseType,
      input.topic ?? null,
      input.sectionId ?? null,
      Math.round(input.score * 100),
      input.isCorrect,
      input.retryCount,
      JSON.stringify(mistakeTypes),
      JSON.stringify({ stepId: input.stepId, exerciseId: input.exerciseId }),
    ],
  )
}

export async function writeExerciseCompletedEvent(input: ExerciseCompletedInput): Promise<void> {
  const accuracy = input.totalSteps > 0
    ? Math.round((input.correctSteps / input.totalSteps) * 100)
    : 0

  await query(
    `INSERT INTO student_memory_events
       (user_id, session_id, lesson_id, event_type, exercise_type,
        topic, section_id, correctness_score, is_correct, metadata)
     VALUES ($1,$2,$3,'exercise_complete',$4,$5,$6,$7,$8,$9)`,
    [
      input.userId,
      input.sessionId,
      input.lessonId,
      input.exerciseType,
      input.topic ?? null,
      input.sectionId ?? null,
      accuracy,
      accuracy >= 70,
      JSON.stringify({
        exerciseId: input.exerciseId,
        totalSteps: input.totalSteps,
        correctSteps: input.correctSteps,
        totalHints: input.totalHints,
      }),
    ],
  )
}

export async function writeLessonCompletedEvent(input: LessonCompletedInput): Promise<void> {
  await query(
    `INSERT INTO student_memory_events
       (user_id, session_id, lesson_id, event_type, section_id, metadata)
     VALUES ($1,$2,$3,'lesson_complete',$4,$5)`,
    [
      input.userId,
      input.sessionId,
      input.lessonId,
      input.sectionId ?? null,
      JSON.stringify({
        bookId: input.bookId,
        phaseReached: input.phaseReached,
        completedExercises: input.completedExercises,
        durationSeconds: input.durationSeconds,
        voiceAttemptCount: input.voiceAttemptCount,
      }),
    ],
  )
}

export async function writeLessonMemorySummary(input: LessonCompletedInput): Promise<void> {
  // Load accuracy from events for this lesson
  const res = await query<{ correctness_score: number; is_correct: boolean; mistake_types: string[] }>(
    `SELECT correctness_score, is_correct, mistake_types
     FROM student_memory_events
     WHERE user_id = $1 AND lesson_id = $2 AND event_type = 'validation'`,
    [input.userId, input.lessonId],
  )

  const events = res.rows
  const total = events.length
  const correct = events.filter(e => e.is_correct).length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  const mistakeCounts: Record<string, number> = {}
  for (const ev of events) {
    const types: string[] = Array.isArray(ev.mistake_types) ? ev.mistake_types : []
    for (const t of types) {
      mistakeCounts[t] = (mistakeCounts[t] ?? 0) + 1
    }
  }
  const mistakeSummary = Object.entries(mistakeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([type, count]) => ({ type, count }))

  await query(
    `INSERT INTO student_lesson_memory
       (user_id, lesson_id, session_id, book_id, section_id,
        completed_exercises, accuracy, mistake_summary,
        duration_seconds, voice_attempt_count, phase_reached)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT DO NOTHING`,
    [
      input.userId,
      input.lessonId,
      input.sessionId,
      input.bookId ?? null,
      input.sectionId ?? null,
      JSON.stringify(input.completedExercises),
      accuracy,
      JSON.stringify(mistakeSummary),
      input.durationSeconds,
      input.voiceAttemptCount,
      input.phaseReached ?? null,
    ],
  )
}
