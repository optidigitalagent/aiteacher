import { Router, type Request, type Response } from 'express'
import { requireAuth } from '../auth/middleware.js'
import { buildGoogleAuthUrl, handleGoogleCallback, FRONTEND_URL } from '../auth/google-oauth.js'
import { query, withTransaction } from '../db/postgres.js'
import redis from '../db/redis.js'

const router = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeReturnTo(raw: unknown): string {
  if (typeof raw !== 'string') return '/demo/setup'
  const t = raw.trim()
  if (!t.startsWith('/')) return '/demo/setup'
  if (t.startsWith('//')) return '/demo/setup'
  if (t.includes('://')) return '/demo/setup'
  return t
}

const LESSON_MOOD_VALUES         = ['chill_easy', 'fun_interactive', 'real_conversation', 'challenge_me'] as const
const INTEREST_AREA_VALUES       = ['music_social', 'games', 'movies_series', 'travel', 'school_life', 'future_career'] as const
const TEACHER_STYLE_VALUES       = ['friendly_coach', 'older_friend', 'real_tutor', 'challenge_trainer'] as const
const SPEAKING_CONFIDENCE_VALUES = ['freezes', 'can_try', 'okay', 'test_me'] as const
const DEMO_MISSION_VALUES        = ['real_conversation_mission', 'fix_mistakes', 'listening_check', 'find_level'] as const

function isValidEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

async function checkRateLimit(
  key: string,
  limit: number,
  windowSecs: number,
): Promise<{ blocked: boolean; retryAfter: number }> {
  try {
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, windowSecs)
    if (count > limit) {
      const ttl = await redis.ttl(key)
      return { blocked: true, retryAfter: Math.max(ttl, 0) }
    }
    return { blocked: false, retryAfter: 0 }
  } catch {
    return { blocked: false, retryAfter: 0 }
  }
}

async function ensureStudentForUser(userId: string): Promise<string | null> {
  try {
    const existing = await query<{ student_id: string | null }>(
      'SELECT student_id FROM users WHERE id = $1',
      [userId],
    )
    if (existing.rows[0]?.student_id) return existing.rows[0].student_id

    const userRow = await query<{ name: string }>(
      'SELECT name FROM users WHERE id = $1',
      [userId],
    )
    if (!userRow.rows.length) return null

    return await withTransaction(async (client) => {
      const re = await client.query<{ student_id: string | null }>(
        'SELECT student_id FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      )
      if (re.rows[0]?.student_id) return re.rows[0].student_id

      const studentRes = await client.query<{ id: string }>(
        `INSERT INTO students (name, age, level, textbook, current_unit)
         VALUES ($1, 16, 'B1', 'Focus B1', 1)
         RETURNING id`,
        [userRow.rows[0]!.name],
      )
      const studentId = studentRes.rows[0]?.id
      if (!studentId) throw new Error('failed to create student')

      await client.query(
        'UPDATE users SET student_id = $1 WHERE id = $2 AND student_id IS NULL',
        [studentId, userId],
      )

      return studentId
    })
  } catch (err) {
    console.error('[auth] ensureStudentForUser error:', err instanceof Error ? err.message : err)
    return null
  }
}

class DemoUsedError extends Error {
  existingSessionId: string | null
  constructor(existingSessionId: string | null = null) {
    super('DEMO_USED')
    this.existingSessionId = existingSessionId
  }
}

// ── GET /auth/google ──────────────────────────────────────────────────────────
router.get('/auth/google', (req: Request, res: Response) => {
  const returnTo = sanitizeReturnTo(req.query.returnTo)
  const state    = Buffer.from(JSON.stringify({ returnTo })).toString('base64url')
  res.redirect(buildGoogleAuthUrl(state))
})

// ── GET /auth/google/callback ─────────────────────────────────────────────────
router.get('/auth/google/callback', async (req: Request, res: Response) => {
  const code  = req.query.code
  const state = req.query.state

  if (!code || typeof code !== 'string') {
    res.redirect(`${FRONTEND_URL}/auth/callback?auth_error=missing_code`)
    return
  }

  try {
    const token = await handleGoogleCallback(code)

    let returnTo = '/demo/setup'
    if (state && typeof state === 'string') {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString()) as { returnTo?: string }
        returnTo = sanitizeReturnTo(decoded.returnTo)
      } catch { /* use default */ }
    }

    res.redirect(`${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(returnTo)}`)
  } catch (err) {
    console.error('[auth] Google callback error:', err instanceof Error ? err.message : err)
    res.redirect(`${FRONTEND_URL}/auth/callback?auth_error=oauth_failed`)
  }
})

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const r = await query<{
      id:                     string
      email:                  string
      name:                   string
      avatar_url:             string | null
      demo_lessons_completed: number
      demo_started_at:        string | null
      student_id:             string | null
    }>(
      `SELECT u.id, u.email, u.name, u.avatar_url, u.demo_started_at, u.student_id,
              COALESCE(ulp.demo_lessons_completed, 0) AS demo_lessons_completed
       FROM users u
       LEFT JOIN user_lesson_profiles ulp ON ulp.user_id = u.id
       WHERE u.id = $1`,
      [req.user!.userId],
    )
    if (!r.rows.length) { res.status(404).json({ error: 'User not found' }); return }
    const row = r.rows[0]!
    res.json({
      ...row,
      demoUsed: !!(row.demo_started_at) || (row.demo_lessons_completed ?? 0) > 0,
    })
  } catch {
    res.status(500).json({ error: 'Internal error' })
  }
})

// ── POST /demo/start ──────────────────────────────────────────────────────────
router.post('/demo/start', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const ip     = (req.headers['x-forwarded-for'] as string | undefined)
    ?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown'

  // Per-IP rate limit: 5 attempts per hour
  const ipLimit = await checkRateLimit(`demo:ip:${ip}`, 5, 3600)
  if (ipLimit.blocked) {
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many requests from this network. Please wait.',
      retryAfterSeconds: ipLimit.retryAfter,
    })
    return
  }

  // Per-user rate limit: 3 attempts per hour
  const userLimit = await checkRateLimit(`demo:user:${userId}:attempts`, 3, 3600)
  if (userLimit.blocked) {
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many demo start attempts. Please wait a moment.',
      retryAfterSeconds: userLimit.retryAfter,
    })
    return
  }

  const body = req.body as Record<string, unknown>
  const { lessonMood, interestArea, teacherStyle, speakingConfidence, demoMission, deviceId } = body

  if (!isValidEnum(lessonMood, LESSON_MOOD_VALUES)) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'Invalid lessonMood value' })
    return
  }
  if (!isValidEnum(interestArea, INTEREST_AREA_VALUES)) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'Invalid interestArea value' })
    return
  }
  if (!isValidEnum(teacherStyle, TEACHER_STYLE_VALUES)) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'Invalid teacherStyle value' })
    return
  }
  if (!isValidEnum(speakingConfidence, SPEAKING_CONFIDENCE_VALUES)) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'Invalid speakingConfidence value' })
    return
  }
  if (!isValidEnum(demoMission, DEMO_MISSION_VALUES)) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'Invalid demoMission value' })
    return
  }

  try {
    const demoSessionId = await withTransaction(async (client) => {
      // Lock the user row — prevents race conditions on concurrent requests
      const userRow = await client.query<{
        demo_started_at:        string | null
        demo_lessons_completed: number
      }>(
        'SELECT demo_started_at, demo_lessons_completed FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      )

      if (!userRow.rows.length) throw new Error('user not found')

      const user = userRow.rows[0]!
      if (user.demo_started_at || (user.demo_lessons_completed ?? 0) > 0) {
        const existingRes = await client.query<{ id: string }>(
          'SELECT id FROM demo_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
          [userId],
        )
        throw new DemoUsedError(existingRes.rows[0]?.id ?? null)
      }

      const sessionRes = await client.query<{ id: string }>(
        `INSERT INTO demo_sessions
           (user_id, lesson_mood, interest_area, teacher_style, speaking_confidence, demo_mission, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'started')
         RETURNING id`,
        [userId, lessonMood, interestArea, teacherStyle, speakingConfidence, demoMission],
      )
      const sid = sessionRes.rows[0]?.id
      if (!sid) throw new Error('session insert returned no id')

      // Lock demo slot — demo_started_at is the canonical "used" flag
      await client.query('UPDATE users SET demo_started_at = NOW() WHERE id = $1', [userId])

      return sid
    })

    const safeDevice = typeof deviceId === 'string' ? deviceId.slice(0, 64) : null
    console.log(`[demo] start ok: user=${userId} session=${demoSessionId} device=${safeDevice ?? 'none'} ip=${ip}`)

    res.json({ demoSessionId, nextRoute: `/demo/classroom/${demoSessionId}` })
  } catch (err) {
    if (err instanceof DemoUsedError) {
      res.status(403).json({
        code: 'DEMO_USED',
        message: 'Your free demo lesson has already been used.',
        ...(err.existingSessionId ? { existingSessionId: err.existingSessionId } : {}),
      })
      return
    }
    console.error('[demo] start error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to start demo session' })
  }
})

export default router
