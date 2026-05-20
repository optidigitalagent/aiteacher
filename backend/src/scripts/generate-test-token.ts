/**
 * generate-test-token.ts
 *
 * Creates (or finds) a test user in the local DB, activates a subscription,
 * and prints a valid JWT to stdout.
 *
 * Usage:
 *   npx tsx src/scripts/generate-test-token.ts
 *
 * Then set the output as your PLAYWRIGHT_TEST_TOKEN env var:
 *   export PLAYWRIGHT_TEST_TOKEN=<printed token>
 *   npx playwright test tests/golden-runtime/
 */

import 'dotenv/config'
import { checkConnection, withTransaction } from '../db/postgres.js'
import { signToken } from '../auth/jwt.js'

const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL ?? 'playwright-test@aiteacher.local'
const TEST_NAME  = 'Playwright Test User'

const PLAN_TOTAL_MINUTES  = Number(process.env.PAID_PLAN_TOTAL_MINUTES  ?? 500)
const PLAN_LESSONS_LIMIT  = Number(process.env.PAID_PLAN_LESSONS_LIMIT  ?? 10)
const PLAN_LESSON_MINUTES = Number(process.env.PAID_PLAN_LESSON_MINUTES ?? 50)
const PLAN_DURATION_DAYS  = Number(process.env.PAID_PLAN_DURATION_DAYS  ?? 31)

async function run(): Promise<void> {
  await checkConnection()

  const { userId, studentId } = await withTransaction(async (client) => {
    // Upsert test user — uses a synthetic google_provider_id so it doesn't collide with real OAuth users
    const syntheticProviderId = `playwright-test-${TEST_EMAIL}`
    const userRes = await client.query<{ id: string }>(
      `INSERT INTO users (email, name, google_provider_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (google_provider_id) DO UPDATE
         SET email = EXCLUDED.email, name = EXCLUDED.name, updated_at = NOW()
       RETURNING id`,
      [TEST_EMAIL, TEST_NAME, syntheticProviderId],
    )
    const userId = userRes.rows[0]!.id

    // Create/reset lesson profile with active subscription + minutes
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + PLAN_DURATION_DAYS)

    await client.query(
      `INSERT INTO user_lesson_profiles
         (user_id, subscription_status, plan_id, plan_started_at, plan_expires_at,
          paid_minutes_limit, paid_minutes_used, paid_lessons_limit, paid_lesson_minutes)
       VALUES ($1, 'active', 'playwright_test', NOW(), $2, $3, 0, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
             subscription_status = 'active',
             plan_id             = 'playwright_test',
             plan_started_at     = NOW(),
             plan_expires_at     = $2,
             paid_minutes_limit  = $3,
             paid_minutes_used   = 0,
             paid_lessons_limit  = $4,
             paid_lesson_minutes = $5,
             updated_at          = NOW()`,
      [userId, expiresAt, PLAN_TOTAL_MINUTES, PLAN_LESSONS_LIMIT, PLAN_LESSON_MINUTES],
    )

    // Find or create linked student record
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM students WHERE user_id = $1 LIMIT 1`,
      [userId],
    )
    let studentId: string
    if (existing.rows.length) {
      studentId = existing.rows[0]!.id
    } else {
      const newStudent = await client.query<{ id: string }>(
        `INSERT INTO students (name, age, level, textbook, current_unit, user_id)
         VALUES ($1, 16, 'B1', 'Focus 2', 1, $2)
         RETURNING id`,
        [TEST_NAME, userId],
      )
      studentId = newStudent.rows[0]!.id
      await client.query(
        `INSERT INTO student_profiles (student_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [studentId],
      )
    }

    return { userId, studentId }
  })

  const token = await signToken({
    userId,
    studentId,
    email: TEST_EMAIL,
    name:  TEST_NAME,
  })

  console.log('\n✅ Test user ready:')
  console.log(`   email:      ${TEST_EMAIL}`)
  console.log(`   userId:     ${userId}`)
  console.log(`   studentId:  ${studentId}`)
  console.log(`   plan:       active, ${PLAN_TOTAL_MINUTES} minutes, expires in ${PLAN_DURATION_DAYS} days`)
  console.log('\n📋 Copy this to your shell:')
  console.log(`\nexport PLAYWRIGHT_TEST_TOKEN=${token}\n`)

  process.exit(0)
}

run().catch((err) => {
  console.error('[generate-test-token] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
