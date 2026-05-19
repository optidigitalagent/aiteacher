import { Router, type Request, type Response } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../auth/middleware.js'
import { query } from '../db/postgres.js'
import redis from '../db/redis.js'
import { getSubscription } from '../billing/subscription-service.js'
import OpenAI from 'openai'

const router = Router()

const MAX_LESSON_MS       = Number(process.env.PAID_PLAN_LESSON_MINUTES ?? 50) * 60_000
const TRANSLATE_LIMIT     = 15
const TRANSLATE_MAX_CHARS = 500

function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(16)
}

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

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

// POST /lesson/translate — translate AI teacher message for student
// Rate-limited (15/session), cached, requires user to own an active lesson session.
router.post('/lesson/translate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const body   = req.body as Record<string, unknown>

  const sessionId      = typeof body['sessionId']      === 'string' ? body['sessionId']      : null
  const textRaw        = typeof body['text']           === 'string' ? body['text']           : null
  const targetLanguage = typeof body['targetLanguage'] === 'string' ? body['targetLanguage'] : 'ru'

  if (!sessionId || textRaw === null) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'sessionId and text required' })
    return
  }

  if (!['uk', 'ru'].includes(targetLanguage)) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'targetLanguage must be uk or ru' })
    return
  }

  const text = textRaw.trim().slice(0, TRANSLATE_MAX_CHARS)
  if (!text) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'text cannot be empty' })
    return
  }

  try {
    // Verify user owns this session
    const sessionRow = await query<{ session_id: string }>(
      `SELECT session_id FROM lesson_sessions WHERE session_id = $1 AND user_id = $2`,
      [sessionId, userId],
    )
    if (!sessionRow.rows.length) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' })
      return
    }

    // Rate limit
    const xlateKey   = `lesson:translate:${sessionId}`
    const xlateCount = await redis.incr(xlateKey)
    if (xlateCount === 1) await redis.expire(xlateKey, 14400)

    if (xlateCount > TRANSLATE_LIMIT) {
      res.status(429).json({ code: 'TRANSLATE_LIMIT_REACHED', message: 'Translation limit reached for this session.' })
      return
    }

    // Cache check
    const cacheKey = `lesson:xlat:${simpleHash(text)}:${targetLanguage}`
    const cached   = await redis.get(cacheKey)
    if (cached) {
      console.log('[lesson-translate] cache_hit=true')
      res.json({ translation: cached })
      return
    }

    const langName = targetLanguage === 'uk' ? 'Ukrainian' : 'Russian'
    const aiResult = await getOpenAI().chat.completions.create({
      model:       'gpt-4o-mini',
      max_tokens:  200,
      temperature: 0.1,
      messages: [
        { role: 'system', content: `Translate the following English text to ${langName}. Return only the translation, nothing else. Preserve line breaks.` },
        { role: 'user',   content: text },
      ],
    })

    const translation = aiResult.choices[0]?.message?.content?.trim() ?? text
    await redis.set(cacheKey, translation, 'EX', 3600)

    console.log(`[lesson-translate] session=${sessionId} lang=${targetLanguage}`)
    res.json({ translation })
  } catch (err) {
    console.error('[lesson/translate] error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Translation failed' })
  }
})

// GET /lessons/:lessonId/transcript — authenticated; user can only read their own lesson
router.get('/lessons/:lessonId/transcript', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId   = req.user!.userId
  const lessonId = req.params.lessonId as string

  if (!lessonId || lessonId.length > 255) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'Invalid lessonId' })
    return
  }

  try {
    // Primary ownership check via lesson_sessions (covers paid/focus lessons)
    const sessionRow = await query<{ session_id: string }>(
      `SELECT session_id FROM lesson_sessions WHERE lesson_id = $1 AND user_id = $2 LIMIT 1`,
      [lessonId, userId],
    )

    let sessionId: string | null = sessionRow.rows[0]?.session_id ?? null

    // Fallback: check transcript events directly (covers all lesson types)
    if (!sessionId) {
      const transcriptOwner = await query<{ session_id: string | null }>(
        `SELECT session_id FROM lesson_transcript_events WHERE lesson_id = $1 AND user_id = $2 LIMIT 1`,
        [lessonId, userId],
      )
      if (!transcriptOwner.rows.length) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Transcript not found or access denied' })
        return
      }
      sessionId = transcriptOwner.rows[0]?.session_id ?? null
    }

    const format = typeof req.query['format'] === 'string' ? req.query['format'] : 'json'

    const events = await query<{
      id:               string
      created_at:       string
      speaker:          string
      source:           string
      message:          string
      phase:            string | null
      exercise_number:  number | null
      exercise_type:    string | null
      item_index:       number | null
      item_total:       number | null
      retry_count:      number | null
      correction_turn:  string | null
      frontend_snapshot: unknown
      metadata:         unknown
    }>(
      `SELECT id, created_at, speaker, source, message, phase,
              exercise_number, exercise_type, item_index, item_total,
              retry_count, correction_turn, frontend_snapshot, metadata
       FROM lesson_transcript_events
       WHERE lesson_id = $1
       ORDER BY created_at ASC`,
      [lessonId],
    )

    console.log(`[transcript] export lessonId=${lessonId} events=${events.rows.length}`)

    if (format === 'md') {
      const lines: string[] = [`# Lesson Transcript\n\n**Lesson:** \`${lessonId}\`\n`]
      for (const ev of events.rows) {
        const ts    = new Date(ev.created_at).toISOString()
        const label = ev.speaker === 'teacher' ? '**Teacher**' : ev.speaker === 'student' ? '_Student_' : '🔔 System'
        const ctx   = [
          ev.phase          ? `phase=${ev.phase}` : null,
          ev.exercise_number ? `ex#${ev.exercise_number}` : null,
          ev.exercise_type   ? `type=${ev.exercise_type}` : null,
          ev.item_index != null ? `item=${ev.item_index}` : null,
        ].filter(Boolean).join(' ')
        lines.push(`### ${ts}  ${label}${ctx ? `  *(${ctx})*` : ''}\n\n${ev.message}\n`)
      }
      res.type('text/markdown').send(lines.join('\n---\n\n'))
      return
    }

    res.json({
      lessonId,
      sessionId,
      events: events.rows,
    })
  } catch (err) {
    console.error('[lesson/transcript] error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch transcript' })
  }
})

export default router
