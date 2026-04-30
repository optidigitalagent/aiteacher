import 'dotenv/config'

// AbortError from TTS cancellation is expected — don't crash the process
process.on('unhandledRejection', (reason: unknown) => {
  const isAbort =
    (reason instanceof DOMException && reason.name === 'AbortError') ||
    (reason instanceof Error && reason.name === 'AbortError')
  if (isAbort) return
  console.error('[server] unhandledRejection:', reason)
})

import express from 'express'
import { createServer } from 'http'
import { checkConnection as checkPostgres, initTables } from './db/postgres.js'
import { checkConnection as checkRedis } from './db/redis.js'
import { attachLessonWS } from './ws/lesson-ws.js'
import { setupOpenAI } from './ai/openai-handler.js'
import apiRoutes from './api/routes.js'

const REQUIRED_ENV = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET']
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[server] missing required env variable: ${key}`)
    process.exit(1)
  }
}

const PORT = Number(process.env.PORT ?? 4000)

async function main(): Promise<void> {
  await checkPostgres()
  await initTables()
  await checkRedis()
  setupOpenAI()

  const app = express()

  // CORS — allow frontend origin to call the API
  app.use((req, res, next) => {
    const origin  = req.headers.origin ?? ''
    const allowed = new Set([
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'http://localhost:3000',
    ])
    if (allowed.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    if (req.method === 'OPTIONS') { res.status(204).end(); return }
    next()
  })

  app.use(express.json())
  app.use(apiRoutes)

  const server = createServer(app)
  attachLessonWS(server)

  server.listen(PORT, () => {
    console.log(`[server] running on http://localhost:${PORT}`)
    console.log(`[server] WS endpoint: ws://localhost:${PORT}/lesson`)
  })
}

main().catch((err) => {
  console.error('[server] startup failed:', err)
  process.exit(1)
})
