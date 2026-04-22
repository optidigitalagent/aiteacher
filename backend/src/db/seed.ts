import 'dotenv/config'
import { checkConnection, query, withTransaction } from './postgres.js'

// Fixed UUIDs so seed is idempotent
const TEST_STUDENT_ID   = '00000000-0000-0000-0000-000000000001'
const TEST_PROFILE_ID   = '00000000-0000-0000-0000-000000000002'
const TEST_TEXTBOOK_ID  = '00000000-0000-0000-0000-000000000003'

async function seed(): Promise<void> {
  await checkConnection()

  await withTransaction(async (client) => {
    // Upsert test student
    await client.query(
      `INSERT INTO students (id, name, age, level, textbook, current_unit)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             level = EXCLUDED.level`,
      [TEST_STUDENT_ID, 'Alex (Test)', 15, 'B1', 'Focus B1', 1],
    )

    // Upsert student profile
    await client.query(
      `INSERT INTO student_profiles
         (id, student_id, grammar_mastery, error_patterns, learns_by, attention_span_min)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        TEST_PROFILE_ID,
        TEST_STUDENT_ID,
        JSON.stringify({ past_simple_regular: 0.4, past_simple_irregular: 0.2 }),
        ['{"forgets -ed in negatives"}'],
        'examples_first',
        20,
      ],
    )

    // Upsert Focus B1 Unit 1 textbook entry
    await client.query(
      `INSERT INTO textbook_units
         (id, textbook, unit_number, unit_title, grammar_points, vocabulary_list)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (textbook, unit_number) DO UPDATE
         SET unit_title     = EXCLUDED.unit_title,
             grammar_points = EXCLUDED.grammar_points`,
      [
        TEST_TEXTBOOK_ID,
        'Focus B1',
        1,
        'A new look',
        ['Dynamic and state verbs', 'Present Perfect Continuous'],
        ['appearance', 'personality', 'accessory', 'impression', 'identity'],
      ],
    )

    console.log('[seed] inserted test student, profile, and textbook unit')
  })

  process.exit(0)
}

seed().catch((err) => {
  console.error('[seed] failed:', err)
  process.exit(1)
})
