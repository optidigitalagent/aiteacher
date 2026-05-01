import pg from 'pg'
<<<<<<< HEAD
import { readFileSync, readdirSync } from 'fs'
=======
import { readFileSync } from 'fs'
>>>>>>> production/main
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

export async function initTables(): Promise<void> {
<<<<<<< HEAD
  const migrationsDir = join(__dirname, '../../migrations')
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8')
    await query(sql)
    console.log(`[postgres] migration: ${file}`)
  }
  console.log('[postgres] tables ready')
=======
  const migrations = ['001_init.sql', '002_auth.sql', '003_profile_editable.sql']
  for (const file of migrations) {
    const sqlPath = join(__dirname, '../../migrations', file)
    const sql = readFileSync(sqlPath, 'utf-8')
    await query(sql)
    console.log(`[postgres] migration applied: ${file}`)
  }
>>>>>>> production/main
}

export default pool
