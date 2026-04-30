import { Router, type Request, type Response } from 'express'
import { createToken, requireAuth } from './auth-middleware.js'
import { query } from '../db/postgres.js'

const router = Router()

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? ''
const GOOGLE_CALLBACK_URL  = process.env.GOOGLE_CALLBACK_URL  ?? 'http://localhost:4000/auth/google/callback'
const FRONTEND_URL         = process.env.FRONTEND_URL         ?? 'http://localhost:3000'

// ── GET /auth/google ──────────────────────────────────────────────────────────
router.get('/auth/google', (req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: 'Google OAuth not configured on this server.' })
    return
  }
  const returnTo = (req.query.returnTo as string | undefined) ?? '/demo/setup'
  const state    = Buffer.from(JSON.stringify({ returnTo })).toString('base64url')
  const params   = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope:         'openid email profile',
    state,
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
})

// ── GET /auth/google/callback ─────────────────────────────────────────────────
interface GoogleTokenResp  { access_token?: string }
interface GoogleUserInfo   { sub?: string; email?: string; name?: string; picture?: string }

router.get('/auth/google/callback', async (req: Request, res: Response) => {
  const code  = req.query.code
  const state = req.query.state

  if (!code || typeof code !== 'string') {
    res.status(400).send('Missing authorization code')
    return
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri:  GOOGLE_CALLBACK_URL,
        grant_type:    'authorization_code',
      }).toString(),
    })
    const tokenData = await tokenRes.json() as GoogleTokenResp
    if (!tokenData.access_token) {
      res.status(400).send('OAuth token exchange failed')
      return
    }

    const userRes  = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const userInfo = await userRes.json() as GoogleUserInfo
    if (!userInfo.sub || !userInfo.email) {
      res.status(400).send('Failed to get user info from Google')
      return
    }

    const r = await query<{ id: string }>(
      `INSERT INTO users (google_id, email, name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id) DO UPDATE
         SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url, updated_at = NOW()
       RETURNING id`,
      [userInfo.sub, userInfo.email, userInfo.name ?? userInfo.email, userInfo.picture ?? null],
    )
    const userId = r.rows[0]?.id
    if (!userId) { res.status(500).send('Failed to create user'); return }

    const token = createToken({ userId, email: userInfo.email, name: userInfo.name ?? userInfo.email })

    let returnTo = '/demo/setup'
    if (state && typeof state === 'string') {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString()) as { returnTo?: string }
        returnTo = decoded.returnTo ?? '/demo/setup'
      } catch { /* use default */ }
    }

    res.redirect(`${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(returnTo)}`)
  } catch (err) {
    console.error('[auth] Google callback error:', err instanceof Error ? err.message : err)
    res.status(500).send('Authentication failed. Please try again.')
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
    }>(
      'SELECT id, email, name, avatar_url, demo_lessons_completed FROM users WHERE id = $1',
      [req.user!.userId],
    )
    if (!r.rows.length) { res.status(404).json({ error: 'User not found' }); return }
    res.json(r.rows[0])
  } catch {
    res.status(500).json({ error: 'Internal error' })
  }
})

// ── POST /demo/start ──────────────────────────────────────────────────────────
router.post('/demo/start', requireAuth, async (req: Request, res: Response) => {
  const body                      = req.body as Record<string, unknown>
  const { lessonMood, interestArea, teacherStyle, speakingConfidence, demoMission } = body

  if (!lessonMood || !interestArea || !teacherStyle || !speakingConfidence || !demoMission) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'All calibration fields are required' })
    return
  }

  try {
    const userRes = await query<{ demo_lessons_completed: number }>(
      'SELECT demo_lessons_completed FROM users WHERE id = $1',
      [req.user!.userId],
    )
    if (!userRes.rows.length) {
      res.status(400).json({ code: 'INVALID_REQUEST', message: 'User not found' })
      return
    }
    if ((userRes.rows[0].demo_lessons_completed ?? 0) > 0) {
      res.status(403).json({ code: 'DEMO_USED', message: 'Your free demo lesson has already been completed.' })
      return
    }

    const sessionRes = await query<{ id: string }>(
      `INSERT INTO demo_sessions
         (user_id, lesson_mood, interest_area, teacher_style, speaking_confidence, demo_mission)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [req.user!.userId, lessonMood, interestArea, teacherStyle, speakingConfidence, demoMission],
    )
    const demoSessionId = sessionRes.rows[0]?.id
    if (!demoSessionId) throw new Error('Session insert returned no id')

    res.json({ demoSessionId, nextRoute: `/demo/classroom/${demoSessionId}` })
  } catch (err) {
    console.error('[demo] start error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to start demo session' })
  }
})

export default router
