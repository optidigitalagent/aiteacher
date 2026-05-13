import { Router, type Request, type Response } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../auth/middleware.js'
import { query } from '../db/postgres.js'
import { getSubscription } from '../billing/subscription-service.js'

const router = Router()

const MAX_LESSON_MS = Number(process.env.PAID_PLAN_LESSON_MINUTES ?? 50) * 60_000

// POST /lesson/start — subscription required; creates lesson session + usage record
router.post('/lesson/start', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId

  try {
    const sub = await getSubscription(userId)

    if (!sub || sub.status !== 'active') {
      console.log(`[billing] lesson gate blocked code=PAYMENT_REQUIRED user=${userId} status=${sub?.status ?? 'none'} remainingMinutes=${sub?.minutesRemaining ?? 0}`)
      res.status(402).json({
        code:    'PAYMENT_REQUIRED',
        message: 'An active subscription is required to start a paid lesson.',
      })
      return
    }

    const now = new Date()
    if (sub.expiresAt && sub.expiresAt < now) {
      console.log(`[billing] lesson gate blocked code=SUBSCRIPTION_EXPIRED user=${userId} status=${sub.status} remainingMinutes=${sub.minutesRemaining}`)
      res.status(402).json({
        code:    'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has expired. Please renew to continue.',
      })
      return
    }

    if (sub.minutesRemaining <= 0) {
      console.log(`[billing] lesson gate blocked code=LESSON_LIMIT_REACHED user=${userId} status=${sub.status} remainingMinutes=0`)
      res.status(402).json({
        code:             'LESSON_LIMIT_REACHED',
        message:          'You have used all included lesson minutes for this period.',
        remainingMinutes: 0,
      })
      return
    }

    const body = req.body as Record<string, unknown>
    const { mode, bookId, sectionId, sectionNumber, teacherId, voiceId } = body

    if (!mode || !bookId || !sectionId || !teacherId || !voiceId) {
      res.status(400).json({ code: 'INVALID_REQUEST', message: 'Missing required fields' })
      return
    }

    const sessionId = uuid()

    await query(
      `INSERT INTO lesson_sessions
         (user_id, session_id, mode, book_id, section_id, teacher_id, voice_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'created')`,
      [userId, sessionId, mode, bookId, sectionId, teacherId, voiceId],
    )

    // Usage record: tracks actual minutes consumed during the WS lesson
    await query(
      `INSERT INTO paid_lesson_usage (user_id, session_id, started_at, status)
       VALUES ($1, $2, NOW(), 'active')`,
      [userId, sessionId],
    )

    res.json({
      sessionId,
      remainingMinutes: sub.minutesRemaining,
    })
  } catch (err) {
    console.error('[lesson] start error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to start lesson session' })
  }
})

// GET /lesson/continuation-status — Phase 6
// Returns whether the student can continue an active lesson or should start a new one.
// Frontend uses this to show "Continue" vs "Start new lesson" UI.
// Backend remains authoritative — the WS layer independently validates on connection.
router.get('/lesson/continuation-status', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId
  try {
    const sub = await getSubscription(userId)
    const canStartNew = !!(sub && sub.status === 'active' && sub.minutesRemaining > 0
      && (!sub.expiresAt || sub.expiresAt > new Date()))

    // Check for an in-progress lesson session that has not been explicitly completed.
    // Phase 11: use lessons.started_at (original lesson creation time) instead of
    // paid_lesson_usage.started_at. After reconnects, new usage records are created
    // with started_at = NOW(), which would make remaining-time appear inflated.
    // lessons.started_at is immutable — always the original start wall-clock time.
    const activeRow = await query<{
      session_id:  string
      lesson_id:   string | null
      section_id:  string
      teacher_id:  string
      voice_id:    string
      started_at:  Date
    }>(
      `SELECT ls.session_id, ls.lesson_id, ls.section_id, ls.teacher_id, ls.voice_id,
              l.started_at
       FROM lesson_sessions ls
       JOIN lessons l ON l.id::text = ls.lesson_id
       WHERE ls.user_id = $1
         AND ls.status  = 'active'
         AND ls.lesson_id IS NOT NULL
       ORDER BY l.started_at DESC
       LIMIT 1`,
      [userId],
    )

    const active = activeRow.rows[0]
    let canContinue     = false
    let remainingMinutes: number | null = null

    if (active) {
      const elapsedMs   = Date.now() - new Date(active.started_at).getTime()
      const remainingMs = Math.max(0, MAX_LESSON_MS - elapsedMs)
      if (remainingMs > 60_000) {
        canContinue      = true
        remainingMinutes = Math.floor(remainingMs / 60_000)
      }
    }

    // Last completed section — used to suggest which section to start next
    const lastRow = await query<{ section_id: string }>(
      `SELECT ls.section_id
       FROM lesson_sessions ls
       WHERE ls.user_id = $1 AND ls.status = 'completed'
       ORDER BY ls.updated_at DESC NULLS LAST, ls.created_at DESC
       LIMIT 1`,
      [userId],
    )

    res.json({
      canContinue,
      canStartNew,
      activeSessionId:    canContinue && active ? active.session_id  : null,
      activeSectionId:    canContinue && active ? active.section_id  : null,
      activeTeacherId:    canContinue && active ? active.teacher_id  : null,
      activeVoiceId:      canContinue && active ? active.voice_id    : null,
      remainingMinutes,
      lastCompletedSection:         lastRow.rows[0]?.section_id       ?? null,
      subscriptionMinutesRemaining: sub?.minutesRemaining             ?? 0,
    })
  } catch (err) {
    console.error('[lesson] continuation-status error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to check continuation status' })
  }
})

export default router
