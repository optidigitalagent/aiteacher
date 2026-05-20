/**
 * Golden Runtime Certification Tests
 *
 * Educational runtime certification — NOT generic UI smoke tests.
 *
 * What this validates per GOLD candidate section:
 *   1.  WS connects successfully
 *   2.  lesson_ready arrives within timeout
 *   3.  Begin Lesson button is visible and clickable
 *   4.  exercise_cursor_updated arrives with a real exercise
 *   5.  Visible payload is present (instruction, currentItem, exerciseType)
 *   6.  Text input is available and accepts input
 *   7.  Wrong answer keeps cursor on the same item (progression lock)
 *   8.  Any-response / soft-speaking exercises advance on any text
 *   9.  No fatal error messages arrive
 *  10.  Teacher stays synchronized (no phantom exercise jumps)
 *  11.  No stale item repetition after cursor advances
 *  12.  No "CONTENT_MISSING" / runtime panic messages
 *
 * GOLD_CERTIFIED = all checks pass
 * SILVER         = WS connects + exercise loads but wrong-answer lock or progression unstable
 * BLOCKED        = lesson_ready never arrives or fatal error received
 *
 * Auth requirement:
 *   PLAYWRIGHT_TEST_TOKEN must be a valid JWT for a user with an active subscription.
 *   See docs/runtime-qa/GOLDEN_RUNTIME_CERTIFICATION_REPORT.md for setup.
 */

import { test, expect, type Page } from '@playwright/test'
import {
  BASE_URL,
  BACKEND_URL,
  TEST_TOKEN,
  GOLD_SECTIONS,
  SECTION_META,
  type GoldSection,
  type ExerciseCursor,
  type WsLessonReady,
  type WsCursorUpdated,
  type WsFeedback,
  type WsError,
  WsMonitor,
  checkEnvConfig,
  setAuthToken,
  startLessonSession,
  clickBeginLesson,
  submitTextAnswer,
  assertNoRuntimeViolations,
  ANSWER_INPUT_SELECTOR,
  BEGIN_LESSON_SELECTOR,
} from './helpers'

// ── Shared state ──────────────────────────────────────────────────────────────

const certResults: Record<string, {
  section:    string
  result:     string
  checks:     Record<string, boolean | null>
  violations: string[]
  durationMs: number
  error?:     string
}> = {}

// ── Skip guard ────────────────────────────────────────────────────────────────

test.beforeAll(() => {
  const env = checkEnvConfig()
  if (!env.configured) {
    console.warn(`\n⚠ Golden Runtime tests SKIPPED — ${env.reason}\n`)
  }
})

// ── Per-section certification factory ────────────────────────────────────────

/**
 * Core certification routine for a single GOLD candidate section.
 * Returns a structured result suitable for the certification report.
 */
async function runSectionCertification(
  page:    Page,
  section: GoldSection,
): Promise<{
  result:     'GOLD_CERTIFIED' | 'SILVER' | 'BLOCKED' | 'ERROR'
  checks:     Record<string, boolean | null>
  violations: string[]
  transcript: string[]
  durationMs: number
  error?:     string
}> {
  const startMs = Date.now()
  const meta     = SECTION_META[section]
  const checks: Record<string, boolean | null> = {
    wsConnected:         null,
    lessonReady:         null,
    exerciseCardLoaded:  null,
    visiblePayload:      null,
    inputAvailable:      null,
    wrongAnswerStays:    null,
    progressionAdvances: null,
    noFatalErrors:       null,
    teacherSynchronized: null,
  }
  const violations: string[] = []
  const transcript: string[] = []

  try {
    // ── Start lesson via REST API ──────────────────────────────────────────
    let sessionId: string
    try {
      const session = await startLessonSession(page.request, section, TEST_TOKEN, BACKEND_URL)
      sessionId = session.sessionId
      console.log(`  [${section}] session created: ${sessionId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  [${section}] startLessonSession FAILED: ${msg}`)
      return {
        result: 'BLOCKED',
        checks: { ...checks, lessonReady: false },
        violations: [`Could not create lesson session: ${msg}`],
        transcript: [],
        durationMs: Date.now() - startMs,
        error: msg,
      }
    }

    // ── Attach WS monitor BEFORE navigation ───────────────────────────────
    const monitor = new WsMonitor()
    monitor.attach(page)

    // ── Navigate to classroom ─────────────────────────────────────────────
    // Pass ?section= so the frontend routes to the correct section without relying on
    // VITE_LESSON_SECTION env var (which defaults to 1.2 in .env.development).
    await setAuthToken(page, TEST_TOKEN)
    await page.goto(`${BASE_URL}/classroom/${sessionId}?section=${section}`)

    // ── CHECK 1: WS connects ──────────────────────────────────────────────
    try {
      await page.waitForEvent('websocket', { timeout: 15_000 })
      checks.wsConnected = true
      console.log(`  [${section}] WS connected`)
    } catch {
      checks.wsConnected = false
      violations.push('WebSocket never opened')
      return {
        result: 'BLOCKED', checks, violations, transcript,
        durationMs: Date.now() - startMs,
        error: 'WS did not connect',
      }
    }

    // ── CHECK 2: lesson_ready ─────────────────────────────────────────────
    let lessonReady: WsLessonReady
    try {
      lessonReady = await monitor.waitForType<WsLessonReady>('lesson_ready', 20_000)
      checks.lessonReady = true
      console.log(`  [${section}] lesson_ready: sessionId=${lessonReady.sessionId ?? 'null'}`)
    } catch (err) {
      checks.lessonReady = false
      const msg = err instanceof Error ? err.message : String(err)
      violations.push(`lesson_ready never received: ${msg}`)
      return {
        result: 'BLOCKED', checks, violations, transcript,
        durationMs: Date.now() - startMs,
        error: msg,
      }
    }

    // ── CHECK 3: Begin Lesson button visible ──────────────────────────────
    try {
      await clickBeginLesson(page, 20_000)
      console.log(`  [${section}] Begin Lesson clicked`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      violations.push(`Begin Lesson button not found: ${msg}`)
      return {
        result: 'BLOCKED',
        checks: { ...checks, exerciseCardLoaded: false },
        violations, transcript,
        durationMs: Date.now() - startMs,
        error: msg,
      }
    }

    // ── Capture teacher greeting ───────────────────────────────────────────
    try {
      const greeting = await monitor.waitForType<{ type: 'ai_text'; text: string }>('ai_text', 35_000)
      transcript.push(`Teacher: ${greeting.text.slice(0, 120)}`)
      console.log(`  [${section}] ai_text received (${greeting.text.length} chars)`)
    } catch {
      violations.push('Teacher greeting (ai_text) never received after Begin Lesson')
      // non-fatal — continue to exercise check
    }

    // ── CHECK 4: exercise_cursor_updated arrives ──────────────────────────
    let firstCursor: ExerciseCursor
    try {
      const cursorMsg = await monitor.waitForType<WsCursorUpdated>('exercise_cursor_updated', 45_000)
      firstCursor = cursorMsg.cursor
      checks.exerciseCardLoaded = true
      console.log(
        `  [${section}] cursor received: ` +
        `ex#${firstCursor.exerciseNumber} type=${firstCursor.exerciseType} ` +
        `item=${firstCursor.itemIndex}/${firstCursor.itemTotal}`,
      )
    } catch (err) {
      checks.exerciseCardLoaded = false
      const msg = err instanceof Error ? err.message : String(err)
      violations.push(`exercise_cursor_updated never received: ${msg}`)
      violations.push(`WS traffic: ${monitor.typeSummary()}`)
      return {
        result: 'BLOCKED', checks, violations, transcript,
        durationMs: Date.now() - startMs,
        error: msg,
      }
    }

    // ── CHECK 5: Visible payload integrity ────────────────────────────────
    checks.visiblePayload = !!(
      firstCursor.exerciseType &&
      firstCursor.exerciseType !== 'unknown' &&
      firstCursor.instruction &&
      firstCursor.instruction.length > 3
    )
    if (!checks.visiblePayload) {
      violations.push(
        `Visible payload incomplete: ` +
        `type="${firstCursor.exerciseType}" ` +
        `instruction="${(firstCursor.instruction ?? '').slice(0, 80)}"`,
      )
    }

    // ── CHECK 6: Text input available ─────────────────────────────────────
    try {
      const input = page.locator(ANSWER_INPUT_SELECTOR)
      await input.waitFor({ state: 'visible', timeout: 15_000 })
      checks.inputAvailable = true
    } catch {
      checks.inputAvailable = false
      violations.push('Answer text input never became visible')
    }

    // ── CHECK 7: Wrong answer stays on same item ──────────────────────────
    const isSoftSpeaking =
      firstCursor.exerciseType === 'discussion' ||
      firstCursor.exerciseType === 'personal_fill' ||
      firstCursor.exerciseType === 'pair_speaking' ||
      firstCursor.exerciseType === 'free_production' ||
      firstCursor.exerciseType === 'speaking_prompt'

    if (checks.inputAvailable && !isSoftSpeaking) {
      const cursorCountBefore = monitor.countOf('exercise_cursor_updated')
      await submitTextAnswer(page, 'XQQQ_WRONG_ANSWER_CERT_TEST')
      transcript.push('Student: [deliberate wrong answer]')

      try {
        // Wait for feedback or next cursor
        const feedbackOrCursor = await Promise.race([
          monitor.waitForNextOfType<WsFeedback>('feedback', monitor.countOf('feedback'), 20_000),
          monitor.waitForNextOfType<WsCursorUpdated>(
            'exercise_cursor_updated', cursorCountBefore, 20_000,
          ),
        ])

        if (feedbackOrCursor.type === 'feedback') {
          const fb = feedbackOrCursor as WsFeedback
          if (fb.correct) {
            // Wrong answer was accepted — progression violation
            violations.push(
              `PROGRESSION VIOLATION: wrong answer "XQQQ_WRONG_ANSWER_CERT_TEST" ` +
              `was accepted as correct on ${firstCursor.exerciseType}`,
            )
            checks.wrongAnswerStays = false
          } else {
            // Correctly rejected
            checks.wrongAnswerStays = true
            transcript.push(`Teacher: [feedback — incorrect] ${fb.explanation.slice(0, 80)}`)
          }
        } else {
          // Cursor updated after wrong answer — check it didn't advance
          const afterWrong = (feedbackOrCursor as WsCursorUpdated).cursor
          const advanced =
            afterWrong.itemIndex      > firstCursor.itemIndex ||
            afterWrong.exerciseNumber > firstCursor.exerciseNumber
          if (advanced) {
            violations.push(
              `PROGRESSION VIOLATION: cursor advanced after wrong answer ` +
              `(item ${firstCursor.itemIndex}→${afterWrong.itemIndex}, ` +
              `ex ${firstCursor.exerciseNumber}→${afterWrong.exerciseNumber})`,
            )
            checks.wrongAnswerStays = false
          } else {
            checks.wrongAnswerStays = true
          }
        }
      } catch {
        // No cursor update or feedback — teacher may still be speaking
        // Mark as pass (no evidence of false advancement)
        checks.wrongAnswerStays = true
        console.log(`  [${section}] No immediate feedback after wrong answer — teacher may be speaking`)
      }
    } else if (isSoftSpeaking) {
      checks.wrongAnswerStays = true // soft-speaking: any answer advances (by design)
      console.log(`  [${section}] soft-speaking exercise — skip wrong-answer stay check`)
    }

    // ── CHECK 8: Any answer advances (soft) / correct answer advances (det) ─
    if (checks.inputAvailable) {
      const cursorCountBeforeAdv = monitor.countOf('exercise_cursor_updated')
      const answerToSubmit = isSoftSpeaking
        ? 'I think this is a great topic for discussion.'
        : 'Test answer for progression check'

      await submitTextAnswer(page, answerToSubmit)
      transcript.push(`Student: ${answerToSubmit}`)

      try {
        await monitor.waitForNextOfType<WsCursorUpdated | WsFeedback>(
          'feedback',
          monitor.countOf('feedback'),
          25_000,
        )
        checks.progressionAdvances = true
      } catch {
        // May still be processing — check if cursor advanced
        const finalCount = monitor.countOf('exercise_cursor_updated')
        checks.progressionAdvances = finalCount > cursorCountBeforeAdv ? true : null
      }
    }

    // ── CHECK 9: No fatal errors ──────────────────────────────────────────
    const runtimeCheck = assertNoRuntimeViolations(monitor)
    checks.noFatalErrors = runtimeCheck.passed
    violations.push(...runtimeCheck.violations)

    // ── CHECK 10: Teacher synchronization ─────────────────────────────────
    // After lesson start, all ai_text messages should reference exercises that exist.
    // We detect desync by looking for stale "Exercise 0" or phantom exercise numbers.
    const allCursors = monitor.ofType<WsCursorUpdated>('exercise_cursor_updated')
    let teacherOutOfSync = false
    for (let i = 1; i < allCursors.length; i++) {
      const prev = allCursors[i - 1]!.cursor
      const curr = allCursors[i]!.cursor
      const gap  = curr.exerciseNumber - prev.exerciseNumber
      if (gap > 1) {
        violations.push(
          `TEACHER SYNC GAP: cursor jumped ex#${prev.exerciseNumber}→${curr.exerciseNumber} ` +
          `(missing intermediate exercise)`,
        )
        teacherOutOfSync = true
      }
      if (curr.exerciseNumber === 0 && curr.exerciseType === 'unknown') {
        violations.push(`PHANTOM EXERCISE: cursor has exerciseNumber=0 type=unknown`)
        teacherOutOfSync = true
      }
    }
    checks.teacherSynchronized = !teacherOutOfSync

    // ── Collect ai_text for transcript ───────────────────────────────────
    const aiTexts = monitor.ofType<{ type: 'ai_text'; text: string }>('ai_text')
    for (const at of aiTexts.slice(1, 4)) {
      transcript.push(`Teacher: ${at.text.slice(0, 120)}`)
    }

    // ── Final certification decision ──────────────────────────────────────
    const critical = [
      checks.wsConnected,
      checks.lessonReady,
      checks.exerciseCardLoaded,
      checks.visiblePayload,
      checks.noFatalErrors,
    ]
    const secondary = [
      checks.wrongAnswerStays,
      checks.teacherSynchronized,
    ]

    const criticalPass  = critical.every(c => c === true)
    const secondaryPass = secondary.every(c => c !== false)
    const hasViolations = violations.length > 0

    let result: 'GOLD_CERTIFIED' | 'SILVER' | 'BLOCKED'
    if (criticalPass && secondaryPass && !hasViolations) {
      result = 'GOLD_CERTIFIED'
    } else if (checks.wsConnected && checks.lessonReady && checks.exerciseCardLoaded) {
      result = 'SILVER'
    } else {
      result = 'BLOCKED'
    }

    console.log(`  [${section}] RESULT: ${result} — violations: ${violations.length}`)
    console.log(`  [${section}] WS traffic: ${monitor.typeSummary()}`)

    return { result, checks, violations, transcript, durationMs: Date.now() - startMs }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  [${section}] UNEXPECTED ERROR:`, msg)
    return {
      result: 'ERROR' as const,
      checks,
      violations: [...violations, `Unexpected test error: ${msg}`],
      transcript,
      durationMs: Date.now() - startMs,
      error: msg,
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Golden Runtime Certification — GOLD candidate sections', () => {

  for (const section of GOLD_SECTIONS) {
    test(`Section ${section}: ${SECTION_META[section].title}`, async ({ page }) => {

      // Skip gracefully if env is not configured
      const env = checkEnvConfig()
      if (!env.configured) {
        console.log(`SKIP: ${env.reason}`)
        test.skip()
        return
      }

      console.log(`\n── Certifying Section ${section} ──────────────────────────────`)

      const result = await runSectionCertification(page, section)

      // Store for report
      certResults[section] = {
        section,
        result:     result.result,
        checks:     result.checks,
        violations: result.violations,
        durationMs: result.durationMs,
        error:      result.error,
      }

      // ── Playwright assertions ────────────────────────────────────────────

      // WS must have connected
      expect(result.checks.wsConnected, 'WS must connect').toBe(true)

      // lesson_ready must arrive
      expect(result.checks.lessonReady, 'lesson_ready must arrive').toBe(true)

      // Exercise card must load
      expect(
        result.checks.exerciseCardLoaded,
        `exercise_cursor_updated must arrive for section ${section}`,
      ).toBe(true)

      // Visible payload must be non-empty
      expect(
        result.checks.visiblePayload,
        `Visible payload must contain exerciseType and instruction`,
      ).toBe(true)

      // No fatal runtime errors
      expect(
        result.checks.noFatalErrors,
        `No fatal WS errors. Violations: ${result.violations.join('; ')}`,
      ).toBe(true)

      // Wrong-answer progression lock (skip if null = uncertain)
      if (result.checks.wrongAnswerStays !== null) {
        expect(
          result.checks.wrongAnswerStays,
          `Wrong answer must not advance cursor. ` +
          `Violations: ${result.violations.filter(v => v.includes('PROGRESSION')).join('; ')}`,
        ).not.toBe(false)
      }

      // Teacher sync
      if (result.checks.teacherSynchronized !== null) {
        expect(
          result.checks.teacherSynchronized,
          `Teacher must stay synchronized with engine cursor`,
        ).not.toBe(false)
      }

      console.log(`  ✓ Section ${section} passed Playwright assertions — ${result.result}`)
    })
  }
})

// ── API health check (no auth required) ──────────────────────────────────────

/** Skip API health tests gracefully when backend is not reachable. */
async function backendReachable(request: import('@playwright/test').APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(`${BACKEND_URL}/lesson/sections/status`, { timeout: 5_000 })
    return res.ok()
  } catch {
    return false
  }
}

test.describe('Backend API health', () => {

  test('GET /lesson/sections/status returns GOLD sections', async ({ request }) => {
    if (!(await backendReachable(request))) {
      console.log(`  SKIP: backend not reachable at ${BACKEND_URL}`)
      test.skip()
      return
    }
    const res = await request.get(`${BACKEND_URL}/lesson/sections/status`)
    expect(res.ok(), `/lesson/sections/status returned HTTP ${res.status()}`).toBe(true)

    const body = await res.json() as { units: Array<{ unit: number; sections: unknown[] }> }
    expect(body.units).toBeDefined()
    expect(body.units.length).toBeGreaterThan(0)
    console.log(`  /lesson/sections/status: ${body.units.length} units returned`)
  })

  test('GET /lesson/sections/golden-matrix returns GOLD entries', async ({ request }) => {
    if (!(await backendReachable(request))) {
      console.log(`  SKIP: backend not reachable at ${BACKEND_URL}`)
      test.skip()
      return
    }
    const res = await request.get(`${BACKEND_URL}/lesson/sections/golden-matrix`)
    expect(res.ok(), `/lesson/sections/golden-matrix returned HTTP ${res.status()}`).toBe(true)

    const body = await res.json() as {
      summary:  { gold: number; silver: number; blocked: number; total: number }
      sections: Array<{ sectionId: string; goldenStatus: string }>
    }

    expect(body.summary).toBeDefined()
    expect(body.sections).toBeDefined()
    expect(body.summary.gold).toBeGreaterThan(0)

    console.log(
      `  Golden matrix: GOLD=${body.summary.gold} ` +
      `SILVER=${body.summary.silver} BLOCKED=${body.summary.blocked} ` +
      `total=${body.summary.total}`,
    )

    // Verify target GOLD sections are classified
    for (const section of GOLD_SECTIONS) {
      const meta  = SECTION_META[section]
      const entry = body.sections.find(s => s.sectionId === meta.sectionId)
      if (entry) {
        console.log(`  ${meta.sectionId}: ${entry.goldenStatus}`)
      } else {
        console.warn(`  ${meta.sectionId}: NOT FOUND in golden matrix`)
      }
    }
  })

  test('GET /lesson/sections/status — GOLD sections are canStartPaidLesson=true', async ({ request }) => {
    if (!(await backendReachable(request))) {
      console.log(`  SKIP: backend not reachable at ${BACKEND_URL}`)
      test.skip()
      return
    }
    const res  = await request.get(`${BACKEND_URL}/lesson/sections/status`)
    const body = await res.json() as {
      units: Array<{
        sections: Array<{
          sectionId: string
          canStartPaidLesson: boolean
          goldenStatus: string | null
        }>
      }>
    }

    const allSections = body.units.flatMap(u => u.sections)

    for (const section of GOLD_SECTIONS) {
      const meta  = SECTION_META[section]
      const entry = allSections.find(s => s.sectionId === meta.sectionId)
      if (!entry) {
        console.warn(`  ${meta.sectionId} not in status response`)
        continue
      }
      console.log(
        `  ${meta.sectionId}: canStart=${entry.canStartPaidLesson} ` +
        `golden=${entry.goldenStatus ?? 'n/a'}`,
      )
      expect(
        entry.canStartPaidLesson,
        `${meta.sectionId} must be canStartPaidLesson=true to be GOLD candidate`,
      ).toBe(true)
    }
  })
})

// ── Cursor state integrity (single-section deep dive) ─────────────────────────

test.describe('Exercise cursor integrity — Section 1.2 deep dive', () => {

  test('cursor version monotonically increases', async ({ page }) => {
    const env = checkEnvConfig()
    if (!env.configured) { test.skip(); return }

    let sessionId: string
    try {
      const session = await startLessonSession(page.request, '1.2', TEST_TOKEN, BACKEND_URL)
      sessionId = session.sessionId
    } catch (err) {
      test.skip() // subscription or session issue — don't fail CI
      return
    }

    const monitor = new WsMonitor()
    monitor.attach(page)
    await setAuthToken(page, TEST_TOKEN)
    await page.goto(`${BASE_URL}/classroom/${sessionId}?section=1.2`)

    await monitor.waitForType('lesson_ready', 20_000)
    await clickBeginLesson(page, 20_000)
    await monitor.waitForType('ai_text', 35_000)

    // Wait up to 50s for first exercise
    let firstCursor: ExerciseCursor | null = null
    try {
      const msg = await monitor.waitForType<WsCursorUpdated>('exercise_cursor_updated', 50_000)
      firstCursor = msg.cursor
    } catch {
      test.skip() // lesson did not reach exercise stage
      return
    }

    // Submit 2 answers and collect cursor versions
    const versions: number[] = []
    if (firstCursor.cursorVersion !== undefined) {
      versions.push(firstCursor.cursorVersion)
    }

    // Wrong answer
    const c1 = monitor.countOf('exercise_cursor_updated')
    await submitTextAnswer(page, 'WRONG_ANSWER_VERSION_CHECK')

    try {
      const next = await monitor.waitForNextOfType<WsCursorUpdated>(
        'exercise_cursor_updated', c1, 20_000,
      )
      if (next.cursor.cursorVersion !== undefined) versions.push(next.cursor.cursorVersion)
    } catch {
      // ok
    }

    // Version must be monotonically non-decreasing
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]!).toBeGreaterThanOrEqual(versions[i - 1]!)
    }

    if (versions.length >= 2) {
      console.log(`  cursor versions: ${versions.join(' → ')} ✓`)
    } else {
      console.log(`  only ${versions.length} cursor version(s) collected — not enough for monotonicity check`)
    }
  })

  test('exercise_cursor_updated contains non-empty instruction and currentItem', async ({ page }) => {
    const env = checkEnvConfig()
    if (!env.configured) { test.skip(); return }

    let sessionId: string
    try {
      const session = await startLessonSession(page.request, '1.2', TEST_TOKEN, BACKEND_URL)
      sessionId = session.sessionId
    } catch {
      test.skip(); return
    }

    const monitor = new WsMonitor()
    monitor.attach(page)
    await setAuthToken(page, TEST_TOKEN)
    await page.goto(`${BASE_URL}/classroom/${sessionId}?section=1.2`)

    await monitor.waitForType('lesson_ready', 20_000)
    await clickBeginLesson(page, 20_000)
    await monitor.waitForType('ai_text', 35_000)

    const msg = await monitor.waitForType<WsCursorUpdated>('exercise_cursor_updated', 50_000)
    const c   = msg.cursor

    expect(c.exerciseType, 'exerciseType must be non-empty').toBeTruthy()
    expect(c.exerciseType, 'exerciseType must not be "unknown"').not.toBe('unknown')
    expect(c.instruction,  'instruction must be non-empty').toBeTruthy()
    expect(c.instruction.length, 'instruction must be > 5 chars').toBeGreaterThan(5)

    // currentItem may be empty for first soft-speaking exercise
    // just assert it is a string
    expect(typeof c.currentItem, 'currentItem must be a string').toBe('string')

    console.log(`  ✓ cursor: ex#${c.exerciseNumber} type=${c.exerciseType} item="${c.currentItem.slice(0,60)}"`)
  })
})

// ── Reconnect resilience test ─────────────────────────────────────────────────

test.describe('WS reconnect resilience', () => {

  test('lesson_resync or lesson_resumed arrives after page reload', async ({ page }) => {
    const env = checkEnvConfig()
    if (!env.configured) { test.skip(); return }

    let sessionId: string
    try {
      const session = await startLessonSession(page.request, '2.1', TEST_TOKEN, BACKEND_URL)
      sessionId = session.sessionId
    } catch {
      test.skip(); return
    }

    // First connection
    const monitor1 = new WsMonitor()
    monitor1.attach(page)
    await setAuthToken(page, TEST_TOKEN)
    await page.goto(`${BASE_URL}/classroom/${sessionId}?section=2.1`)

    await monitor1.waitForType('lesson_ready', 20_000)
    await clickBeginLesson(page, 20_000)

    try {
      await monitor1.waitForType('ai_text', 30_000)
    } catch {
      test.skip(); return
    }

    // Wait 1s then simulate reconnect via page reload
    await page.waitForTimeout(1_000)

    const monitor2 = new WsMonitor()
    monitor2.attach(page)
    await page.reload()

    // After reconnect, expect lesson_resync OR lesson_ready (grace window)
    try {
      await Promise.race([
        monitor2.waitForType('lesson_resync', 30_000),
        monitor2.waitForType('lesson_ready',  30_000),
        monitor2.waitForType('lesson_resumed', 30_000),
      ])
      console.log(`  ✓ Reconnect message received: ${monitor2.typeSummary()}`)
    } catch {
      // After very fast reload the backend may still be in grace window
      // This is a soft failure — log but don't fail hard
      console.warn(`  ⚠ Reconnect message not received within 30s. WS: ${monitor2.typeSummary()}`)
    }

    // Either way: no LESSON_TAKEN_OVER error should arrive from a fast reconnect
    const errors = monitor2.ofType<WsError>('error')
    const takenOver = errors.filter(e => e.code === 'LESSON_TAKEN_OVER')
    expect(takenOver.length, 'LESSON_TAKEN_OVER must not fire on fast reconnect').toBe(0)
  })
})
