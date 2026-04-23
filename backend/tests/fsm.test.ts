/**
 * FSM integration test — no real AI calls.
 * Uses real Redis + PostgreSQL (Docker must be running).
 * Verifies all 7 phase transitions and difficulty adaptation.
 */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import redis, { lessonStateKey, LESSON_TTL } from '../src/db/redis.js'
import { query } from '../src/db/postgres.js'
import { LessonOrchestrator, registerAIHandler } from '../src/lesson/orchestrator.js'
import type { LessonState, AIResponse, LessonPhase } from '../src/lesson/types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

const studentId = '00000000-0000-0000-0000-000000000001' // seeded

function makeState(lessonId: string, overrides: Partial<LessonState> = {}): LessonState {
  const now = new Date().toISOString()
  return {
    lessonId,
    studentId,
    phase:               'DIAGNOSTIC',
    grammarTarget:       'Past Simple',
    lessonTopic:         'Mount Everest',
    textbookUnit:        'Focus B1 Unit 2',
    exchangeCount:          0,
    exerciseCount:          0,
    consecutiveCorrect:     0,
    consecutiveErrors:      0,
    currentDifficulty:      0.3,
    deepThinkingExchanges:  0,
    vocabularyTaught:       [],
    errorsThisLesson:       [],
    studentConfirmedReading: false,
    ruleStatedCorrectly:     false,
    summaryDelivered:        false,
    startedAt:       now,
    phaseStartedAt:  now,
    ...overrides,
  }
}

async function createLesson(lessonId: string): Promise<void> {
  await query(
    `INSERT INTO lessons (id, student_id, grammar_target, lesson_topic, textbook_unit)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [lessonId, studentId, 'Past Simple', 'Mount Everest', 'Focus B1 Unit 2'],
  )
}

async function seedState(state: LessonState): Promise<void> {
  await redis.set(lessonStateKey(state.lessonId), JSON.stringify(state), 'EX', LESSON_TTL)
}

async function readState(lessonId: string): Promise<LessonState> {
  const raw = await redis.get(lessonStateKey(lessonId))
  if (!raw) throw new Error('state missing from Redis')
  return JSON.parse(raw) as LessonState
}

function mockAI(next_action: string): void {
  registerAIHandler(async (): Promise<AIResponse> => ({
    speech: 'ok', display_text: 'ok', next_action, exercise: null, internal_note: '',
  }))
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  ✗  ${name}\n     ${msg}`)
    failed++
  }
}

// ── Test suite ────────────────────────────────────────────────────────────────

console.log('\n=== FSM Phase Transition Tests ===\n')

const orc = new LessonOrchestrator()

// 1. DIAGNOSTIC stays on first exchange
await test('DIAGNOSTIC: stays in phase on first exchange', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id, { exchangeCount: 0 }))
  mockAI('continue_phase')
  const r = await orc.process(id, 'I know a little about past simple')
  assert.equal(r.phase, 'DIAGNOSTIC')
  assert.equal(r.phaseChanged, false)
})

// 2. DIAGNOSTIC → CONTEXT_INPUT after 2 exchanges
await test('DIAGNOSTIC → CONTEXT_INPUT after 2 exchanges', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id, { exchangeCount: 1 }))
  mockAI('continue_phase')
  const r = await orc.process(id, 'I used went and walked before')
  assert.equal(r.phase, 'CONTEXT_INPUT')
  assert.equal(r.phaseChanged, true)
  assert.equal(r.previousPhase, 'DIAGNOSTIC')
})

// 3. CONTEXT_INPUT stays without signal
await test('CONTEXT_INPUT: stays until student confirms reading', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id, { phase: 'CONTEXT_INPUT', exchangeCount: 2 }))
  mockAI('continue_phase')
  const r = await orc.process(id, 'I read the text')
  assert.equal(r.phase, 'CONTEXT_INPUT')
})

// 4. CONTEXT_INPUT → RULE_DISCOVERY via AI signal
await test('CONTEXT_INPUT → RULE_DISCOVERY on AI signal', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id, { phase: 'CONTEXT_INPUT', exchangeCount: 2 }))
  mockAI('student_confirmed_reading')
  const r = await orc.process(id, 'Yes I read it')
  assert.equal(r.phase, 'RULE_DISCOVERY')
  assert.equal(r.phaseChanged, true)
})

// 5. RULE_DISCOVERY stays without signal
await test('RULE_DISCOVERY: stays until rule stated', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id, { phase: 'RULE_DISCOVERY', exchangeCount: 3 }))
  mockAI('continue_phase')
  const r = await orc.process(id, 'we add -ed?')
  assert.equal(r.phase, 'RULE_DISCOVERY')
})

// 6. RULE_DISCOVERY → EXERCISES via AI signal
await test('RULE_DISCOVERY → EXERCISES on AI signal', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id, { phase: 'RULE_DISCOVERY', exchangeCount: 3 }))
  mockAI('rule_stated_correctly')
  const r = await orc.process(id, 'Regular verbs add -ed, irregular change form')
  assert.equal(r.phase, 'EXERCISES')
  assert.equal(r.phaseChanged, true)
})

// 7. EXERCISES stays before 6 done
await test('EXERCISES: stays until 6 exercises done', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id, { phase: 'EXERCISES', exerciseCount: 4, exchangeCount: 6 }))
  mockAI('continue_phase')
  const r = await orc.process(id, 'reached')
  assert.equal(r.phase, 'EXERCISES')
})

// 8. EXERCISES → VOCABULARY after 6 exercises
await test('EXERCISES → VOCABULARY after 6 exercises', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id, { phase: 'EXERCISES', exerciseCount: 5, exchangeCount: 10 }))
  // recordExerciseResult increments exerciseCount → 6
  await orc.recordExerciseResult(id, true)
  const s = await readState(id)
  assert.equal(s.exerciseCount, 6)

  mockAI('continue_phase')
  const r = await orc.process(id, 'walked')
  assert.equal(r.phase, 'VOCABULARY')
  assert.equal(r.phaseChanged, true)
})

// 9. VOCABULARY → DEEP_THINKING after 6 words
await test('VOCABULARY → DEEP_THINKING after 6 words taught', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id, {
    phase: 'VOCABULARY',
    exerciseCount: 6,
    vocabularyTaught: ['summit', 'expedition', 'ascent', 'perseverance', 'conquer', 'attempt'],
  }))
  mockAI('continue_phase')
  const r = await orc.process(id, 'ok I understand summit')
  assert.equal(r.phase, 'DEEP_THINKING')
  assert.equal(r.phaseChanged, true)
})

// 10. DEEP_THINKING stays before 3 exchanges
await test('DEEP_THINKING: stays until 3 exchanges', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id, {
    phase: 'DEEP_THINKING',
    deepThinkingExchanges: 1,
    vocabularyTaught: ['summit', 'expedition', 'ascent', 'perseverance', 'conquer', 'attempt'],
  }))
  mockAI('continue_phase')
  const r = await orc.process(id, 'I agree with Hillary')
  assert.equal(r.phase, 'DEEP_THINKING')
})

// 11. DEEP_THINKING → WRAP_UP after 3 exchanges
await test('DEEP_THINKING → WRAP_UP after 3 exchanges', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id, {
    phase: 'DEEP_THINKING',
    deepThinkingExchanges: 2,
    vocabularyTaught: ['summit', 'expedition', 'ascent', 'perseverance', 'conquer', 'attempt'],
  }))
  mockAI('continue_phase')
  const r = await orc.process(id, 'Failure makes you stronger')
  assert.equal(r.phase, 'WRAP_UP')
  assert.equal(r.phaseChanged, true)
})

// 12. WRAP_UP → END via AI signal
await test('WRAP_UP → END on summary_delivered signal', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id, {
    phase: 'WRAP_UP',
    deepThinkingExchanges: 3,
    vocabularyTaught: ['summit', 'expedition', 'ascent', 'perseverance', 'conquer', 'attempt'],
  }))
  mockAI('summary_delivered')
  const r = await orc.process(id, 'thank you')
  assert.equal(r.phase, 'END')
  assert.equal(r.ended, true)

  // Verify DB updated
  const db = await query<{ status: string }>('SELECT status FROM lessons WHERE id = $1', [id])
  assert.equal(db.rows[0]?.status, 'completed')
})

// 13. Difficulty: drops after 2 errors
await test('difficulty drops after 2 consecutive errors', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id, { phase: 'EXERCISES', currentDifficulty: 0.5 }))
  await orc.recordExerciseResult(id, false)
  await orc.recordExerciseResult(id, false)
  const s = await readState(id)
  assert.ok(s.currentDifficulty < 0.5, `expected < 0.5, got ${s.currentDifficulty}`)
  assert.equal(s.consecutiveErrors, 2)
})

// 14. Difficulty: rises after 3 correct
await test('difficulty rises after 3 consecutive correct', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id, { phase: 'EXERCISES', exerciseCount: 2, currentDifficulty: 0.3 }))
  await orc.recordExerciseResult(id, true)
  await orc.recordExerciseResult(id, true)
  await orc.recordExerciseResult(id, true)
  const s = await readState(id)
  assert.ok(s.currentDifficulty > 0.3, `expected > 0.3, got ${s.currentDifficulty}`)
  assert.equal(s.consecutiveCorrect, 3)
})

// 15. Full lesson walk: DIAGNOSTIC → END
await test('full lesson walk: all 7 phases in correct order', async () => {
  const id = randomUUID()
  await createLesson(id)
  await seedState(makeState(id))
  const orc2 = new LessonOrchestrator()
  const phases: LessonPhase[] = []

  // DIAGNOSTIC × 2 → CONTEXT_INPUT
  mockAI('continue_phase')
  await orc2.process(id, 'hello')
  let r = await orc2.process(id, 'I know -ed rule')
  phases.push(r.phase) // CONTEXT_INPUT

  // CONTEXT_INPUT → RULE_DISCOVERY
  mockAI('student_confirmed_reading')
  r = await orc2.process(id, 'I read it')
  phases.push(r.phase) // RULE_DISCOVERY

  // RULE_DISCOVERY → EXERCISES
  mockAI('rule_stated_correctly')
  r = await orc2.process(id, 'add -ed for regular, change for irregular')
  phases.push(r.phase) // EXERCISES

  // EXERCISES: 6 correct → VOCABULARY
  mockAI('continue_phase')
  for (let i = 0; i < 5; i++) await orc2.recordExerciseResult(id, true)
  await orc2.recordExerciseResult(id, true) // 6th
  r = await orc2.process(id, 'reached')
  phases.push(r.phase) // VOCABULARY

  // VOCABULARY: inject 6 words → DEEP_THINKING
  const s = await readState(id)
  s.vocabularyTaught = ['summit', 'expedition', 'ascent', 'perseverance', 'conquer', 'attempt']
  await redis.set(lessonStateKey(id), JSON.stringify(s), 'EX', LESSON_TTL)
  r = await orc2.process(id, 'got it')
  phases.push(r.phase) // DEEP_THINKING

  // DEEP_THINKING: 3 exchanges → WRAP_UP
  mockAI('continue_phase')
  await orc2.process(id, 'interesting thought')
  await orc2.process(id, 'another thought')
  r = await orc2.process(id, 'final thought')
  phases.push(r.phase) // WRAP_UP

  // WRAP_UP → END
  mockAI('summary_delivered')
  r = await orc2.process(id, 'thanks')
  phases.push(r.phase) // END

  assert.deepEqual(phases, [
    'CONTEXT_INPUT', 'RULE_DISCOVERY', 'EXERCISES',
    'VOCABULARY', 'DEEP_THINKING', 'WRAP_UP', 'END',
  ])
  assert.equal(r.ended, true)
})

// ── Results ───────────────────────────────────────────────────────────────────

await redis.quit()

console.log(`\n${'─'.repeat(40)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
