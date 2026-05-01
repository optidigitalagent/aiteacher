import { createHmac } from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import type { JwtPayload } from '../auth/jwt.js'

export interface AuthUser {
  userId: string
  email:  string
  name:   string
}

interface TokenPayload {
  sub:   string
  email: string
  name:  string
  iat:   number
  exp:   number
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('[jwt] JWT_SECRET environment variable is not set')
  return secret
}

function b64u(s: string): string {
  return Buffer.from(s).toString('base64url')
}

function sign(payload: TokenPayload): string {
  const secret = getJwtSecret()
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body   = b64u(JSON.stringify(payload))
  const sig    = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = getJwtSecret()
    const parts  = token.split('.')
    const header = parts[0]
    const body   = parts[1]
    const sig    = parts[2]
    if (!header || !body || !sig) return null
    const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
    if (sig !== expected) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload
    if (Date.now() / 1000 > payload.exp) return null
    return payload
  } catch { return null }
}

export function createToken(user: AuthUser): string {
  const now = Math.floor(Date.now() / 1000)
  return sign({
    sub:   user.userId,
    email: user.email,
    name:  user.name,
    iat:   now,
    exp:   now + 60 * 60 * 24 * 30,
  })
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Authentication required' })
    return
  }
  const payload = verifyToken(auth.slice(7))
  if (!payload) {
    res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Invalid or expired token' })
    return
  }
  req.user = { userId: payload.sub, studentId: '', email: payload.email, name: payload.name } as JwtPayload
  next()
}
