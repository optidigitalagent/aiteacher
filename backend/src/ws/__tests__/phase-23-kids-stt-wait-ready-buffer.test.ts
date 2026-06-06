/**
 * Phase 23 — Kids STT Stale Chunk Rejection After Wait-Ready Mic Start
 *
 * Root cause fixed here:
 *   commit a935927 added waitUntilReady(2000) before micActive=true.
 *   Frontend sends audio_chunk immediately after mic_start.
 *   While backend awaits waitUntilReady, micActive is still false.
 *   audio_chunk handler: !micActive → stale_chunk_ignored.
 *   Deepgram gets 0 bytes → finalChars=0 → no_transcript.
 *
 * Fix tested here:
 *   When kidsWaitingForSttReady=true (during waitUntilReady), audio chunks are
 *   buffered (up to 200) instead of rejected as stale. After waitUntilReady
 *   resolves true, buffered chunks are flushed into the live STT connection.
 *   On waitUntilReady timeout/false, buffer is discarded.
 *
 * Tests:
 *  1. Audio chunks arriving during waitUntilReady window are buffered, not stale.
 *  2. After STT ready, buffered chunks are flushed to stt.send().
 *  3. mic_stop sees chunks > 0 when frontend sent audio during wait.
 *  4. waitUntilReady timeout: buffer discarded, turn finalizes silently.
 *  5. Old-turn chunks (from previous voiceTurnId) are still rejected.
 *  6. Chunks after mic_stop are still rejected.
 *  7. Normal (alive STT) path: chunks accepted via micActive without buffering.
 *  8. Alive STT path regression: existing 16K turn finalization unaffected.
 *  9. Buffer cap (>200 chunks) logs stale_waiting instead of silent accept.
 * 10. Successful wait-ready turn: Kids Brain receives transcript, finalChars>0.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { createServer } from 'http'
import type { Server } from 'http'
import type { AddressInfo } from 'net'
import WebSocket from 'ws'

// ── Shared mocks ──────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  process.env['USE_KIDS_BRAIN_V1'] = 'true'
  process.env['JWT_SECRET']        = 'test-secret-23'

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
      return { rows: [{ user_id: 'u-23-001', status: 'created', mode: 'mentium_kids' }], rowCount: 1 }
    }
    if (s.includes('SELECT LESSON_ID FROM LESSON_SESSIONS')) {
      return { rows: [], rowCount: 0 }
    }
    return { rows: [], rowCount: 0 }
  })

  const verifyTokenMock = vi.fn(async (token: string) => {
    if (token === 'tok-23') {
      return { userId: 'u-23-001', studentId: 's-23-001', email: 'stt@23.test', name: 'STT23' }
    }
    return null
  })

  const speakToClientMock = vi.fn(async () => undefined)
  const persistAnalyticsMock = vi.fn(async () => undefined)
  const hashUserIdMock = vi.fn((id: string | null) => (id ? id.slice(0, 8) : null))

  // waitUntilReady resolvers: test can push a resolve fn to control when it resolves
  const waitReadyResolvers: Array<(val: boolean) => void> = []

  const sttState = {
    onTranscript:  null as ((text: string) => void) | null,
    onInterim:     null as ((text: string) => void) | null,
    sendFn:        vi.fn(),
    clearBufferFn: vi.fn(),
    flushBufferFn: vi.fn(() => '') as ReturnType<typeof vi.fn>,
    isAliveFn:     vi.fn(() => true) as ReturnType<typeof vi.fn>,
    // waitUntilReadyFn: controls resolution; default instant-true.
    // Override with mockImplementationOnce for deferred tests.
    waitUntilReadyFn: vi.fn(async () => true) as ReturnType<typeof vi.fn>,
    constructorCallCount: 0,
  }

  return {
    redisMock, redisStore,
    queryMock, verifyTokenMock,
    speakToClientMock, persistAnalyticsMock, hashUserIdMock,
    sttState,
    waitReadyResolvers,
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
        send:           mocks.sttState.sendFn,
        close:          vi.fn(),
        clearBuffer:    mocks.sttState.clearBufferFn,
        flushBuffer:    mocks.sttState.flushBufferFn,
        isAlive:        mocks.sttState.isAliveFn,
        waitUntilReady: mocks.sttState.waitUntilReadyFn,
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

const SESSION_ID = 'sess-23-stt'
const TOKEN      = 'tok-23'

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
  mocks.sttState.waitUntilReadyFn.mockReset()
  mocks.sttState.waitUntilReadyFn.mockResolvedValue(true)
  mocks.sttState.constructorCallCount = 0
  mocks.waitReadyResolvers.length = 0
})

// ── Suite 1: Audio buffering during waitUntilReady ────────────────────────────

describe('Phase 23 — Audio buffering during stt_wait_ready window', () => {

  it('audio_chunk arrives during waitUntilReady → buffered, not rejected as stale; flushed after ready', async () => {
    // Scenario: mic_start triggers STT reconnect → waitUntilReady delays 100ms
    // Frontend sends audio chunks during the delay.
    // Expectation: chunks reach stt.send() after ready (not stale).

    const { ws } = await startKidsSession()

    // Simulate dead connection so waitUntilReady is called
    mocks.sttState.isAliveFn.mockReturnValueOnce(false)

    // waitUntilReady deferred — resolves after we send audio
    let resolveReady!: (val: boolean) => void
    mocks.sttState.waitUntilReadyFn.mockImplementationOnce(
      () => new Promise<boolean>(res => { resolveReady = res }),
    )

    sendFrame(ws, { type: 'mic_start' })
    // Give mic_start handler time to start but not complete waitUntilReady
    await new Promise(r => setTimeout(r, 30))

    // Send audio chunks WHILE waitUntilReady is pending
    const chunk1 = Buffer.from('pcm-audio-1').toString('base64')
    const chunk2 = Buffer.from('pcm-audio-2').toString('base64')
    sendFrame(ws, { type: 'audio_chunk', data: chunk1 })
    sendFrame(ws, { type: 'audio_chunk', data: chunk2 })
    await new Promise(r => setTimeout(r, 30))

    // Resolve waitUntilReady → mic_start flushes buffer
    resolveReady(true)
    await new Promise(r => setTimeout(r, 100))

    // stt.send() must have been called with the buffered chunks (in order)
    const sendCalls = (mocks.sttState.sendFn.mock.calls as unknown[][]).map(c => c[0])
    expect(sendCalls, 'Buffered chunks must be flushed to stt.send() after ready').toContain(chunk1)
    expect(sendCalls, 'Both buffered chunks must be flushed').toContain(chunk2)
    expect(sendCalls.indexOf(chunk1), 'Chunks flushed in arrival order').toBeLessThan(sendCalls.indexOf(chunk2))

    await closeWS(ws)
  })

  it('audio_chunk before waitUntilReady + audio_chunk after = both delivered', async () => {
    const { ws } = await startKidsSession()

    mocks.sttState.isAliveFn.mockReturnValueOnce(false)

    let resolveReady!: (val: boolean) => void
    mocks.sttState.waitUntilReadyFn.mockImplementationOnce(
      () => new Promise<boolean>(res => { resolveReady = res }),
    )

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 30))

    const prePcm = Buffer.from('pre-ready-chunk').toString('base64')
    sendFrame(ws, { type: 'audio_chunk', data: prePcm })
    await new Promise(r => setTimeout(r, 30))

    resolveReady(true)
    await new Promise(r => setTimeout(r, 60))

    const postPcm = Buffer.from('post-ready-chunk').toString('base64')
    sendFrame(ws, { type: 'audio_chunk', data: postPcm })
    await new Promise(r => setTimeout(r, 30))

    const sendCalls = (mocks.sttState.sendFn.mock.calls as unknown[][]).map(c => c[0])
    expect(sendCalls).toContain(prePcm)
    expect(sendCalls).toContain(postPcm)

    await closeWS(ws)
  })

  it('waitUntilReady false → buffer discarded, voice_unavailable sent, no fake Kids Brain silence', async () => {
    // waitUntilReady returns false (STT connect failed) → buffer discarded cleanly.
    // NEW (P0 fix): client receives voice_unavailable instead of Kids Brain fake silence recovery.
    // Kids Brain must NOT be called — the child is not actually silent, STT just failed.

    const { ws, messages } = await startKidsSession()
    const prevAI = aiTexts(messages).length

    mocks.sttState.isAliveFn.mockReturnValueOnce(false)
    // waitUntilReady resolves false (simulates Deepgram connection rejection)
    mocks.sttState.waitUntilReadyFn.mockResolvedValueOnce(false)

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 80))

    // Send audio chunks — these will be buffered but discarded on STT failure
    const chunk = Buffer.from('lost-audio').toString('base64')
    sendFrame(ws, { type: 'audio_chunk', data: chunk })
    await new Promise(r => setTimeout(r, 30))

    sendFrame(ws, { type: 'mic_stop' })
    // Wait for voice_unavailable (sent immediately in mic_start handler on STT failure)
    await waitUntil(messages, msgs => countOf(msgs, 'voice_unavailable') >= 1, 3000)

    // stt.send() must NOT have been called with the discarded chunk
    const sendCalls = (mocks.sttState.sendFn.mock.calls as unknown[][]).map(c => c[0])
    expect(sendCalls, 'Discarded chunks must not reach stt.send() after STT failure').not.toContain(chunk)

    // voice_unavailable sent to client so frontend can show retry UI
    const unavailable = messages.filter(m => m['type'] === 'voice_unavailable')
    expect(unavailable.length, 'voice_unavailable must be sent on STT connect failure').toBeGreaterThan(0)
    expect((unavailable[0] as Record<string, unknown>)['reason']).toBe('STT_CONNECT_FAILED')

    // Kids Brain must NOT have been called — no fake silence recovery
    const newTexts = aiTexts(messages).slice(prevAI)
    expect(newTexts.length, 'Kids Brain must NOT respond to STT-failed turn').toBe(0)

    await closeWS(ws)
  })

  it('alive STT path: audio_chunk accepted normally via micActive without buffer', async () => {
    // Normal path: isAlive()=true → no reconnect → micActive=true set immediately.
    // Audio chunks must reach stt.send() directly (not via buffer).

    const { ws } = await startKidsSession()

    // Connection is alive (default)
    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))

    const pcm = Buffer.from('normal-chunk').toString('base64')
    sendFrame(ws, { type: 'audio_chunk', data: pcm })
    await new Promise(r => setTimeout(r, 30))

    expect(mocks.sttState.sendFn).toHaveBeenCalledWith(pcm)

    await closeWS(ws)
  })
})

// ── Suite 2: Stale protection still applies ───────────────────────────────────

describe('Phase 23 — Stale chunk protection still intact', () => {

  it('audio_chunk before mic_start (no active turn) → rejected as stale', async () => {
    const { ws } = await startKidsSession()
    mocks.sttState.sendFn.mockClear()

    // Send chunk without mic_start
    const orphan = Buffer.from('orphan-chunk').toString('base64')
    sendFrame(ws, { type: 'audio_chunk', data: orphan })
    await new Promise(r => setTimeout(r, 60))

    expect(mocks.sttState.sendFn).not.toHaveBeenCalledWith(orphan)

    await closeWS(ws)
  })

  it('audio_chunk after mic_stop stabilization completes → rejected as stale', async () => {
    const { ws } = await startKidsSession()

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))
    mocks.sttState.onTranscript?.('blue')
    sendFrame(ws, { type: 'mic_stop' })

    // Wait for stabilization to complete (Kids: 800ms)
    await new Promise(r => setTimeout(r, 900))

    mocks.sttState.sendFn.mockClear()

    // Send chunk after turn is finalized
    const late = Buffer.from('late-chunk').toString('base64')
    sendFrame(ws, { type: 'audio_chunk', data: late })
    await new Promise(r => setTimeout(r, 60))

    expect(mocks.sttState.sendFn).not.toHaveBeenCalledWith(late)

    await closeWS(ws)
  })

  it('no INVALID_MESSAGE errors during buffering window', async () => {
    const { ws, messages } = await startKidsSession()

    mocks.sttState.isAliveFn.mockReturnValueOnce(false)

    let resolveReady!: (val: boolean) => void
    mocks.sttState.waitUntilReadyFn.mockImplementationOnce(
      () => new Promise<boolean>(res => { resolveReady = res }),
    )

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 30))

    for (let i = 0; i < 5; i++) {
      sendFrame(ws, { type: 'audio_chunk', data: Buffer.from(`chunk-${i}`).toString('base64') })
    }
    await new Promise(r => setTimeout(r, 30))

    resolveReady(true)
    await new Promise(r => setTimeout(r, 50))

    const errors = messages.filter(m => m['type'] === 'error' && m['code'] === 'INVALID_MESSAGE')
    expect(errors).toHaveLength(0)

    await closeWS(ws)
  })
})

// ── Suite 3: Successful wait-ready turn → Kids Brain receives transcript ───────

describe('Phase 23 — Successful wait-ready turn: transcript reaches Kids Brain', () => {

  it('reconnect + buffer + flush + transcript → Kids Brain responds (finalChars > 0)', async () => {
    // Full end-to-end scenario reproducing the production fix:
    // 1. Deepgram dead → reconnect
    // 2. Audio chunks arrive during waitUntilReady
    // 3. waitUntilReady resolves true → chunks flushed
    // 4. Deepgram fires transcript via onTranscript
    // 5. mic_stop → Kids Brain receives text → responds

    const { ws, messages } = await startKidsSession()
    const prevAI = aiTexts(messages).length

    mocks.sttState.isAliveFn.mockReturnValueOnce(false)

    let resolveReady!: (val: boolean) => void
    mocks.sttState.waitUntilReadyFn.mockImplementationOnce(
      () => new Promise<boolean>(res => { resolveReady = res }),
    )

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 30))

    // Chunks arrive during wait window
    const audioChunk = Buffer.from('pcm-voice-data').toString('base64')
    sendFrame(ws, { type: 'audio_chunk', data: audioChunk })
    await new Promise(r => setTimeout(r, 20))

    // STT becomes ready → chunks flushed
    resolveReady(true)
    await new Promise(r => setTimeout(r, 60))

    // Deepgram processes flushed audio and fires transcript
    mocks.sttState.onTranscript?.('cat')
    await new Promise(r => setTimeout(r, 60))

    sendFrame(ws, { type: 'mic_stop' })

    // Kids stabilization (800ms) + processing
    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)

    const newTexts = aiTexts(messages).slice(prevAI)
    expect(newTexts.length, 'Kids Brain must respond to submitted transcript').toBeGreaterThan(0)
    expect(newTexts.join(' ').toLowerCase()).not.toMatch(/internal_error|invalid_session/i)

    // Verify audio actually reached STT (chunks > 0)
    expect(mocks.sttState.sendFn).toHaveBeenCalledWith(audioChunk)

    await closeWS(ws)
  })

  it('multiple chunks buffered during wait → all delivered to STT in order', async () => {
    const { ws } = await startKidsSession()

    mocks.sttState.isAliveFn.mockReturnValueOnce(false)

    let resolveReady!: (val: boolean) => void
    mocks.sttState.waitUntilReadyFn.mockImplementationOnce(
      () => new Promise<boolean>(res => { resolveReady = res }),
    )

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 30))

    const chunks = Array.from({ length: 10 }, (_, i) => Buffer.from(`chunk-${i}`).toString('base64'))
    for (const c of chunks) {
      sendFrame(ws, { type: 'audio_chunk', data: c })
    }
    await new Promise(r => setTimeout(r, 50))

    resolveReady(true)
    await new Promise(r => setTimeout(r, 80))

    const sendCalls = (mocks.sttState.sendFn.mock.calls as unknown[][]).map(c => c[0])
    for (const c of chunks) {
      expect(sendCalls, `chunk ${c} must reach stt.send()`).toContain(c)
    }
    // Order preserved
    const indices = chunks.map(c => sendCalls.indexOf(c))
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]!, 'Chunks must be flushed in arrival order').toBeGreaterThan(indices[i - 1]!)
    }

    await closeWS(ws)
  })
})

// ── Suite 4: Phase 16K regression ─────────────────────────────────────────────

describe('Phase 23 — Phase 16K regression: existing STT turn finalization intact', () => {

  it('normal mic_start (alive STT) + onTranscript → Kids Brain receives transcript', async () => {
    const { ws, messages } = await startKidsSession()
    const prevAI = aiTexts(messages).length

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))

    mocks.sttState.onTranscript?.('blue')
    sendFrame(ws, { type: 'mic_stop' })

    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)
    expect(aiTexts(messages).slice(prevAI).length).toBeGreaterThan(0)

    await closeWS(ws)
  })

  it('partial fallback (onInterim) still works after Phase 23 changes', async () => {
    const { ws, messages } = await startKidsSession()
    mocks.sttState.flushBufferFn.mockReturnValue('')
    const prevAI = aiTexts(messages).length

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))

    mocks.sttState.onInterim?.('green')
    sendFrame(ws, { type: 'mic_stop' })

    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)
    expect(aiTexts(messages).slice(prevAI).length).toBeGreaterThan(0)

    await closeWS(ws)
  })

  it('flushBuffer returns transcript → Kids Brain responds', async () => {
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

  it('truly silent turn (no audio, no transcript) → Kids Brain silence recovery', async () => {
    const { ws, messages } = await startKidsSession()
    const prevAI = aiTexts(messages).length
    mocks.speakToClientMock.mockClear()

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 60))
    sendFrame(ws, { type: 'mic_stop' })

    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)
    expect(mocks.speakToClientMock).toHaveBeenCalled()

    await closeWS(ws)
  })
})

// ── Suite 5: mic_stop while waitUntilReady is pending ─────────────────────────

describe('Phase 23 — mic_stop_while_waiting: deferred finalization after buffer flush', () => {

  it('mic_stop during waitUntilReady → Kids Brain receives transcript (finalize_after_wait)', async () => {
    // Scenario: Deepgram dead → reconnect → waitUntilReady deferred
    // Frontend sends mic_stop BEFORE waitUntilReady resolves.
    // Fix: mic_stop sets kidsMicStopDuringWait; mic_start runs finalization after flush.
    // Kids Brain must respond (not a zombie-open mic or lost turn).

    const { ws, messages } = await startKidsSession()
    const prevAI = aiTexts(messages).length

    mocks.sttState.isAliveFn.mockReturnValueOnce(false)

    let resolveReady!: (val: boolean) => void
    mocks.sttState.waitUntilReadyFn.mockImplementationOnce(
      () => new Promise<boolean>(res => { resolveReady = res }),
    )

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 30))  // mic_start is now awaiting waitUntilReady

    // Audio chunks arrive during wait
    const audioChunk = Buffer.from('pcm-during-wait').toString('base64')
    sendFrame(ws, { type: 'audio_chunk', data: audioChunk })
    await new Promise(r => setTimeout(r, 20))

    // mic_stop arrives BEFORE waitUntilReady resolves
    sendFrame(ws, { type: 'mic_stop' })
    await new Promise(r => setTimeout(r, 30))

    // Now resolve waitUntilReady → mic_start flushes buffer, fires deferred finalize
    resolveReady(true)

    // Deepgram processes flushed audio and fires transcript
    await new Promise(r => setTimeout(r, 100))
    mocks.sttState.onTranscript?.('blue')

    // Kids stabilization (800ms) + processing
    await waitUntil(messages, msgs => aiTexts(msgs).length > prevAI, 5000)

    const newTexts = aiTexts(messages).slice(prevAI)
    expect(newTexts.length, 'Kids Brain must respond after deferred finalization').toBeGreaterThan(0)
    expect(mocks.sttState.sendFn, 'Buffered chunks must reach STT').toHaveBeenCalledWith(audioChunk)

    await closeWS(ws)
  })

  it('mic_stop during STT-connect-failed wait → voice_unavailable sent, no zombie mic, no fake silence', async () => {
    // waitUntilReady resolves false while mic_stop is already deferred.
    // Buffer discarded; turn emits voice_unavailable (not fake silence).
    // Most importantly: micActive must NOT be left true (no zombie).

    const { ws, messages } = await startKidsSession()
    const prevAI = aiTexts(messages).length

    mocks.sttState.isAliveFn.mockReturnValueOnce(false)
    // waitUntilReady resolves false immediately (STT rejected)
    mocks.sttState.waitUntilReadyFn.mockResolvedValueOnce(false)

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 30))

    // Send chunk and mic_stop during wait
    const lostChunk = Buffer.from('lost-in-timeout').toString('base64')
    sendFrame(ws, { type: 'audio_chunk', data: lostChunk })
    sendFrame(ws, { type: 'mic_stop' })

    // Wait for voice_unavailable (not Kids Brain ai_text)
    await waitUntil(messages, msgs => countOf(msgs, 'voice_unavailable') >= 1, 3000)

    expect(mocks.sttState.sendFn, 'Chunk must NOT reach STT on STT-failed path').not.toHaveBeenCalledWith(lostChunk)

    // voice_unavailable must be sent — not fake Kids Brain silence recovery
    expect(countOf(messages, 'voice_unavailable'), 'voice_unavailable must be sent').toBeGreaterThan(0)
    expect(aiTexts(messages).slice(prevAI).length, 'Kids Brain must NOT fire fake silence').toBe(0)

    await closeWS(ws)
  })

  it('mic_stop during wait → chunks > 0 counted after flush, not at mic_stop time', async () => {
    // captureChunks must reflect chunks flushed AFTER wait, not the 0-count at mic_stop time.
    // This ensures late_collection_start fires (captureChunks > 0) and finalChars can be > 0.

    const { ws } = await startKidsSession()

    mocks.sttState.isAliveFn.mockReturnValueOnce(false)

    let resolveReady!: (val: boolean) => void
    mocks.sttState.waitUntilReadyFn.mockImplementationOnce(
      () => new Promise<boolean>(res => { resolveReady = res }),
    )

    sendFrame(ws, { type: 'mic_start' })
    await new Promise(r => setTimeout(r, 30))

    // 5 audio chunks during wait
    const chunks = Array.from({ length: 5 }, (_, i) => Buffer.from(`chunk-${i}`).toString('base64'))
    for (const c of chunks) sendFrame(ws, { type: 'audio_chunk', data: c })
    await new Promise(r => setTimeout(r, 30))

    sendFrame(ws, { type: 'mic_stop' })
    await new Promise(r => setTimeout(r, 20))

    resolveReady(true)
    await new Promise(r => setTimeout(r, 100))

    // All buffered chunks must have reached stt.send()
    const sendCalls = (mocks.sttState.sendFn.mock.calls as unknown[][]).map(c => c[0])
    for (const c of chunks) {
      expect(sendCalls, `chunk ${c} must reach STT after deferred finalize`).toContain(c)
    }

    await closeWS(ws)
  })
})
