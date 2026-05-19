import crypto from 'crypto'
if (!globalThis.crypto) {
  (globalThis as any).crypto = crypto.webcrypto
}

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

import cors from 'cors'
import express from 'express'
import { createServer } from 'http'
import { checkConnection as checkPostgres, initTables } from './db/postgres.js'
import { checkConnection as checkRedis } from './db/redis.js'
import { attachLessonWS, closeAllActiveClients } from './ws/lesson-ws.js'
import { setupOpenAI } from './ai/openai-handler.js'
import { initObservability, flushObservability } from './observability/index.js'
import apiRoutes     from './api/routes.js'
import authRoutes    from './api/auth-routes.js'
import demoRoutes    from './api/demo-routes.js'
import lessonRoutes  from './api/lesson-routes.js'
import billingRoutes from './billing/billing-routes.js'

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
  initObservability()

  const app = express()

  // ── CORS ───────────────────────────────────────────────────────────────────
  // cors() automatically adds Vary: Origin, handles OPTIONS preflight with
  // res.end() (no body), and only sets Access-Control-Allow-Origin when the
  // incoming Origin matches FRONTEND_URL — no wildcard, credentials allowed.
  const corsOptions: cors.CorsOptions = {
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  }
  app.use(cors(corsOptions))
  app.options('*', cors(corsOptions))

  // LiqPay callback is sent as application/x-www-form-urlencoded — must be before json()
  app.use(express.urlencoded({ extended: false }))
  app.use(express.json())
  app.use(authRoutes)
  app.use(demoRoutes)
  app.use(lessonRoutes)
  app.use(billingRoutes)
  app.use(apiRoutes)

  const server = createServer(app)
  attachLessonWS(server)

  // Start HTTP server first so Railway healthcheck is reachable immediately
  await new Promise<void>((resolve) => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] listening on 0.0.0.0:${PORT}`)
      console.log(`[server] NODE_ENV: ${process.env.NODE_ENV ?? 'development'}`)
      console.log(`[server] GET /health is available`)
      resolve()
    })
  })

  // Connect to services after HTTP is up — failures are logged but don't kill the process
  try {
    await checkPostgres()
    await initTables()
    console.log(`[server] PostgreSQL ready`)
  } catch (err) {
    console.error('[server] PostgreSQL startup error (will retry on next request):', err)
  }

  try {
    await checkRedis()
    console.log(`[server] Redis ready`)
  } catch (err) {
    console.error('[server] Redis startup error (will retry on next request):', err)
  }

  setupOpenAI()

  console.log(`[server] WS endpoint: ws://localhost:${PORT}/lesson`)
  console.log(`[server] frontend origin: ${FRONTEND_URL}`)
}

main().catch((err) => {
  console.error('[server] startup failed:', err)
  process.exit(1)
})

// ── Graceful shutdown on SIGTERM (Railway deploy, Docker stop) ───────────────
// Terminate all active WebSocket connections so their close handlers run
// (billing finalization, lesson snapshot save). Wait 5s for async ops then exit.
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received — starting graceful shutdown')
  const count = closeAllActiveClients()
  console.log(`[server] terminated ${count} active WS client(s) — waiting 5s for billing finalization`)
  flushObservability().catch(() => { /* non-fatal */ }).finally(() => {
    setTimeout(() => {
      console.log('[server] graceful shutdown complete')
      process.exit(0)
    }, 5_000)
  })
})
