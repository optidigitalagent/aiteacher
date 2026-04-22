import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { checkConnection as checkPostgres } from './db/postgres.js'
import { checkConnection as checkRedis } from './db/redis.js'
import { attachLessonWS } from './ws/lesson-ws.js'

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

  const app = express()
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() })
  })

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
