import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'
import { checkConnection, query } from './postgres.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate(): Promise<void> {
  await checkConnection()

  const sqlPath = join(__dirname, '../../migrations/001_init.sql')
  const sql = readFileSync(sqlPath, 'utf-8')

  console.log('[migrate] running 001_init.sql...')
  await query(sql)
  console.log('[migrate] done')

  process.exit(0)
}

migrate().catch((err) => {
  console.error('[migrate] failed:', err)
  process.exit(1)
})
