import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { checkConnection as checkPostgres } from './db/postgres.js'
import { checkConnection as checkRedis } from './db/redis.js'
import { attachLessonWS } from './ws/lesson-ws.js'

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
