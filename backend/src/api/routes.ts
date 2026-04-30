import { Router, type Request, type Response } from 'express'
import { query } from '../db/postgres.js'
import redis from '../db/redis.js'

const router = Router()
const START_TIME = Date.now()

// ── GET /health ───────────────────────────────────────────────────────────────
// Detailed health check: DB, Redis, uptime, lesson stats
router.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {}

  try {
    await query('SELECT 1')
    checks['postgres'] = 'ok'
  } catch {
    checks['postgres'] = 'error'
  }

  try {
    await redis.ping()
    checks['redis'] = 'ok'
  } catch {
    checks['redis'] = 'error'
  }

  const allOk = Object.values(checks).every((v) => v === 'ok')

  // Lesson stats from last 24h
  let stats: Record<string, number> = {}
  try {
    const r = await query<{
      total: string
      completed: string
      abandoned: string
    }>(
      `SELECT
         COUNT(*)                                       AS total,
         COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
         COUNT(*) FILTER (WHERE status = 'abandoned')  AS abandoned
       FROM lessons
       WHERE started_at > NOW() - INTERVAL '24 hours'`,
    )
    const row = r.rows[0]
    if (row) {
      stats = {
        lessons24h:        Number(row.total),
        completed24h:      Number(row.completed),
        abandoned24h:      Number(row.abandoned),
        completionRate24h: Number(row.total) > 0
          ? Math.round((Number(row.completed) / Number(row.total)) * 100)
          : 0,
      }
    }
  } catch { /* non-critical */ }

  res.status(200).json({
    status:  allOk ? 'ok' : 'degraded',
    checks,
    stats,
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    ts: new Date().toISOString(),
  })
})

// ── POST /lessons/:id/feedback ────────────────────────────────────────────────
// Student submits a rating after lesson ends
router.post('/lessons/:id/feedback', async (req: Request, res: Response) => {
  const { id } = req.params
  const { rating, comment } = req.body as { rating?: unknown; comment?: unknown }

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'rating must be 1–5' })
    return
  }

  try {
    // Verify lesson exists
    const lesson = await query('SELECT id FROM lessons WHERE id = $1', [id])
    if (!lesson.rows.length) {
      res.status(404).json({ error: 'lesson not found' })
      return
    }

    await query(
      `INSERT INTO lesson_events (lesson_id, event_type, payload)
       VALUES ($1, 'student_feedback', $2)`,
      [id, JSON.stringify({ rating, comment: comment ?? '' })],
    )

    // Update lesson score (simple average of rating normalised to 0–1)
    await query(
      `UPDATE lessons SET score = $1 WHERE id = $2`,
      [rating / 5, id],
    )

    res.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error('[api] feedback error:', msg)
    res.status(500).json({ error: 'internal error' })
  }
})

// ── GET /students/:id/profile ─────────────────────────────────────────────────
router.get('/students/:id/profile', async (req: Request, res: Response) => {
  try {
    const r = await query(
      `SELECT s.name, s.age, s.level, s.textbook, s.current_unit,
              sp.grammar_mastery, sp.error_patterns, sp.attention_span_min,
              sp.known_vocabulary, sp.weak_vocabulary, sp.updated_at
       FROM students s
       LEFT JOIN student_profiles sp ON sp.student_id = s.id
       WHERE s.id = $1`,
      [req.params.id],
    )
    if (!r.rows.length) { res.status(404).json({ error: 'not found' }); return }
    res.json(r.rows[0])
  } catch {
    res.status(500).json({ error: 'internal error' })
  }
})

// ── GET /students/:id/lessons ─────────────────────────────────────────────────
router.get('/students/:id/lessons', async (req: Request, res: Response) => {
  try {
    const r = await query(
      `SELECT id, grammar_target, lesson_topic, status, phase_reached,
              score, started_at, ended_at
       FROM lessons
       WHERE student_id = $1
       ORDER BY started_at DESC
       LIMIT 20`,
      [req.params.id],
    )
    res.json(r.rows)
  } catch {
    res.status(500).json({ error: 'internal error' })
  }
})

export default router
