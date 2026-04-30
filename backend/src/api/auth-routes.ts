import { Router, type Request, type Response } from 'express'
import { buildGoogleAuthUrl, handleGoogleCallback, FRONTEND_URL } from '../auth/google-oauth.js'
import { verifyToken } from '../auth/jwt.js'
import { requireAuth } from '../auth/middleware.js'
import { query } from '../db/postgres.js'

const router = Router()

const ALLOWED_AVATARS = ['🙂', '😎', '🦊', '🐼', '🐧', '🚀', '🌟', '🎓']

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
// Protected: requires valid JWT. Creates a lesson session.
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

export default router
