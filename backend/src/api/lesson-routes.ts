import { Router, type Request, type Response } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../auth/middleware.js'
import { query } from '../db/postgres.js'
import { getSubscription } from '../billing/subscription-service.js'

const router = Router()

// POST /lesson/start — subscription required; creates lesson session + usage record
router.post('/lesson/start', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId

  try {
    const sub = await getSubscription(userId)

    if (!sub || sub.status !== 'active') {
      res.status(402).json({
        code:    'PAYMENT_REQUIRED',
        message: 'An active subscription is required to start a paid lesson.',
      })
      return
    }

    const now = new Date()
    if (sub.expiresAt && sub.expiresAt < now) {
      res.status(402).json({
        code:    'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has expired. Please renew to continue.',
      })
      return
    }

    if (sub.minutesRemaining <= 0) {
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

export default router
