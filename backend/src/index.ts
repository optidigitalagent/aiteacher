import 'dotenv/config'
import path from 'path'

// Show which .env file dotenv picked up (process.cwd()/.env)
const envFile = path.resolve(process.cwd(), '.env')
console.log(`[env] loading from: ${envFile}`)

// AbortError from TTS cancellation is expected — don't crash the process
process.on('unhandledRejection', (reason: unknown) => {
  const isAbort =
    (reason instanceof DOMException && reason.name === 'AbortError') ||
    (reason instanceof Error && reason.name === 'AbortError')
  if (isAbort) return
  console.error('[server] unhandledRejection:', reason)
})

import express, { type Request, type Response, type NextFunction } from 'express'
import { createServer } from 'http'
import { checkConnection as checkPostgres, initTables } from './db/postgres.js'
import { checkConnection as checkRedis } from './db/redis.js'
import { attachLessonWS } from './ws/lesson-ws.js'
import { setupOpenAI } from './ai/openai-handler.js'
import apiRoutes  from './api/routes.js'
import authRoutes from './api/auth-routes.js'

const REQUIRED_ENV = [
  'DATABASE_URL', 'REDIS_URL', 'JWT_SECRET',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL',
]

// Detect values that were never replaced from .env.example
function isPlaceholder(val: string): boolean {
  return val.startsWith('PASTE_') || val.endsWith('_HERE') || val.startsWith('your-')
}

const missingEnv = REQUIRED_ENV.filter((key) => {
  const val = process.env[key] ?? ''
  return !val || isPlaceholder(val)
})
if (missingEnv.length > 0) {
  console.error('[server] Missing or placeholder environment variables:')
  for (const key of missingEnv) {
    const val = process.env[key] ?? '(not set)'
    console.error(`  - ${key} = "${val}"`)
  }
  console.error('\nReplace placeholder values in backend/.env and restart the server.')
  console.error('See backend/.env.example for the required format.')
  process.exit(1)
}

const PORT         = Number(process.env.PORT ?? 4000)
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'

async function main(): Promise<void> {
  await checkPostgres()
  await initTables()
  await checkRedis()
  setupOpenAI()

  const app = express()

  // ── CORS ───────────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL)
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    next()
  })
  app.options('*', (_req: Request, res: Response): void => { res.sendStatus(204) })

  app.use(express.json())
  app.use(authRoutes)
  app.use(apiRoutes)

  const server = createServer(app)
  attachLessonWS(server)

  server.listen(PORT, () => {
    console.log(`[server] running on http://localhost:${PORT}`)
    console.log(`[server] WS endpoint: ws://localhost:${PORT}/lesson`)
    console.log(`[server] frontend origin: ${FRONTEND_URL}`)
  })
}

main().catch((err) => {
  console.error('[server] startup failed:', err)
  process.exit(1)
})
