import { query } from '../db/postgres.js'
import redis, { lessonStateKey } from '../db/redis.js'

const MAX_MESSAGE_LENGTH = 4000

// Redact tokens/secrets before storing
const REDACT_PATTERNS: [RegExp, string][] = [
  [/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]'],
  [/token=[A-Za-z0-9\-._~+/%]*/gi,     'token=[REDACTED]'],
]

function sanitizeMessage(msg: string): string {
  let s = msg.slice(0, MAX_MESSAGE_LENGTH)
  for (const [re, replacement] of REDACT_PATTERNS) {
    s = s.replace(re, replacement)
  }
  return s
}

export interface TranscriptEvent {
  lessonId:         string
  sessionId:        string | null
  userId:           string | null
  studentId?:       string | null
  speaker:          'teacher' | 'student' | 'system'
  source:           'ws' | 'stt' | 'ai' | 'system' | 'engine'
  message:          string
  phase?:           string | null
  exerciseNumber?:  number | null
  exerciseType?:    string | null
  itemIndex?:       number | null
  itemTotal?:       number | null
  retryCount?:      number | null
  correctionTurn?:  string | null
  frontendSnapshot?: object | null
  metadata?:        object | null
}

async function _write(event: TranscriptEvent): Promise<void> {
  if (!event.userId) return
  const msg = sanitizeMessage(event.message)
  if (!msg.trim()) return

  await query(
    `INSERT INTO lesson_transcript_events
       (lesson_id, session_id, user_id, student_id,
        speaker, source, message, phase,
        exercise_number, exercise_type, item_index, item_total,
        retry_count, correction_turn, frontend_snapshot, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb)`,
    [
      event.lessonId,
      event.sessionId ?? null,
      event.userId,
      event.studentId ?? null,
      event.speaker,
      event.source,
      msg,
      event.phase ?? null,
      event.exerciseNumber ?? null,
      event.exerciseType ?? null,
      event.itemIndex ?? null,
      event.itemTotal ?? null,
      event.retryCount ?? null,
      event.correctionTurn ?? null,
      event.frontendSnapshot ? JSON.stringify(event.frontendSnapshot) : null,
      event.metadata        ? JSON.stringify(event.metadata)         : null,
    ],
  )
}

export function recordTranscriptEvent(event: TranscriptEvent): void {
  _write(event).catch((err) => {
    console.error('[transcript] write_failed reason=', err instanceof Error ? err.message : String(err))
  })
}

// ── Student message — reads Redis state for exercise context ──────────────────

export function recordStudentMessage(opts: {
  lessonId:  string
  sessionId: string | null
  userId:    string | null
  studentId: string | null
  text:      string
  source:    'ws' | 'stt'
}): void {
  if (!opts.userId || !opts.text.trim()) return

  ;(async () => {
    let phase:          string | null = null
    let exerciseNumber: number | null = null
    let exerciseType:   string | null = null
    let itemIndex:      number | null = null
    let itemTotal:      number | null = null
    let retryCount:     number | null = null

    try {
      const raw = await redis.get(lessonStateKey(opts.lessonId))
      if (raw) {
        const s = JSON.parse(raw) as {
          phase?:              string
          currentExerciseNum?: number
          activeExerciseType?: string
          itemIndex?:          number
          exerciseItems?:      unknown[]
          itemRetryCount?:     number
        }
        phase          = s.phase          ?? null
        exerciseNumber = s.currentExerciseNum  ?? null
        exerciseType   = s.activeExerciseType  ?? null
        itemIndex      = s.itemIndex           ?? null
        itemTotal      = s.exerciseItems?.length ?? null
        retryCount     = s.itemRetryCount       ?? null
      }
    } catch { /* non-fatal — proceed without state context */ }

    await _write({
      lessonId:  opts.lessonId,
      sessionId: opts.sessionId,
      userId:    opts.userId,
      studentId: opts.studentId,
      speaker:   'student',
      source:    opts.source,
      message:   opts.text,
      phase,
      exerciseNumber,
      exerciseType,
      itemIndex,
      itemTotal,
      retryCount,
    })

    console.log(`[transcript] recorded speaker=student lessonId=${opts.lessonId} item=${itemIndex ?? '-'}`)
  })().catch((err) => {
    console.error('[transcript] write_failed reason=', err instanceof Error ? err.message : String(err))
  })
}

// ── Teacher message — exercise context passed directly from result ─────────────

export function recordTeacherMessage(opts: {
  lessonId:        string
  sessionId:       string | null
  userId:          string | null
  studentId:       string | null
  text:            string
  phase?:          string | null
  exerciseNumber?: number | null
  exerciseType?:   string | null
  itemIndex?:      number | null
  itemTotal?:      number | null
  correctionTurn?: string | null
  source?:         'ai' | 'system'
  metadata?:       object | null
}): void {
  if (!opts.userId || !opts.text.trim()) return

  recordTranscriptEvent({
    lessonId:       opts.lessonId,
    sessionId:      opts.sessionId,
    userId:         opts.userId,
    studentId:      opts.studentId,
    speaker:        'teacher',
    source:         opts.source ?? 'ai',
    message:        opts.text,
    phase:          opts.phase          ?? null,
    exerciseNumber: opts.exerciseNumber ?? null,
    exerciseType:   opts.exerciseType   ?? null,
    itemIndex:      opts.itemIndex      ?? null,
    itemTotal:      opts.itemTotal      ?? null,
    correctionTurn: opts.correctionTurn ?? null,
    metadata:       opts.metadata       ?? null,
  })

  console.log(`[transcript] recorded speaker=teacher lessonId=${opts.lessonId} item=${opts.itemIndex ?? '-'}`)
}

// ── System event — concise, no message body ────────────────────────────────────

export function recordSystemEvent(opts: {
  lessonId:   string
  sessionId:  string | null
  userId:     string | null
  studentId?: string | null
  message:    string
  phase?:     string | null
  metadata?:  object | null
}): void {
  if (!opts.userId) return

  recordTranscriptEvent({
    lessonId:  opts.lessonId,
    sessionId: opts.sessionId,
    userId:    opts.userId,
    studentId: opts.studentId ?? null,
    speaker:   'system',
    source:    'system',
    message:   opts.message,
    phase:     opts.phase    ?? null,
    metadata:  opts.metadata ?? null,
  })
}
