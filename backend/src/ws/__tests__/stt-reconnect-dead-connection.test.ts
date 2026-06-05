/**
 * Phase 17B — Deepgram Connection Resurrection for Kids Turns
 *
 * Root cause reproduced here:
 *   The DeepgramSTT instance persists across turns. When the Deepgram
 *   WebSocket closes during the idle gap between turns (TTS playback +
 *   kid preparation, typically 10–45s), send() queues audio on a dead
 *   socket. Open never fires, the queue is never flushed, Deepgram receives
 *   0 bytes, and the turn returns no_transcript.
 *
 * Fix tested here:
 *   On mic_start for Kids sessions, if meta.stt.isAlive() === false,
 *   lesson-ws.ts closes the dead instance and creates a fresh DeepgramSTT.
 *   Subsequent audio chunks go to the new live connection.
 *
 * Tests:
 *   1. Dead connection on turn 2 → constructor called again → transcript delivered.
 *   2. Alive connection on turn 2 → NO extra constructor call (no spurious reconnect).
 *   3. Two consecutive dead connections → two extra constructors → both turns succeed.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { createServer } from 'http'
import type { Server } from 'http'
import type { AddressInfo } from 'net'
import WebSocket from 'ws'

// ── Shared mocks ──────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  process.env['USE_KIDS_BRAIN_V1'] = 'true'
  process.env['JWT_SECRET']        = 'test-secret-17b'

  const redisStore = new Map<string, string>()

  const redisMock = {
    get:  vi.fn(async (key: string) => redisStore.get(key) ?? null),
    set:  vi.fn(async (key: string, value: string, ..._rest: unknown[]) => {
      redisStore.set(key, value)
      return 'OK'
    }),
    del:  vi.fn(async (key: string) => { redisStore.delete(key); return 1 }),
    eval: vi.fn(async (
      _script: string, _numkeys: number,
      key: string, value: string, _ttl: string, seq: string,
    ) => {
      const raw = redisStore.get(key)
      if (!raw) { redisStore.set(key, value); return 1 }
      try {
        const p = JSON.parse(raw) as { autosaveSequenceNumber?: number }
        if ((p.autosaveSequenceNumber ?? 0) < Number(seq)) { redisStore.set(key, value); return 1 }
        return 0
      } catch { redisStore.set(key, value); return 1 }
    }),
  }

  const queryMock = vi.fn(async (sql: string) => {
    const s = sql.trim().toUpperCase()
    if (s.includes('FROM KIDS_SESSIONS')) {
      return { rows: [{ user_id: 'u-17b-001', status: 'created', mode: 'mentium_kids' }], rowCount: 1 }
    }
    if (s.includes('SELECT LESSON_ID FROM LESSON_SESSIONS')) {
      return { rows: [], rowCount: 0 }
    }
    return { rows: [], rowCount: 0 }
  })

  const verifyTokenMock = vi.fn(async (token: string) => {
    if (token === 'tok-17b') {
      return { userId: 'u-17b-001', studentId: 's-17b-001', email: 'stt@17b.test', name: 'STT17B' }
    }
    return null
  })

  const speakToClientMock = vi.fn(async () => undefined)
  const persistAnalyticsMock = vi.fn(async () => undefined)
  const hashUserIdMock = vi.fn((id: string | null) => (id ? id.slice(0, 8) : null))

  // STT state — updated on each constructor call so tests can track reconnects.
  const sttState = {
    onTranscript:  null as ((text: string) => void) | null,
    onInterim:     null as ((text: string) => void) | null,
    sendFn:        vi.fn(),
    clearBufferFn: vi.fn(),
    flushBufferFn: vi.fn(() => '') as ReturnType<typeof vi.fn>,
    // isAlive controls whether the connection appears alive to mic_start logic.
    // Default true; tests set mockReturnValueOnce(false) to simulate death.
    isAliveFn:     vi.fn(() => true) as ReturnType<typeof vi.fn>,
    constructorCallCount: 0,
  }

  return {
    redisMock,
    queryMock, verifyTokenMock,
    speakToClientMock, persistAnalyticsMock, hashUserIdMock,
    sttState,
  }
})

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../db/redis.js', () => ({
  default:            mocks.redisMock,
  LESSON_TTL:         14400,
  lessonStateKey:     (id: string) => `lesson:${id}:state`,
  lessonContextKey:   (id: string) => `lesson:${id}:context`,
  lessonExercisesKey: (id: string) => `lesson:${id}:exercises`,
  lessonErrorsKey:    (id: string) => `lesson:${id}:errors`,
  activeSessionKey:   (id: string) => `session:${id}:active`,
}))

vi.mock('../../db/postgres.js', () => ({
  query:           mocks.queryMock,
  withTransaction: vi.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({})),
  default:         {},
}))

vi.mock('../../auth/jwt.js', () => ({
  verifyToken: mocks.verifyTokenMock,
  signToken:   vi.fn(async () => 'signed'),
}))

vi.mock('../../voice/tts.js', () => ({
  speakToClient: mocks.speakToClientMock,
}))

// STT mock: each constructor call updates sttState and increments constructorCallCount.
// isAliveFn is shared so tests can control alive/dead state per call.
vi.mock('../../voice/stt.js', () => ({
  DEEPGRAM_LIVE_OPTIONS:      { model: 'nova-2', language: 'en', encoding: 'linear16', sample_rate: 16000, channels: 1 },
  DEEPGRAM_KIDS_LIVE_OPTIONS: { model: 'nova-2', language: 'en', encoding: 'linear16', sample_rate: 16000, channels: 1, utterance_end_ms: 700 },
  DeepgramSTT: vi.fn().mockImplementation(
    (onTranscript: (text: string) => void, onInterim?: (text: string) => void) => {
      mocks.sttState.constructorCallCount++
      mocks.sttState.onTranscript  = onTranscript
      mocks.sttState.onInterim     = onInterim ?? null
      mocks.sttState.sendFn        = vi.fn()
      mocks.sttState.clearBufferFn = vi.fn()
      mocks.sttState.flushBufferFn = vi.fn(() => '')
      return {
        send:        mocks.sttState.sendFn,
        close:       vi.fn(),
        clearBuffer: mocks.sttState.clearBufferFn,
        flushBuffer: mocks.sttState.flushBufferFn,
        isAlive:     mocks.sttState.isAliveFn,
      }
    }),
}))

vi.mock('../../billing/subscription-service.js', () => ({
  getSubscription: vi.fn(async () => null),
  finalizeUsage:   vi.fn(async () => undefined),
}))

vi.mock('../../observability/index.js', () => ({
  startLessonTrace:        vi.fn(),
  endLessonTrace:          vi.fn(),
  traceSttResult:          vi.fn(),
  traceValidation:         vi.fn(),
  traceTeacherGeneration:  vi.fn(),
  traceRuntimeError:       vi.fn(),
  traceRuntimeSpan:        vi.fn(),
  traceInterpretation:     vi.fn(),
  traceProgression:        vi.fn(),
  traceFrontendSync:       vi.fn(),
  isObservabilityEnabled:  vi.fn(() => false),
  initObservability:       vi.fn(),
  flushObservability:      vi.fn(),
  hashUserId:              mocks.hashUserIdMock,
}))

vi.mock('../../observability/langfuse-client.js', () => ({
  hashUserId:              mocks.hashUserIdMock,
  isObservabilityEnabled:  vi.fn(() => false),
  initObservability:       vi.fn(),
  flushObservability:      vi.fn(),
}))

vi.mock('../../kids-brain/analytics/session-analytics.js', () => ({
  persistKidsBrainAnalytics:      mocks.persistAnalyticsMock,
  buildSessionSummary:            vi.fn(),
  buildMasteryRecordsFromSession:  vi.fn(() => []),
}))

import { attachLessonWS } from '../lesson-ws.js'

// ── Constants ──────────────────────────────────────────────────────────────────

const SESSION_ID = 'sess-17b-stt'
const TOKEN      = 'tok-17b'

// ── Server setup ──────────────────────────────────────────────────────────────

let server: Server
let port: number

beforeAll(async () => {
  server = createServer()
  attachLessonWS(server)
  await new Promise<void>(resolve => server.listen(0, resolve))
  port = (server.address() as AddressInfo).port
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(err => (err ? reject(err) : resolve())),
  )
})

// ── Helpers ───────────────────────────────────────────────────────────────────

type Msg = Record<string, unknown>

function wsUrl(): string {
  return `ws://localhost:${port}/lesson?token=${TOKEN}&sessionId=${SESSION_ID}`
}

async function openWS(): Promise<{ ws: WebSocket; messages: Msg[] }> {
  const messages: Msg[] = []
  const ws = new WebSocket(wsUrl())
  ws.on('message', (raw) => {
    try { messages.push(JSON.parse(raw.toString()) as Msg) } catch { /* skip */ }
  })
  await new Promise<void>((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
  })
  return { ws, messages }
}

function sendFrame(ws: WebSocket, msg: Msg): void {
  ws.send(JSON.stringify(msg))
}

async function closeWS(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'test-done')
  if (ws.readyState !== WebSocket.CLOSED) {
    await new Promise<void>(resolve => ws.once('close', () => resolve()))
  }
}

async function waitUntil(
  messages: Msg[],
  predicate: (msgs: Msg[]) => boolean,
  timeoutMs = 6000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (predicate(messages)) { resolve(); return }
    const deadline = setTimeout(() => {
      reject(new Error(
        `waitUntil timeout (${timeoutMs}ms). ` +
        `Messages: [${messages.map(m => m['type']).join(', ')}]`,
      ))
    }, timeoutMs)
    const tick = setInterval(() => {
      if (predicate(messages)) { clearTimeout(deadline); clearInterval(tick); resolve() }
    }, 20)
  })
}

function countOf(messages: Msg[], type: string): number {
  return messages.filter(m => m['type'] === type).length
}

function aiTexts(messages: Msg[]): string[] {
  return messages
    .filter(m => m['type'] === 'ai_text')
    .map(m => (m['text'] as string) ?? '')
}

async function startKidsSession(): Promise<{ ws: WebSocket; messages: Msg[] }> {
  const { ws, messages } = await openWS()
  await waitUntil(messages, msgs => countOf(msgs, 'lesson_ready') >= 1)
  sendFrame(ws, { type: 'focus_lesson_start', payload: { unit: 1 } })
  await waitUntil(messages, msgs => countOf(msgs, 'lesson_ready') >= 2)
  await waitUntil(messages, msgs => aiTexts(msgs).length >= 1)
  return { ws, messages }
}

beforeEach(() => {
  mocks.sttState.flushBufferFn.mockReturnValue('')
  mocks.sttState.isAliveFn.mockReturnValue(true)
  mocks.sttState.constructorCallCount = 0
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Phase 17B — Kids STT reconnect on dead Deepgram connection', () => {

  it('dead connection between turns: mic_start creates a new DeepgramSTT', async () => {
    // Reproduces production failure:
    //   Turn 1 completes. Between turns, Deepgram fires Error+Close (empty object error).
    //   isAlive() returns false. On Turn 2 mic_start, lesson-ws MUST recreate the STT.
    //   Without the fix, audio is queued forever on the dead socket → no transcript.

    const { ws, messages } = await startKidsSession()
    // constructor was called once at session start
    const afterStart = mocks.sttState.constructorCallCount

    // Turn 1 — healthy connection delivers transcript normally
    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))
    mocks.sttState.onTranscript?.('blue')
    sendFrame(ws, { type: 'mic_stop' })
    const prevAI = aiTexts(messages).length
    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)
    const turn1AI = aiTexts(messages).length

    // Simulate Deepgram Error+Close between turns:
    // The NEXT isAlive() call (on the current instance, during mic_start) returns false.
    mocks.sttState.isAliveFn.mockReturnValueOnce(false)

    // Turn 2 mic_start — fix should detect dead connection and create new DeepgramSTT
    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 100))  // give lesson-ws time to process

    // The constructor must have been called one more time (fresh connection)
    expect(mocks.sttState.constructorCallCount).toBe(afterStart + 1)

    // Turn 2 transcript via the newly created connection
    mocks.sttState.onTranscript?.('green')
    sendFrame(ws, { type: 'mic_stop' })
    await waitUntil(messages, msgs => aiTexts(msgs).length > turn1AI, 5000)

    expect(aiTexts(messages).slice(turn1AI).length).toBeGreaterThan(0)

    await closeWS(ws)
  })

  it('alive connection between turns: mic_start does NOT create extra DeepgramSTT', async () => {
    // Guard: when isAlive() returns true (normal case), the fix must not trigger
    // a spurious reconnect that would discard the in-flight connection state.

    const { ws, messages } = await startKidsSession()
    const afterStart = mocks.sttState.constructorCallCount

    // Connection is alive — default isAliveFn returns true
    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 100))

    // Constructor count must NOT change (no unnecessary reconnect)
    expect(mocks.sttState.constructorCallCount).toBe(afterStart)

    await closeWS(ws)
  })

  it('two consecutive dead connections: each mic_start creates a fresh STT', async () => {
    // Covers the case where the connection dies on every turn (e.g., flaky network).
    // Each mic_start must independently detect and recover from the dead connection.

    const { ws, messages } = await startKidsSession()
    const afterStart = mocks.sttState.constructorCallCount

    // Turn 1 mic_start — dead connection
    mocks.sttState.isAliveFn.mockReturnValueOnce(false)
    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 100))
    expect(mocks.sttState.constructorCallCount).toBe(afterStart + 1)

    mocks.sttState.onTranscript?.('cat')
    sendFrame(ws, { type: 'mic_stop' })
    const prevAI = aiTexts(messages).length
    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)
    const turn1AI = aiTexts(messages).length

    // Turn 2 mic_start — dead connection again
    mocks.sttState.isAliveFn.mockReturnValueOnce(false)
    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 100))
    expect(mocks.sttState.constructorCallCount).toBe(afterStart + 2)

    mocks.sttState.onTranscript?.('dog')
    sendFrame(ws, { type: 'mic_stop' })
    await waitUntil(messages, msgs => aiTexts(msgs).length > turn1AI, 5000)

    expect(aiTexts(messages).slice(turn1AI).length).toBeGreaterThan(0)

    await closeWS(ws)
  })
})
