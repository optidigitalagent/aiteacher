import { query } from '../db/postgres.js'

export type TipCategory = 'VOCAB' | 'PHRASE' | 'GRAMMAR' | 'PRONUNCIATION' | 'COMMON_MISTAKE'
export type TipSource   = 'confusion' | 'correction' | 'vocabulary' | 'observation'

export interface TipInput {
  studentId:   string
  lessonId?:   string
  section?:    string
  exerciseId?: string
  category:    TipCategory
  title:       string       // word, phrase, or rule name
  explanation: string       // concise explanation
  example?:    string       // optional usage example
  source:      TipSource
}

export interface TipRecord {
  id:         string
  studentId:  string
  lessonId:   string | null
  section:    string | null
  exerciseId: string | null
  category:   TipCategory
  title:      string
  explanation: string
  example:    string | null
  source:     TipSource
  createdAt:  string  // ISO timestamp
}

interface TipRow {
  id:          string
  student_id:  string
  lesson_id:   string | null
  section:     string | null
  exercise_id: string | null
  category:    TipCategory
  title:       string
  explanation: string
  example:     string | null
  source:      TipSource
  created_at:  Date
}

function rowToRecord(row: TipRow): TipRecord {
  return {
    id:          row.id,
    studentId:   row.student_id,
    lessonId:    row.lesson_id,
    section:     row.section,
    exerciseId:  row.exercise_id,
    category:    row.category,
    title:       row.title,
    explanation: row.explanation,
    example:     row.example,
    source:      row.source,
    createdAt:   row.created_at.toISOString(),
  }
}

// Save a tip with deduplication.
// Returns the saved TipRecord, or null if a duplicate already exists (same student + category + title within 30 days).
export async function saveTip(tip: TipInput): Promise<TipRecord | null> {
  try {
    const existing = await query<{ id: string }>(
      `SELECT id FROM student_tips
       WHERE student_id  = $1
         AND category    = $2
         AND lower(title) = lower($3)
         AND created_at >= NOW() - INTERVAL '30 days'
       LIMIT 1`,
      [tip.studentId, tip.category, tip.title.slice(0, 255)],
    )
    if (existing.rows[0]) {
      console.log(`[tips] dedup_skip student=${tip.studentId} cat=${tip.category} title="${tip.title.slice(0, 40)}"`)
      return null
    }

    const result = await query<TipRow>(
      `INSERT INTO student_tips
         (student_id, lesson_id, section, exercise_id, category, title, explanation, example, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        tip.studentId,
        tip.lessonId   ?? null,
        tip.section    ?? null,
        tip.exerciseId ?? null,
        tip.category,
        tip.title.slice(0, 255),
        tip.explanation,
        tip.example    ?? null,
        tip.source,
      ],
    )

    const row = result.rows[0]
    if (!row) return null

    console.log(`[tips] saved student=${tip.studentId} cat=${tip.category} title="${tip.title.slice(0, 40)}"`)
    return rowToRecord(row)
  } catch (err) {
    console.error('[tips] saveTip error:', err)
    return null
  }
}

// Get tips for AI prompt injection — bounded, section-relevant first.
export async function getTipsForContext(
  studentId: string,
  section?:  string,
  limit = 5,
): Promise<TipRecord[]> {
  try {
    const result = await query<TipRow>(
      `SELECT * FROM student_tips
       WHERE student_id = $1
       ORDER BY
         CASE WHEN section = $2 THEN 0 ELSE 1 END,
         created_at DESC
       LIMIT $3`,
      [studentId, section ?? null, limit],
    )
    return result.rows.map(rowToRecord)
  } catch (err) {
    console.error('[tips] getTipsForContext error:', err)
    return []
  }
}

// Get all recent tips for a student — used for UI display.
export async function getStudentTips(
  studentId: string,
  limit = 30,
): Promise<TipRecord[]> {
  try {
    const result = await query<TipRow>(
      `SELECT * FROM student_tips WHERE student_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [studentId, limit],
    )
    return result.rows.map(rowToRecord)
  } catch (err) {
    console.error('[tips] getStudentTips error:', err)
    return []
  }
}
