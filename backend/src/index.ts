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
import { checkConnection as checkPostgres } from './db/postgres.js'
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
  await checkRedis()
  setupOpenAI()

  const app = express()
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
