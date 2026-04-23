import { v4 as uuid } from 'uuid'
import redis, { LESSON_TTL } from '../db/redis.js'
import { query } from '../db/postgres.js'
import type { ExerciseData } from '../lesson/types.js'

export interface StoredExercise extends ExerciseData {
  lessonId: string
}

function key(exerciseId: string): string {
  return `exercise:${exerciseId}`
}

// Called by orchestrator when AI returns an exercise.
// Overrides AI-generated ID with a server UUID, saves to Redis + DB.
export async function saveExercise(
  lessonId: string,
  exercise: ExerciseData,
): Promise<StoredExercise> {
  const stored: StoredExercise = { ...exercise, id: uuid(), lessonId }

  await redis.set(key(stored.id), JSON.stringify(stored), 'EX', LESSON_TTL)

  await query(
    `INSERT INTO exercises (id, lesson_id, type, question, correct_answer, difficulty)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [stored.id, lessonId, stored.type, stored.question, stored.correct_answer, stored.difficulty],
  )

  return stored
}

export async function loadExercise(exerciseId: string): Promise<StoredExercise | null> {
  const raw = await redis.get(key(exerciseId))
  if (!raw) return null
  return JSON.parse(raw) as StoredExercise
}

export async function recordAnswer(
  exerciseId: string,
  lessonId: string,
  studentAnswer: string,
  isCorrect: boolean,
): Promise<void> {
  await query(
    `UPDATE exercises
     SET student_answer = $1, is_correct = $2, attempts = attempts + 1
     WHERE id = $3 AND lesson_id = $4`,
    [studentAnswer, isCorrect, exerciseId, lessonId],
  )
}
