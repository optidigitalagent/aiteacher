import type { Request, Response, NextFunction } from 'express'
import { verifyToken, type JwtPayload } from './jwt.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: JwtPayload }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  const token = header.slice(7)
  verifyToken(token).then((payload) => {
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }
    req.user = payload
    next()
  }).catch(() => {
    res.status(401).json({ error: 'Token verification failed' })
  })
}
