import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
  console.error('[postgres] idle client error:', err.message)
})

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const start = Date.now()
  const result = await pool.query<T>(text, params)
  const duration = Date.now() - start
  if (duration > 500) {
    console.warn(`[postgres] slow query (${duration}ms):`, text.slice(0, 80))
  }
  return result
}

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function checkConnection(): Promise<void> {
  const result = await pool.query<{ now: Date }>('SELECT NOW()')
  console.log('[postgres] connected, server time:', result.rows[0].now)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const MIGRATIONS = [
  '001_init.sql',
  '002_auth.sql',
  '003_profile_editable.sql',
  '003_demo_safety.sql',
  '004_demo_sessions.sql',
  '005_demo_engine.sql',
  '006_abuse_tracking.sql',
  '007_reset_inprogress.sql',
  '008_billing.sql',
  '009_paid_lesson_resume.sql',
  '010_fix_billing_precision.sql',
  '011_student_tips.sql',
  '012_lesson_snapshots.sql',
  '013_runtime_safety.sql',
  '014_student_memory.sql',
  '015_lesson_transcripts.sql',
  '016_student_skill_mastery.sql',
  '017_telegram_integrations.sql',
]

export async function initTables(): Promise<void> {
  for (const file of MIGRATIONS) {
    const sqlPath = join(__dirname, '../../migrations', file)
    const sql = readFileSync(sqlPath, 'utf-8')
    await query(sql)
    console.log(`[postgres] migration applied: ${file}`)
  }
  console.log('[postgres] tables ready')
}

export default pool
