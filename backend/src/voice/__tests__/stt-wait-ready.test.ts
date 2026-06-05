/**
 * Phase 22 — DeepgramSTT.waitUntilReady() regression tests
 *
 * Root cause fixed:
 *   mic_start set micActive=true immediately after createSTT, before Deepgram
 *   Open fired. Audio arrived before the connection was ready, queued in a
 *   dead socket, never flushed → finalChars=0 → no_transcript.
 *
 * Fix tested here:
 *   waitUntilReady(timeoutMs) blocks until Open fires (true) or the connection
 *   fails/times out (false). mic_start only sets micActive=true after this
 *   resolves true, ensuring audio is never sent to a not-yet-open connection.
 *
 * Tests:
 *   1. Resolves true immediately when already ready (Open already fired)
 *   2. Resolves true when Open fires within timeout
 *   3. Resolves false when Error fires before Open
 *   4. Resolves false when Close fires before Open
 *   5. Resolves false when timeout expires before Open
 *   6. Multiple concurrent waiters all resolve correctly
 *   7. Resolves false immediately when conn is null (dead connection)
 *   8. Timer is cleared when Open fires (no spurious timeout after Open)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

vi.hoisted(() => {
  process.env['DEEPGRAM_API_KEY'] = 'test-key-wait-ready'
})

type MockLive = EventEmitter & {
  send:      ReturnType<typeof vi.fn>
  finish:    ReturnType<typeof vi.fn>
  keepAlive: ReturnType<typeof vi.fn>
}

let mockLive: MockLive

vi.mock('@deepgram/sdk', () => ({
  createClient: vi.fn(() => ({
    listen: {
      live: vi.fn(() => mockLive),
    },
  })),
  LiveTranscriptionEvents: {
    Open:         'open',
    Close:        'close',
    Transcript:   'Results',
    UtteranceEnd: 'UtteranceEnd',
    Error:        'error',
  },
}))

import { DeepgramSTT } from '../stt.js'

function makeEmitter(): MockLive {
  const e = new EventEmitter() as MockLive
  e.on('error', () => { /* suppress unhandled */ })
  e.send      = vi.fn()
  e.finish    = vi.fn()
  e.keepAlive = vi.fn()
  return e
}

function makeStt(): DeepgramSTT {
  return new DeepgramSTT(vi.fn(), vi.fn())
}

beforeEach(() => {
  mockLive = makeEmitter()
  vi.useFakeTimers()
  vi.spyOn(console, 'log').mockImplementation(() => { /* quiet */ })
  vi.spyOn(console, 'error').mockImplementation(() => { /* quiet */ })
  vi.spyOn(console, 'warn').mockImplementation(() => { /* quiet */ })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('DeepgramSTT.waitUntilReady()', () => {

  it('resolves true immediately when already open', async () => {
    const stt = makeStt()
    mockLive.emit('open')
    expect(stt.isAlive()).toBe(true)

    const result = await stt.waitUntilReady(2000)
    expect(result).toBe(true)
  })

  it('resolves true when Open fires within timeout', async () => {
    const stt = makeStt()

    const readyP = stt.waitUntilReady(2000)
    // Not yet open — promise is pending
    vi.advanceTimersByTime(200)
    mockLive.emit('open')

    const result = await readyP
    expect(result).toBe(true)
  })

  it('resolves false when Error fires before Open', async () => {
    const stt = makeStt()

    const readyP = stt.waitUntilReady(2000)
    mockLive.emit('error', new Error('connection refused'))

    const result = await readyP
    expect(result).toBe(false)
  })

  it('resolves false when Close fires before Open', async () => {
    const stt = makeStt()

    const readyP = stt.waitUntilReady(2000)
    mockLive.emit('close', 1008, Buffer.from('policy violation'))

    const result = await readyP
    expect(result).toBe(false)
  })

  it('resolves false when timeout expires (Open never fires)', async () => {
    const stt = makeStt()

    const readyP = stt.waitUntilReady(1000)
    vi.advanceTimersByTime(1001)

    const result = await readyP
    expect(result).toBe(false)
  })

  it('resolves false immediately when conn is already null (dead connection)', async () => {
    const stt = makeStt()
    // Kill the connection — conn becomes null
    mockLive.emit('open')
    mockLive.emit('close', 1006, Buffer.from(''))
    expect(stt.isAlive()).toBe(false)

    const result = await stt.waitUntilReady(2000)
    expect(result).toBe(false)
  })

  it('multiple concurrent waiters all resolve true on Open', async () => {
    const stt = makeStt()

    const p1 = stt.waitUntilReady(2000)
    const p2 = stt.waitUntilReady(2000)
    const p3 = stt.waitUntilReady(2000)

    mockLive.emit('open')

    const [r1, r2, r3] = await Promise.all([p1, p2, p3])
    expect(r1).toBe(true)
    expect(r2).toBe(true)
    expect(r3).toBe(true)
  })

  it('multiple concurrent waiters all resolve false on Close', async () => {
    const stt = makeStt()

    const p1 = stt.waitUntilReady(2000)
    const p2 = stt.waitUntilReady(2000)

    mockLive.emit('close', 1006, Buffer.from('dropped'))

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe(false)
    expect(r2).toBe(false)
  })

  it('timeout does not fire after Open resolves the waiter', async () => {
    const stt = makeStt()

    const readyP = stt.waitUntilReady(1000)
    vi.advanceTimersByTime(200)
    mockLive.emit('open')

    const result = await readyP
    expect(result).toBe(true)

    // Advance past the original timeout — should not throw or double-resolve
    expect(() => vi.advanceTimersByTime(1500)).not.toThrow()
  })

  it('Error followed by Close resolves false exactly once (no double-resolve)', async () => {
    const stt = makeStt()
    let callCount = 0
    const readyP = new Promise<boolean>(resolve => {
      stt.waitUntilReady(2000).then(v => { callCount++; resolve(v) })
    })

    mockLive.emit('error', new Error('network error'))
    mockLive.emit('close', 1006, Buffer.from(''))

    const result = await readyP
    expect(result).toBe(false)
    expect(callCount).toBe(1)
  })

  it('connection dying immediately (age<1s) resolves false via Close', async () => {
    const stt = makeStt()
    // Simulate Deepgram rejecting connection within 231ms (production scenario)
    const readyP = stt.waitUntilReady(2000)

    vi.advanceTimersByTime(231)
    mockLive.emit('close', 1008, Buffer.from('rejected'))

    const result = await readyP
    expect(result).toBe(false)
  })

  it('isAlive() returns false after waitUntilReady resolves false via Close', async () => {
    const stt = makeStt()
    const readyP = stt.waitUntilReady(2000)
    mockLive.emit('close', 1006, Buffer.from(''))

    await readyP
    expect(stt.isAlive()).toBe(false)
  })

  it('isAlive() returns true after waitUntilReady resolves true via Open', async () => {
    const stt = makeStt()
    const readyP = stt.waitUntilReady(2000)
    mockLive.emit('open')

    await readyP
    expect(stt.isAlive()).toBe(true)
  })
})
