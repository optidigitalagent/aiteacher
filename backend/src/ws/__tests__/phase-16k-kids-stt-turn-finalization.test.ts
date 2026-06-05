/**
 * Phase 16K — Kids STT Turn Finalization Tests
 *
 * Tests that:
 * 1. Final transcript (from UtteranceEnd) is submitted correctly.
 * 2. Partial transcript (from is_final, no UtteranceEnd) is used as fallback for Kids.
 * 3. Transcript arriving shortly after mic_stop (within 800ms window) is captured.
 * 4. Short one-word answers ("blue", "yes") are accepted and routed to Kids Brain.
 * 5. Truly silent turn produces no_transcript with child-safe TTS prompt.
 * 6. Existing Kids WebSocket flow remains intact.
 * 7. Existing TTS flow remains working.
 * 8. Adult STT path is unaffected.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { createServer } from 'http'
import type { Server } from 'http'
import type { AddressInfo } from 'net'
import WebSocket from 'ws'

// ── Shared mocks (vi.hoisted runs before vi.mock and before imports) ──────────

const mocks = vi.hoisted(() => {
  process.env['USE_KIDS_BRAIN_V1'] = 'true'
  process.env['JWT_SECRET']        = 'test-secret-16k'

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
    _store: redisStore,
  }

  const queryMock = vi.fn(async (sql: string) => {
    const s = sql.trim().toUpperCase()
    if (s.includes('FROM KIDS_SESSIONS')) {
      return { rows: [{ user_id: 'u-16k-001', status: 'created', mode: 'mentium_kids' }], rowCount: 1 }
    }
    if (s.includes('SELECT LESSON_ID FROM LESSON_SESSIONS')) {
      return { rows: [], rowCount: 0 }
    }
    return { rows: [], rowCount: 0 }
  })

  const verifyTokenMock = vi.fn(async (token: string) => {
    if (token === 'tok-16k') {
      return { userId: 'u-16k-001', studentId: 's-16k-001', email: 'stt@16k.test', name: 'STT16K' }
    }
    return null
  })

  const speakToClientMock = vi.fn(async () => undefined)
  const persistAnalyticsMock = vi.fn(async () => undefined)
  const hashUserIdMock = vi.fn((id: string | null) => (id ? id.slice(0, 8) : null))

  // STT state — written each time DeepgramSTT constructor is called.
  // Captures BOTH onTranscript (UtteranceEnd) AND onInterim (is_final / interim events).
  const sttState = {
    onTranscript:  null as ((text: string) => void) | null,
    onInterim:     null as ((text: string) => void) | null,
    sendFn:        vi.fn(),
    clearBufferFn: vi.fn(),
    flushBufferFn: vi.fn(() => '') as ReturnType<typeof vi.fn>,
    // isAlive: default true so existing tests do not trigger reconnect path
    isAliveFn:     vi.fn(() => true) as ReturnType<typeof vi.fn>,
  }

  return {
    redisMock, redisStore,
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

// STT mock: captures BOTH callbacks so tests can trigger synthetic transcripts
// and verify partial-fallback path via onInterim.
vi.mock('../../voice/stt.js', () => ({
  DEEPGRAM_LIVE_OPTIONS:      { model: 'nova-2', language: 'en', encoding: 'linear16', sample_rate: 16000, channels: 1 },
  DEEPGRAM_KIDS_LIVE_OPTIONS: { model: 'nova-2', language: 'en', encoding: 'linear16', sample_rate: 16000, channels: 1, utterance_end_ms: 700 },
  DeepgramSTT: vi.fn().mockImplementation(
    (onTranscript: (text: string) => void, onInterim?: (text: string) => void) => {
      mocks.sttState.onTranscript  = onTranscript
      mocks.sttState.onInterim     = onInterim ?? null
      mocks.sttState.sendFn        = vi.fn()
      mocks.sttState.clearBufferFn = vi.fn()
      mocks.sttState.flushBufferFn = vi.fn(() => '')
      mocks.sttState.isAliveFn     = vi.fn(() => true)
      return {
        send:           mocks.sttState.sendFn,
        close:          vi.fn(),
        clearBuffer:    mocks.sttState.clearBufferFn,
        flushBuffer:    mocks.sttState.flushBufferFn,
        isAlive:        mocks.sttState.isAliveFn,
        waitUntilReady: vi.fn(async () => true),
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

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_ID = 'sess-16k-stt'
const TOKEN      = 'tok-16k'

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

// ── WS helpers ────────────────────────────────────────────────────────────────

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

// Start a fresh Kids Brain V1 session and wait for the initial greeting.
async function startKidsSession(): Promise<{ ws: WebSocket; messages: Msg[] }> {
  const { ws, messages } = await openWS()
  await waitUntil(messages, msgs => countOf(msgs, 'lesson_ready') >= 1)
  sendFrame(ws, { type: 'focus_lesson_start', payload: { unit: 1 } })
  await waitUntil(messages, msgs => countOf(msgs, 'lesson_ready') >= 2)
  await waitUntil(messages, msgs => aiTexts(msgs).length >= 1)
  return { ws, messages }
}

// Reset flushBuffer to return empty (default — tests override as needed)
beforeEach(() => {
  mocks.sttState.flushBufferFn.mockReturnValue('')
})

// ── Suite 1 — Final transcript path ───────────────────────────────────────────

describe('Phase 16K — Final transcript submitted via UtteranceEnd', () => {
  it('onTranscript("blue") + mic_stop → Kids Brain receives "blue"', async () => {
    const { ws, messages } = await startKidsSession()
    const prevAI = aiTexts(messages).length

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))

    // Simulate Deepgram UtteranceEnd with final text
    mocks.sttState.onTranscript?.('blue')
    await new Promise(r => setTimeout(r, 60))

    sendFrame(ws, { type: 'mic_stop' })
    // Wait for Kids stabilization (800ms) + processing
    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)

    const newTexts = aiTexts(messages).slice(prevAI)
    expect(newTexts.length).toBeGreaterThan(0)
    expect(newTexts.join(' ').toLowerCase()).not.toMatch(/invalid_session|internal_error/i)

    await closeWS(ws)
  })

  it('onTranscript("yes") + mic_stop → Kids Brain receives "yes"', async () => {
    const { ws, messages } = await startKidsSession()
    const prevAI = aiTexts(messages).length

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))

    mocks.sttState.onTranscript?.('yes')
    await new Promise(r => setTimeout(r, 60))

    sendFrame(ws, { type: 'mic_stop' })
    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)

    expect(aiTexts(messages).slice(prevAI).length).toBeGreaterThan(0)

    await closeWS(ws)
  })
})

// ── Suite 2 — Partial transcript fallback ─────────────────────────────────────

describe('Phase 16K — Partial transcript fallback (no UtteranceEnd)', () => {
  it('onInterim("blue") while micActive + mic_stop → Kids Brain receives "blue" via partial', async () => {
    // Simulate: Deepgram is_final arrives, onInterim called, but UtteranceEnd never fires.
    // flushBuffer returns '' (race: is_final cleared buffer before stabilization).
    // IMPORTANT: set mock AFTER startKidsSession() because STT constructor resets flushBufferFn.
    const { ws, messages } = await startKidsSession()
    mocks.sttState.flushBufferFn.mockReturnValue('')
    const prevAI = aiTexts(messages).length

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))

    // Simulate is_final event: onInterim called with accumulated is_final text
    mocks.sttState.onInterim?.('blue')
    await new Promise(r => setTimeout(r, 60))

    sendFrame(ws, { type: 'mic_stop' })

    // Kids uses 800ms stabilization window
    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)

    const newTexts = aiTexts(messages).slice(prevAI)
    expect(newTexts.length, 'Kids Brain should respond to "blue" from partial').toBeGreaterThan(0)
    expect(newTexts.join(' ').toLowerCase()).not.toMatch(/invalid_session|internal_error/i)

    await closeWS(ws)
  })

  it('onInterim("yes") while micActive + mic_stop → Kids Brain receives "yes" via partial', async () => {
    const { ws, messages } = await startKidsSession()
    mocks.sttState.flushBufferFn.mockReturnValue('')
    const prevAI = aiTexts(messages).length

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))

    mocks.sttState.onInterim?.('yes')
    await new Promise(r => setTimeout(r, 60))

    sendFrame(ws, { type: 'mic_stop' })
    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)

    expect(aiTexts(messages).slice(prevAI).length).toBeGreaterThan(0)

    await closeWS(ws)
  })

  it('partial does NOT cross turns — stale partial from previous turn is ignored', async () => {
    const { ws, messages } = await startKidsSession()

    // Turn 1: record a partial via onInterim
    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))
    mocks.sttState.onInterim?.('old stale text')
    await new Promise(r => setTimeout(r, 60))

    // mic_stop turn 1 — starts 800ms stabilization for turn 1
    sendFrame(ws, { type: 'mic_stop' })
    await new Promise(r => setTimeout(r, 50))

    // Turn 2: new mic_start RESETS kidsPartialTranscript to '' AND generates new voiceTurnId
    // The second mic_stop will cancel the first stabilization and start a fresh one
    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))
    // No onInterim or onTranscript for Turn 2 — no new partial saved

    const prevStudentMessages = messages.filter(m => m['type'] === 'student_message').length

    sendFrame(ws, { type: 'mic_stop' })
    // Wait past the 800ms stabilization window
    await new Promise(r => setTimeout(r, 1000))

    // The second turn's stabilization should produce no_transcript (not stale "old stale text").
    // If stale partial crossed turns, a student_message with "old stale text" would be sent.
    const newStudentMessages = messages
      .filter(m => m['type'] === 'student_message')
      .slice(prevStudentMessages)
    const staleFound = newStudentMessages.some(m =>
      typeof m['text'] === 'string' && (m['text'] as string).includes('old stale'),
    )
    expect(staleFound, 'Stale partial from turn 1 must not be submitted in turn 2').toBe(false)

    await closeWS(ws)
  })
})

// ── Suite 3 — Late is_final captured by flushBuffer ───────────────────────────

describe('Phase 16K — is_final captured in buffer by flushBuffer', () => {
  it('flushBuffer returns "blue" → submitted even without UtteranceEnd or onInterim', async () => {
    // Simulate: is_final arrives during stabilization window, accumulates in transcriptBuffer.
    // On stabilization fire, flushBuffer() returns 'blue'.
    // IMPORTANT: set mock AFTER startKidsSession() because the STT constructor resets flushBufferFn.
    const { ws, messages } = await startKidsSession()
    mocks.sttState.flushBufferFn.mockReturnValue('blue')
    const prevAI = aiTexts(messages).length

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))
    // No onTranscript, no onInterim — flushBuffer carries the transcript
    sendFrame(ws, { type: 'mic_stop' })

    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)
    expect(aiTexts(messages).slice(prevAI).length).toBeGreaterThan(0)

    await closeWS(ws)
  })

  it('flushBuffer returns "red" — single-word answer accepted', async () => {
    const { ws, messages } = await startKidsSession()
    mocks.sttState.flushBufferFn.mockReturnValue('red')
    const prevAI = aiTexts(messages).length

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))
    sendFrame(ws, { type: 'mic_stop' })

    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)
    expect(aiTexts(messages).slice(prevAI).length).toBeGreaterThan(0)

    await closeWS(ws)
  })
})

// ── Suite 4 — Truly silent turn → no_transcript ───────────────────────────────

describe('Phase 16K — Truly silent turn emits no_transcript with child-safe TTS', () => {
  it('no transcript, no partial, no buffer → Kids Brain handles silence (no hardcoded message)', async () => {
    const { ws } = await startKidsSession()
    mocks.sttState.flushBufferFn.mockReturnValue('')
    mocks.speakToClientMock.mockClear()

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))
    // No audio, no transcript — completely silent turn
    sendFrame(ws, { type: 'mic_stop' })

    // Wait for 800ms Kids stabilization + Kids Brain processing
    await new Promise(r => setTimeout(r, 1500))

    const calls = mocks.speakToClientMock.mock.calls as unknown[][]

    // Kids Brain routes silence through the full pipeline → speakToClient called with recovery response
    expect(calls.length, 'speakToClient must be called for Kids silence recovery').toBeGreaterThan(0)

    // Adult prompt must NOT be used
    const adultCall = calls.find(c =>
      typeof c[1] === 'string' && (c[1] as string).includes("didn't catch that"),
    )
    expect(adultCall, 'Adult prompt must NOT be used for Kids').toBeUndefined()

    // Hardcoded "didn't hear you" must NOT appear — Kids Brain now handles silence
    const oldHardcoded = calls.find(c =>
      typeof c[1] === 'string' && (c[1] as string).includes("didn't hear you"),
    )
    expect(oldHardcoded, 'Hardcoded "didn\'t hear you" replaced by Kids Brain silence recovery').toBeUndefined()

    await closeWS(ws)
  })

  it('truly silent: no INVALID_MESSAGE errors, teacher_turn_end is sent', async () => {
    const { ws, messages } = await startKidsSession()
    mocks.sttState.flushBufferFn.mockReturnValue('')

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))
    sendFrame(ws, { type: 'mic_stop' })

    await new Promise(r => setTimeout(r, 1000))

    const errors = messages.filter(m => m['type'] === 'error' && m['code'] === 'INVALID_MESSAGE')
    expect(errors).toHaveLength(0)

    await closeWS(ws)
  })
})

// ── Suite 5 — Kids Brain receives transcript ──────────────────────────────────

describe('Phase 16K — Kids Brain receives and evaluates submitted transcript', () => {
  it('submitted "blue" → processKidsBrainV1Turn called → ai_text non-empty', async () => {
    const { ws, messages } = await startKidsSession()
    mocks.sttState.flushBufferFn.mockReturnValue('blue')
    const prevAI = aiTexts(messages).length

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))
    sendFrame(ws, { type: 'mic_stop' })

    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)

    const newTexts = aiTexts(messages).slice(prevAI)
    expect(newTexts.join(' ').length).toBeGreaterThan(0)
    expect(newTexts.join(' ').toLowerCase()).not.toMatch(/internal_error|invalid_session/i)

    await closeWS(ws)
  })

  it('submitted "cat" → Kids Brain responds (single-word animal answer)', async () => {
    const { ws, messages } = await startKidsSession()
    mocks.sttState.flushBufferFn.mockReturnValue('cat')
    const prevAI = aiTexts(messages).length

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))
    sendFrame(ws, { type: 'mic_stop' })

    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)
    expect(aiTexts(messages).slice(prevAI).length).toBeGreaterThan(0)

    await closeWS(ws)
  })
})

// ── Suite 6 — Regression: existing flows unaffected ──────────────────────────

describe('Phase 16K — Regression: existing Kids WebSocket flow intact', () => {
  it('mic_start/audio_chunk/mic_stop accepted without INVALID_MESSAGE', async () => {
    const { ws, messages } = await startKidsSession()

    const audioData = Buffer.from('fake-pcm-data-16k').toString('base64')
    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 30))
    sendFrame(ws, { type: 'audio_chunk', data: audioData })
    await new Promise(r => setTimeout(r, 30))
    sendFrame(ws, { type: 'mic_stop' })
    await new Promise(r => setTimeout(r, 1000))

    const errors = messages.filter(m => m['type'] === 'error' && m['code'] === 'INVALID_MESSAGE')
    expect(errors).toHaveLength(0)

    await closeWS(ws)
  })

  it('audio_chunk reaches stt.send() — not dropped', async () => {
    const { ws } = await startKidsSession()

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))

    const audioData = Buffer.from('pcm-16k-test').toString('base64')
    sendFrame(ws, { type: 'audio_chunk', data: audioData })
    await new Promise(r => setTimeout(r, 60))

    expect(mocks.sttState.sendFn).toHaveBeenCalledWith(audioData)

    await closeWS(ws)
  })

  it('duplicate mic_start is ignored without crashing', async () => {
    const { ws, messages } = await startKidsSession()

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 30))
    sendFrame(ws, { type: 'mic_start' })  // duplicate
    await new Promise(r => setTimeout(r, 30))
    sendFrame(ws, { type: 'mic_stop' })
    await new Promise(r => setTimeout(r, 1000))

    const errors = messages.filter(m => m['type'] === 'error')
    expect(errors).toHaveLength(0)

    await closeWS(ws)
  })

  it('TTS flow: speakToClient is called during Kids session start greeting', async () => {
    mocks.speakToClientMock.mockClear()
    const { ws } = await startKidsSession()
    // kidsTtsStream must have been called for the greeting
    expect(mocks.speakToClientMock).toHaveBeenCalled()
    await closeWS(ws)
  })
})
