/**
 * Golden Runtime QA Helpers
 *
 * Utilities for educational runtime certification tests.
 * Covers: auth injection, lesson API, WebSocket monitoring, answer submission.
 */

import type { Page, APIRequestContext } from '@playwright/test'

// ── Environment ───────────────────────────────────────────────────────────────

export const BASE_URL    = process.env.PLAYWRIGHT_BASE_URL    ?? 'http://localhost:5173'
export const BACKEND_URL = process.env.PLAYWRIGHT_BACKEND_URL ?? 'http://localhost:4000'
export const TEST_TOKEN  = process.env.PLAYWRIGHT_TEST_TOKEN  ?? ''

// ── Section config ────────────────────────────────────────────────────────────

export const GOLD_SECTIONS = ['1.1', '1.2', '1.4', '2.1', '2.2', '2.3'] as const
export type GoldSection = typeof GOLD_SECTIONS[number]

export interface SectionMeta {
  unit:      number
  sectionId: string
  title:     string
  type:      'vocabulary' | 'grammar' | 'reading'
  hasExplicitManifest: boolean
}

export const SECTION_META: Record<GoldSection, SectionMeta> = {
  '1.1': { unit: 1, sectionId: 'focus2-1.1', title: 'Vocabulary: Free-time activities',       type: 'vocabulary', hasExplicitManifest: false },
  '1.2': { unit: 1, sectionId: 'focus2-1.2', title: 'Grammar: Present tenses question forms', type: 'grammar',    hasExplicitManifest: true  },
  '1.4': { unit: 1, sectionId: 'focus2-1.4', title: 'Reading: Teenage stereotypes',           type: 'reading',    hasExplicitManifest: false },
  '2.1': { unit: 2, sectionId: 'focus2-2.1', title: 'Vocabulary: Achievements',               type: 'vocabulary', hasExplicitManifest: false },
  '2.2': { unit: 2, sectionId: 'focus2-2.2', title: 'Grammar: Past Simple',                   type: 'grammar',    hasExplicitManifest: false },
  '2.3': { unit: 2, sectionId: 'focus2-2.3', title: 'Reading: Marie Curie biography',         type: 'reading',    hasExplicitManifest: false },
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Injects the auth token before page navigation via addInitScript.
 * Must be called before page.goto() on any route that reads localStorage.
 */
export async function setAuthToken(page: Page, token: string): Promise<void> {
  await page.addInitScript((t: string) => {
    window.localStorage.setItem('auth_token', t)
  }, token)
}

// ── Lesson API ────────────────────────────────────────────────────────────────

export interface LessonStartResponse {
  sessionId:        string
  remainingMinutes: number
}

/**
 * Creates a paid lesson session via the REST API.
 * Returns sessionId for the classroom URL.
 * Requires a valid token for a user with an active subscription.
 */
export async function startLessonSession(
  request:       APIRequestContext,
  sectionNumber: GoldSection,
  token:         string,
  backendUrl:    string = BACKEND_URL,
): Promise<LessonStartResponse> {
  const meta = SECTION_META[sectionNumber]

  const res = await request.post(`${backendUrl}/lesson/start`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      mode:          'textbook',
      bookId:        'focus2',
      sectionId:     meta.sectionId,
      sectionNumber,
      sectionTitle:  meta.title,
      sectionTopic:  'Certification test',
      teacherId:     'alex',
      voiceId:       'onyx',
    },
  })

  if (!res.ok()) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(
      `startLessonSession failed: HTTP ${res.status()} code=${body['code'] ?? 'unknown'} ` +
      `message="${body['message'] ?? 'no message'}"`,
    )
  }

  return (await res.json()) as LessonStartResponse
}

// ── WebSocket Monitor ─────────────────────────────────────────────────────────

export interface ExerciseCursor {
  exerciseNumber:    number
  exerciseType:      string
  instruction:       string
  currentItem:       string
  itemIndex:         number
  itemTotal:         number
  completedItems:    number[]
  failedItems:       number[]
  exerciseId?:       string | null
  completionState?:  'active' | 'complete' | 'skipped'
  validationResult?: { correct: boolean; explanation: string } | null
  cursorVersion?:    number
  expectedInputMode?: string
  options?:          string[]
  items?:            string[]
}

export interface WsLessonReady     { type: 'lesson_ready';            sessionId: string | null }
export interface WsCursorUpdated   { type: 'exercise_cursor_updated'; cursor: ExerciseCursor }
export interface WsFeedback        { type: 'feedback';                correct: boolean; explanation: string }
export interface WsAiText          { type: 'ai_text';                 text: string; phase: string }
export interface WsTeacherTurnEnd  { type: 'teacher_turn_end' }
export interface WsPhaseChange     { type: 'phase_change';            from: string; to: string }
export interface WsError           { type: 'error';                   code: string; message: string }
export interface WsLessonEnd       { type: 'lesson_end';              summary: Record<string, unknown> }

export type AnyWsMessage =
  | WsLessonReady | WsCursorUpdated | WsFeedback | WsAiText
  | WsTeacherTurnEnd | WsPhaseChange | WsError | WsLessonEnd
  | { type: string; [key: string]: unknown }

interface StoredFrame {
  type: string
  payload: AnyWsMessage
  ts:   number
}

type Listener = (msg: AnyWsMessage) => void

export class WsMonitor {
  private frames:    StoredFrame[] = []
  private listeners: Listener[]   = []
  private attached   = false

  /** Must be called BEFORE page.goto() to capture all frames from the start. */
  attach(page: Page): void {
    if (this.attached) return
    this.attached = true

    page.on('websocket', (ws) => {
      ws.on('framereceived', (frame) => {
        try {
          const msg = JSON.parse(frame.payload.toString()) as AnyWsMessage
          const entry: StoredFrame = { type: msg.type, payload: msg, ts: Date.now() }
          this.frames.push(entry)
          for (const fn of this.listeners) fn(msg)
        } catch {
          // ignore non-JSON frames (ping/pong)
        }
      })
    })
  }

  /** All received messages. */
  all(): AnyWsMessage[] {
    return this.frames.map(f => f.payload)
  }

  /** All messages of a given type. */
  ofType<T extends AnyWsMessage>(type: string): T[] {
    return this.frames.filter(f => f.type === type).map(f => f.payload as T)
  }

  /** True if at least one message of type was received. */
  hasReceived(type: string): boolean {
    return this.frames.some(f => f.type === type)
  }

  /** Count of messages of a given type. */
  countOf(type: string): number {
    return this.frames.filter(f => f.type === type).length
  }

  /** Wait until a message of the given type arrives (checks existing + new). */
  waitForType<T extends AnyWsMessage>(type: string, timeoutMs = 40_000): Promise<T> {
    return new Promise((resolve, reject) => {
      const existing = this.frames.find(f => f.type === type)
      if (existing) { resolve(existing.payload as T); return }

      const timer = setTimeout(() => {
        const seen = [...new Set(this.frames.map(f => f.type))].join(', ')
        reject(new Error(
          `WsMonitor timeout (${timeoutMs}ms) waiting for "${type}". ` +
          `Received types: [${seen || 'none'}]`,
        ))
      }, timeoutMs)

      const listener: Listener = (msg) => {
        if (msg.type === type) {
          clearTimeout(timer)
          this.listeners = this.listeners.filter(fn => fn !== listener)
          resolve(msg as T)
        }
      }
      this.listeners.push(listener)
    })
  }

  /**
   * Wait for the Nth occurrence of type (after `existingCount` already received).
   * Use to detect cursor advancement: wait for count > existingCount.
   */
  waitForNextOfType<T extends AnyWsMessage>(
    type:          string,
    existingCount: number,
    timeoutMs = 30_000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const current = this.frames.filter(f => f.type === type)
      if (current.length > existingCount) {
        resolve(current[current.length - 1]!.payload as T)
        return
      }

      const timer = setTimeout(() => {
        const total = this.frames.filter(f => f.type === type).length
        reject(new Error(
          `WsMonitor timeout (${timeoutMs}ms) waiting for next "${type}" ` +
          `(existing=${existingCount}, received=${total})`,
        ))
      }, timeoutMs)

      const listener: Listener = (msg) => {
        if (msg.type === type) {
          const total = this.frames.filter(f => f.type === type).length
          if (total > existingCount) {
            clearTimeout(timer)
            this.listeners = this.listeners.filter(fn => fn !== listener)
            resolve(msg as T)
          }
        }
      }
      this.listeners.push(listener)
    })
  }

  /**
   * Wait for a cursor update where itemIndex or exerciseNumber changed vs reference.
   */
  waitForCursorAdvance(
    reference:    ExerciseCursor,
    timeoutMs = 30_000,
  ): Promise<WsCursorUpdated> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(
          `WsMonitor timeout (${timeoutMs}ms) waiting for cursor advance ` +
          `(was exerciseNum=${reference.exerciseNumber} item=${reference.itemIndex})`,
        ))
      }, timeoutMs)

      const check = (msg: AnyWsMessage) => {
        if (msg.type !== 'exercise_cursor_updated') return
        const c = (msg as WsCursorUpdated).cursor
        const advanced =
          c.itemIndex      > reference.itemIndex      ||
          c.exerciseNumber > reference.exerciseNumber
        if (advanced) {
          clearTimeout(timer)
          this.listeners = this.listeners.filter(fn => fn !== listener)
          resolve(msg as WsCursorUpdated)
        }
      }

      // Check existing
      for (const f of this.frames) {
        check(f.payload)
      }

      const listener: Listener = check
      this.listeners.push(listener)
    })
  }

  /** Clear all captured messages (use between test phases). */
  reset(): void {
    this.frames    = []
    this.listeners = []
  }

  /** Human-readable dump for debugging. */
  dump(maxLines = 30): string {
    return this.frames
      .slice(-maxLines)
      .map(f => {
        const ts  = new Date(f.ts).toISOString().slice(11, 23)
        const pay = JSON.stringify(f.payload).slice(0, 150)
        return `  [${ts}] ${f.type}: ${pay}`
      })
      .join('\n')
  }

  /** Type summary for assertions in test output. */
  typeSummary(): string {
    const counts: Record<string, number> = {}
    for (const f of this.frames) counts[f.type] = (counts[f.type] ?? 0) + 1
    return Object.entries(counts).map(([k, v]) => `${k}×${v}`).join(', ')
  }
}

// ── UI interaction ────────────────────────────────────────────────────────────

/** Selector for the student text input (from BottomControls.tsx). */
export const ANSWER_INPUT_SELECTOR = 'input[placeholder="Type your answer…"]'

/** Locator for the Begin Lesson button (from ClassroomLayout.tsx). */
export const BEGIN_LESSON_SELECTOR = 'button:has-text("Begin Lesson")'

/**
 * Navigate to classroom with injected auth token.
 * Call setAuthToken first if page.goto hasn't been called yet,
 * or use this combined helper.
 */
export async function loadClassroom(
  page:      Page,
  sessionId: string,
  token:     string,
): Promise<void> {
  await setAuthToken(page, token)
  await page.goto(`${BASE_URL}/classroom/${sessionId}`)
}

/**
 * Submit a text answer via the bottom input bar.
 * Waits for the input to be visible and not disabled.
 */
export async function submitTextAnswer(page: Page, answer: string): Promise<void> {
  const input = page.locator(ANSWER_INPUT_SELECTOR)
  await input.waitFor({ state: 'visible', timeout: 20_000 })
  // Wait until input is editable (not readOnly/disabled)
  await input.waitFor({ state: 'attached', timeout: 5_000 })
  await input.fill(answer)
  await input.press('Enter')
}

/**
 * Click the "Begin Lesson" button.
 * Waits up to timeoutMs for the button to be visible.
 */
export async function clickBeginLesson(page: Page, timeoutMs = 30_000): Promise<void> {
  const btn = page.locator(BEGIN_LESSON_SELECTOR).first()
  await btn.waitFor({ state: 'visible', timeout: timeoutMs })
  await btn.click()
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

/**
 * Assert that a cursor update keeps the student on the same item.
 * Used after wrong-answer submission.
 */
export function assertCursorStaysOnItem(
  before: ExerciseCursor,
  after:  ExerciseCursor,
): void {
  if (after.exerciseNumber !== before.exerciseNumber) {
    throw new Error(
      `[PROGRESSION VIOLATION] exerciseNumber changed: ` +
      `${before.exerciseNumber} → ${after.exerciseNumber} after wrong answer`,
    )
  }
  if (after.itemIndex > before.itemIndex) {
    throw new Error(
      `[PROGRESSION VIOLATION] itemIndex advanced: ` +
      `${before.itemIndex} → ${after.itemIndex} after wrong answer`,
    )
  }
}

/**
 * Assert no forbidden WS messages arrived that indicate a runtime violation.
 */
export function assertNoRuntimeViolations(monitor: WsMonitor): {
  passed: boolean
  violations: string[]
} {
  const violations: string[] = []
  const errors = monitor.ofType<WsError>('error')
  for (const e of errors) {
    if (['AUTH_ERROR', 'SESSION_EXPIRED', 'LESSON_TAKEN_OVER'].includes(e.code)) {
      violations.push(`Fatal error received: code=${e.code} message="${e.message}"`)
    }
  }
  return { passed: violations.length === 0, violations }
}

// ── Prerequisite guard ────────────────────────────────────────────────────────

/**
 * Checks that required env vars are present.
 * Call at the start of each test or in beforeAll.
 * Returns false if env is not configured (caller should test.skip).
 */
export function checkEnvConfig(): {
  configured: boolean
  missing: string[]
  reason?: string
} {
  const missing: string[] = []
  if (!TEST_TOKEN) missing.push('PLAYWRIGHT_TEST_TOKEN')

  if (missing.length > 0) {
    return {
      configured: false,
      missing,
      reason:
        `Missing env vars: ${missing.join(', ')}. ` +
        `See docs/runtime-qa/GOLDEN_RUNTIME_CERTIFICATION_REPORT.md for setup.`,
    }
  }
  return { configured: true, missing: [] }
}

// ── Test result collector ─────────────────────────────────────────────────────

export interface SectionCertResult {
  sectionNumber:    string
  title:            string
  result:           'GOLD_CERTIFIED' | 'SILVER' | 'BLOCKED' | 'SKIPPED' | 'ERROR'
  checks: {
    wsConnected:        boolean | null
    lessonReady:        boolean | null
    exerciseCardLoaded: boolean | null
    visiblePayload:     boolean | null
    wrongAnswerStays:   boolean | null
    correctAnswerOrSoft: boolean | null
    teacherLock:        boolean | null
    noUnsafeFallback:   boolean | null
  }
  violations:       string[]
  transcriptSample: string[]
  durationMs:       number
  error?:           string
}

export class CertificationLog {
  private results: SectionCertResult[] = []

  add(result: SectionCertResult): void {
    this.results.push(result)
  }

  summary(): string {
    const lines = ['# Golden Runtime Certification Summary', '']
    for (const r of this.results) {
      const icon =
        r.result === 'GOLD_CERTIFIED' ? '✅' :
        r.result === 'SILVER'         ? '🟡' :
        r.result === 'SKIPPED'        ? '⏭' :
        '❌'
      lines.push(`${icon} **${r.sectionNumber}** — ${r.result} (${r.durationMs}ms)`)
      if (r.violations.length) {
        for (const v of r.violations) lines.push(`   ⚠ ${v}`)
      }
    }
    return lines.join('\n')
  }

  getResults(): SectionCertResult[] {
    return [...this.results]
  }
}
