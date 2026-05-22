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
import apiRoutes      from './api/routes.js'
import authRoutes     from './api/auth-routes.js'
import demoRoutes     from './api/demo-routes.js'
import lessonRoutes   from './api/lesson-routes.js'
import billingRoutes  from './billing/billing-routes.js'
import telegramRoutes from './api/telegram-routes.js'

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

// OpenAI / TTS key diagnostics — prefix only, never full key
const _openAiKey = process.env.OPENAI_API_KEY ?? ''
if (_openAiKey) {
  console.log(`[env] OPENAI_API_KEY present=yes prefix=${_openAiKey.slice(0, 7)}... tts_model=${process.env.OPENAI_TTS_MODEL ?? 'tts-1'} voice=${process.env.OPENAI_TTS_VOICE ?? 'nova'}`)
} else {
  console.warn('[env] OPENAI_API_KEY present=no — demo TTS will degrade gracefully (audio skipped)')
}

const PORT         = Number(process.env.PORT ?? 4000)
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'

// Build an explicit allowlist: primary frontend + any extra origins declared in
// CORS_EXTRA_ORIGINS (comma-separated).  Set CORS_EXTRA_ORIGINS=http://localhost:3000
// in Railway QA/dev to allow Playwright running a local frontend against the
// Railway backend.  Leave it unset in production to restrict to FRONTEND_URL only.
function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>([FRONTEND_URL])
  const extra = process.env.CORS_EXTRA_ORIGINS ?? ''
  for (const o of extra.split(',').map((s) => s.trim()).filter(Boolean)) {
    origins.add(o)
  }
  return origins
}

const ALLOWED_ORIGINS = buildAllowedOrigins()

function corsOriginHandler(
  requestOrigin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  // Allow non-browser requests (curl, server-to-server) where Origin is absent
  if (!requestOrigin) { callback(null, true); return }
  if (ALLOWED_ORIGINS.has(requestOrigin)) { callback(null, true); return }
  callback(new Error(`CORS: origin not allowed — ${requestOrigin}`))
}

async function main(): Promise<void> {
  initObservability()

  const app = express()

  // ── CORS ───────────────────────────────────────────────────────────────────
  // Allowlist-based: only origins in FRONTEND_URL + CORS_EXTRA_ORIGINS are
  // permitted.  No wildcard; credentials: true preserved for cookie/JWT flows.
  // Vary: Origin is set automatically by the cors package.
  const corsOptions: cors.CorsOptions = {
    origin: corsOriginHandler,
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
  app.use(telegramRoutes)
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
  console.log(`[server] CORS allowed origins: ${[...ALLOWED_ORIGINS].join(', ')}`)
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
