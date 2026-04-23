import { query, withTransaction } from '../db/postgres.js'

interface ExerciseRow {
  type:           string
  is_correct:     boolean | null
  attempts:       number
  difficulty:     number
  student_answer: string | null
  correct_answer: string
}

interface ProfileRow {
  grammar_mastery:  Record<string, number> | null
  weak_vocabulary:  string[] | null
  error_patterns:   string[] | null
  attention_span_min: number
}

interface LessonRow {
  grammar_target: string
  started_at:     Date
  ended_at:       Date | null
}

// Mastery delta per correct/wrong answer
const MASTERY_CORRECT = 0.08
const MASTERY_WRONG   = 0.04
const MASTERY_MIN     = 0.0
const MASTERY_MAX     = 1.0

function clamp(v: number): number {
  return Math.min(MASTERY_MAX, Math.max(MASTERY_MIN, v))
}

// Derive a slug key from a grammar target string, e.g. "Past Simple" → "past_simple"
function grammarKey(target: string): string {
  return target.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

// Detect error patterns from exercise results this lesson
function detectPatterns(exercises: ExerciseRow[], existingPatterns: string[]): string[] {
  const patterns = new Set(existingPatterns)

  const wrongByType: Record<string, number> = {}
  for (const ex of exercises) {
    if (ex.is_correct === false) {
      wrongByType[ex.type] = (wrongByType[ex.type] ?? 0) + 1
    }
  }

  if ((wrongByType['form_transformation'] ?? 0) >= 2) {
    patterns.add('struggles with verb form transformations')
  }
  if ((wrongByType['error_correction'] ?? 0) >= 2) {
    patterns.add('difficulty identifying grammar errors')
  }
  if ((wrongByType['reconstruction'] ?? 0) >= 2) {
    patterns.add('word order issues in complex sentences')
  }
  if ((wrongByType['free_production'] ?? 0) >= 1) {
    patterns.add('difficulty producing target grammar in free writing')
  }

  // Detect overgeneralisation (irregular verb errors)
  const irregularErrors = exercises.filter(
    (ex) =>
      ex.is_correct === false &&
      ex.student_answer !== null &&
      /ed\b/.test(ex.student_answer) &&
      !/ed\b/.test(ex.correct_answer),
  )
  if (irregularErrors.length >= 2) {
    patterns.add('overgeneralises -ed rule to irregular verbs')
  }

  // Cap at 10 patterns to keep the profile focused
  return [...patterns].slice(0, 10)
}

// Called after a lesson completes. Updates student_profiles in PostgreSQL.
export async function updateStudentProfile(
  lessonId:  string,
  studentId: string,
): Promise<void> {
  // Load lesson metadata
  const lessonRes = await query<LessonRow>(
    `SELECT grammar_target, started_at, ended_at FROM lessons WHERE id = $1`,
    [lessonId],
  )
  const lesson = lessonRes.rows[0]
  if (!lesson) return

  // Load all exercises for this lesson
  const exRes = await query<ExerciseRow>(
    `SELECT type, is_correct, attempts, difficulty, student_answer, correct_answer
     FROM exercises WHERE lesson_id = $1`,
    [lessonId],
  )
  const exercises = exRes.rows

  if (!exercises.length) return

  // Load current profile
  const profileRes = await query<ProfileRow>(
    `SELECT grammar_mastery, weak_vocabulary, error_patterns, attention_span_min
     FROM student_profiles WHERE student_id = $1`,
    [studentId],
  )
  const profile = profileRes.rows[0]
  if (!profile) return

  // ── 1. Update grammar mastery ──────────────────────────────────────────────
  const mastery: Record<string, number> = profile.grammar_mastery ?? {}
  const key = grammarKey(lesson.grammar_target)

  const totalEx   = exercises.filter((e) => e.is_correct !== null).length
  const correctEx = exercises.filter((e) => e.is_correct === true).length

  if (totalEx > 0) {
    const current = mastery[key] ?? 0.5
    const delta   = correctEx >= totalEx * 0.8
      ? MASTERY_CORRECT * (correctEx / totalEx)
      : -MASTERY_WRONG * ((totalEx - correctEx) / totalEx)
    mastery[key] = clamp(current + delta)
  }

  // ── 2. Update error patterns ───────────────────────────────────────────────
  const newPatterns = detectPatterns(exercises, profile.error_patterns ?? [])

  // ── 3. Update attention span (rolling average with last lesson) ────────────
  let attentionSpan = profile.attention_span_min
  if (lesson.ended_at && lesson.started_at) {
    const durationMin = (lesson.ended_at.getTime() - lesson.started_at.getTime()) / 60_000
    if (durationMin > 1 && durationMin < 90) {
      // Rolling average: 70% old value, 30% new observation
      attentionSpan = Math.round((attentionSpan * 0.7 + durationMin * 0.3) * 10) / 10
    }
  }

  // ── 4. Persist updates ─────────────────────────────────────────────────────
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE student_profiles
       SET grammar_mastery    = $1,
           error_patterns     = $2,
           attention_span_min = $3,
           updated_at         = NOW()
       WHERE student_id = $4`,
      [
        JSON.stringify(mastery),
        newPatterns,
        attentionSpan,
        studentId,
      ],
    )

    // Log the update as a lesson event for audit
    await client.query(
      `INSERT INTO lesson_events (lesson_id, event_type, payload)
       VALUES ($1, 'profile_updated', $2)`,
      [
        lessonId,
        JSON.stringify({
          grammarKey,
          masteryAfter:  mastery[key],
          patternsCount: newPatterns.length,
          attentionSpan,
        }),
      ],
    )
  })

  console.log(
    `[profile] student=${studentId} grammar[${key}]=${(mastery[key] ?? 0).toFixed(2)} ` +
    `patterns=${newPatterns.length} attention=${attentionSpan}min`,
  )
}
