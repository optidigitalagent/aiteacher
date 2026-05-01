import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'
import { checkConnection, query } from './postgres.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const MIGRATIONS = [
  '001_init.sql',
  '002_auth.sql',
  '003_profile_editable.sql',
  '003_demo_safety.sql',
  '004_demo_sessions.sql',
]

async function migrate(): Promise<void> {
  await checkConnection()

  for (const file of MIGRATIONS) {
    const sqlPath = join(__dirname, '../../migrations', file)
    const sql = readFileSync(sqlPath, 'utf-8')
    console.log(`[migrate] running ${file}...`)
    await query(sql)
    console.log(`[migrate] ${file} done`)
  }
  console.log('[migrate] all migrations applied')

  process.exit(0)
}

migrate().catch((err) => {
  console.error('[migrate] failed:', err)
  process.exit(1)
})
