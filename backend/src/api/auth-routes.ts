import { Router, type Request, type Response } from 'express'
import { buildGoogleAuthUrl, handleGoogleCallback, FRONTEND_URL } from '../auth/google-oauth.js'
import { verifyToken } from '../auth/jwt.js'
import { requireAuth } from '../auth/middleware.js'
import { query, withTransaction } from '../db/postgres.js'
import redis from '../db/redis.js'

const router = Router()

const ALLOWED_AVATARS = ['🙂', '😎', '🦊', '🐼', '🐧', '🚀', '🌟', '🎓']

// ── Demo enum constants ───────────────────────────────────────────────────────

const LESSON_MOOD_VALUES         = ['chill_easy', 'fun_interactive', 'real_conversation', 'challenge_me'] as const
const INTEREST_AREA_VALUES       = ['music_social', 'games', 'movies_series', 'travel', 'school_life', 'future_career'] as const
const TEACHER_STYLE_VALUES       = ['friendly_coach', 'older_friend', 'real_tutor', 'challenge_trainer'] as const
const SPEAKING_CONFIDENCE_VALUES = ['freezes', 'can_try', 'okay', 'test_me'] as const
const DEMO_MISSION_VALUES        = ['real_conversation_mission', 'fix_mistakes', 'listening_check', 'find_level'] as const

// ── Demo helpers ──────────────────────────────────────────────────────────────

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
    console.warn('[demo] Redis unavailable for rate limiting — failing open')
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
router.get('/auth/google', (_req: Request, res: Response): void => {
  res.redirect(buildGoogleAuthUrl())
})

// ── GET /auth/google/callback ─────────────────────────────────────────────────
router.get('/auth/google/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, error } = req.query as Record<string, string>
  if (error || !code) {
    res.redirect(`${FRONTEND_URL}/learning?auth_error=cancelled`)
    return
  }
  try {
    const token = await handleGoogleCallback(code)
    console.log('[auth] callback success → redirecting to', `${FRONTEND_URL}/auth/callback?token=<jwt>`)
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`)
  } catch (err) {
    console.error('[auth] Google callback error:', err)
    res.redirect(`${FRONTEND_URL}/learning?auth_error=1`)
  }
})

// ── GET /api/me ───────────────────────────────────────────────────────────────
router.get('/api/me', async (req: Request, res: Response): Promise<void> => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ authenticated: false })
    return
  }
  const token   = header.slice(7)
  const payload = await verifyToken(token)
  if (!payload) {
    res.status(401).json({ authenticated: false })
    return
  }

  try {
    const r = await query<{
      id: string; email: string; name: string; avatar_url: string | null
      display_name: string | null; avatar_emoji: string | null
      level: string; rank: string; xp: number
      lessons_completed: number; demo_lessons_completed: number
      current_book: string | null; current_section: string | null
      subscription_status: string
    }>(
      `SELECT u.id, u.email, u.name, u.avatar_url,
              p.display_name, p.avatar_emoji,
              p.level, p.rank, p.xp,
              p.lessons_completed, p.demo_lessons_completed,
              p.current_book, p.current_section, p.subscription_status
       FROM users u
       LEFT JOIN user_lesson_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [payload.userId],
    )
    if (!r.rows.length) {
      res.status(404).json({ authenticated: false })
      return
    }
    const row = r.rows[0]!
    res.json({
      authenticated: true,
      user: {
        id:        row.id,
        email:     row.email,
        name:      row.name,
        avatarUrl: row.avatar_url,
      },
      profile: {
        displayName:          row.display_name ?? null,
        avatarEmoji:          row.avatar_emoji ?? null,
        level:                row.level ?? 'Beginner',
        rank:                 row.rank ?? 'New Learner',
        xp:                   row.xp ?? 0,
        lessonsCompleted:     row.lessons_completed ?? 0,
        demoLessonsCompleted: row.demo_lessons_completed ?? 0,
        currentBook:          row.current_book ?? null,
        currentSection:       row.current_section ?? null,
        subscriptionStatus:   row.subscription_status ?? 'free',
      },
    })
  } catch (err) {
    console.error('[api/me] error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// ── GET /api/profile ──────────────────────────────────────────────────────────
router.get('/api/profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId

  try {
    const r = await query<{
      id: string; email: string; name: string; avatar_url: string | null
      display_name: string | null; avatar_emoji: string | null
      level: string; rank: string; xp: number
      lessons_completed: number; demo_lessons_completed: number
      current_book: string | null; current_section: string | null
      subscription_status: string
      learning_time_minutes: number | null
      current_streak_days: number | null
      tests_completed: number | null
      average_accuracy: number | null
    }>(
      `SELECT u.id, u.email, u.name, u.avatar_url,
              p.display_name, p.avatar_emoji,
              p.level, p.rank, p.xp,
              p.lessons_completed, p.demo_lessons_completed,
              p.current_book, p.current_section, p.subscription_status,
              p.learning_time_minutes, p.current_streak_days,
              p.tests_completed, p.average_accuracy
       FROM users u
       LEFT JOIN user_lesson_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    )

    if (!r.rows.length) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const row = r.rows[0]!
    res.json({
      user: {
        id:        row.id,
        email:     row.email,
        name:      row.name,
        avatarUrl: row.avatar_url,
      },
      profile: {
        displayName:          row.display_name ?? null,
        avatarEmoji:          row.avatar_emoji ?? null,
        level:                row.level ?? 'Beginner',
        rank:                 row.rank ?? 'New Learner',
        xp:                   row.xp ?? 0,
        lessonsCompleted:     row.lessons_completed ?? 0,
        demoLessonsCompleted: row.demo_lessons_completed ?? 0,
        currentBook:          row.current_book ?? null,
        currentSection:       row.current_section ?? null,
        subscriptionStatus:   row.subscription_status ?? 'free',
      },
      stats: {
        lessonsCompleted:    row.lessons_completed ?? 0,
        learningTimeMinutes: row.learning_time_minutes ?? 0,
        currentStreakDays:   row.current_streak_days ?? 0,
        testsCompleted:      row.tests_completed ?? 0,
        averageAccuracy:     row.average_accuracy ?? null,
      },
      learningHistory: [],
      completedTests:  [],
      achievements:    [],
      insights:        [],
    })
  } catch (err) {
    console.error('[api/profile] error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// ── PATCH /api/profile ────────────────────────────────────────────────────────
router.patch('/api/profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { displayName, avatarEmoji } = req.body as { displayName?: string; avatarEmoji?: string }

  if (displayName !== undefined) {
    const trimmed = displayName.trim()
    if (trimmed.length < 2 || trimmed.length > 50) {
      res.status(400).json({ error: 'Display name must be 2–50 characters' })
      return
    }
    if (/<[^>]*>/.test(trimmed)) {
      res.status(400).json({ error: 'Display name contains invalid characters' })
      return
    }
  }

  if (avatarEmoji !== undefined && !ALLOWED_AVATARS.includes(avatarEmoji)) {
    res.status(400).json({ error: 'Invalid avatar selection' })
    return
  }

  const updates: string[] = []
  const params: unknown[]  = []

  if (displayName !== undefined) {
    params.push(displayName.trim())
    updates.push(`display_name = $${params.length}`)
  }
  if (avatarEmoji !== undefined) {
    params.push(avatarEmoji)
    updates.push(`avatar_emoji = $${params.length}`)
  }

  if (!updates.length) {
    res.status(400).json({ error: 'Nothing to update' })
    return
  }

  try {
    params.push(userId)
    await query(
      `UPDATE user_lesson_profiles SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = $${params.length}`,
      params,
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[api/profile] patch error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// ── POST /lesson/start ────────────────────────────────────────────────────────
router.post('/lesson/start', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const {
    mode, bookId, sectionId, teacherId, voiceId,
  } = req.body as Record<string, string>

  if (!sectionId || !bookId) {
    res.status(400).json({ error: 'sectionId and bookId are required' })
    return
  }

  try {
    const { v4: uuid } = await import('uuid')
    const sessionId = uuid()
    await query(
      `INSERT INTO lesson_sessions (user_id, session_id, mode, book_id, section_id, teacher_id, voice_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, sessionId, mode ?? 'textbook', bookId, sectionId, teacherId ?? 'alex', voiceId ?? 'onyx'],
    )
    res.json({ sessionId })
  } catch (err) {
    console.error('[lesson/start] error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// ── POST /demo/start ──────────────────────────────────────────────────────────
router.post('/demo/start', requireAuth, async (req: Request, res: Response): Promise<void> => {
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

  const safeDevice = typeof deviceId === 'string' ? deviceId.slice(0, 64) : null

  try {
    const demoSessionId = await withTransaction(async (client) => {
      // Row lock prevents race conditions on concurrent requests
      const userRow = await client.query<{ demo_started_at: string | null }>(
        'SELECT demo_started_at FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      )

      if (!userRow.rows.length) throw new Error('user not found')

      const user = userRow.rows[0]!
      if (user.demo_started_at) {
        const existingRes = await client.query<{ id: string }>(
          'SELECT id FROM demo_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
          [userId],
        )
        throw new DemoUsedError(existingRes.rows[0]?.id ?? null)
      }

      const sessionRes = await client.query<{ id: string }>(
        `INSERT INTO demo_sessions
           (user_id, lesson_mood, interest_area, teacher_style, speaking_confidence, demo_mission, status, device_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'started', $7)
         RETURNING id`,
        [userId, lessonMood, interestArea, teacherStyle, speakingConfidence, demoMission, safeDevice],
      )
      const sid = sessionRes.rows[0]?.id
      if (!sid) throw new Error('session insert returned no id')

      // Canonical demo lock — set immediately on start
      await client.query('UPDATE users SET demo_started_at = NOW() WHERE id = $1', [userId])

      return sid
    })

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

// ensureStudentForUser is available as a helper for future use
export { ensureStudentForUser }

export default router
