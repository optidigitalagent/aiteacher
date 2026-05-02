import { query, withTransaction } from '../db/postgres.js'
import { signToken } from './jwt.js'

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const CALLBACK_URL  = process.env.GOOGLE_CALLBACK_URL!
export const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'

// Startup diagnostic — remove once confirmed working
console.log('[auth] GOOGLE_CLIENT_ID loaded:', CLIENT_ID ? `YES (${CLIENT_ID.slice(0, 12)}...)` : 'NO — MISSING')
console.log('[auth] GOOGLE_CLIENT_SECRET loaded:', CLIENT_SECRET ? 'YES' : 'NO — MISSING')
console.log('[auth] GOOGLE_CALLBACK_URL:', CALLBACK_URL)
console.log('[auth] FRONTEND_URL:', FRONTEND_URL)

export function buildGoogleAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  CALLBACK_URL,
    response_type: 'code',
    scope:         'openid email profile',
    access_type:   'offline',
    prompt:        'select_account',
  })
  if (state) params.set('state', state)
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

interface GoogleTokens { access_token: string }
interface GoogleUserInfo { sub: string; email: string; name: string; picture: string }

async function exchangeCode(code: string): Promise<GoogleTokens> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  CALLBACK_URL,
      grant_type:    'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`)
  return res.json() as Promise<GoogleTokens>
}

async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch Google user info')
  return res.json() as Promise<GoogleUserInfo>
}

export async function handleGoogleCallback(code: string): Promise<string> {
  const tokens   = await exchangeCode(code)
  const userInfo = await getUserInfo(tokens.access_token)

  const { userId, studentId, email, name } = await upsertUser(userInfo)
  return signToken({ userId, studentId, email, name })
}

async function upsertUser(
  info: GoogleUserInfo,
): Promise<{ userId: string; studentId: string; email: string; name: string }> {
  return withTransaction(async (client) => {
    // Upsert OAuth user
    const userRes = await client.query<{ id: string; email: string; name: string }>(
      `INSERT INTO users (google_provider_id, email, name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_provider_id) DO UPDATE
         SET email = EXCLUDED.email, name = EXCLUDED.name,
             avatar_url = EXCLUDED.avatar_url, updated_at = NOW()
       RETURNING id, email, name`,
      [info.sub, info.email, info.name, info.picture],
    )
    const user = userRes.rows[0]!

    // Create lesson profile if missing
    await client.query(
      `INSERT INTO user_lesson_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [user.id],
    )

    // Find or create a linked student record for lesson FSM
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM students WHERE user_id = $1 LIMIT 1`,
      [user.id],
    )
    let studentId: string
    if (existing.rows.length) {
      studentId = existing.rows[0]!.id
    } else {
      const newStudent = await client.query<{ id: string }>(
        `INSERT INTO students (name, age, level, textbook, current_unit, user_id)
         VALUES ($1, 16, 'B1', 'Focus 2', 1, $2)
         RETURNING id`,
        [user.name, user.id],
      )
      studentId = newStudent.rows[0]!.id
      // Create student profile
      await client.query(
        `INSERT INTO student_profiles (student_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [studentId],
      )
    }

    return { userId: user.id, studentId, email: user.email, name: user.name }
  })
}
