import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'
import { checkConnection, query } from './postgres.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate(): Promise<void> {
  await checkConnection()

  const migrationsDir = join(__dirname, '../../migrations')
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    console.log(`[migrate] running ${file}...`)
    const sql = readFileSync(join(migrationsDir, file), 'utf-8')
    await query(sql)
    console.log(`[migrate] done: ${file}`)
  }

  process.exit(0)
}

migrate().catch((err) => {
  console.error('[migrate] failed:', err)
  process.exit(1)
})
