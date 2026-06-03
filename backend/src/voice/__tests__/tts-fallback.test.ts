/**
 * TTS Fallback Tests — Phase 16K
 *
 * Verifies speakToClient() returns TtsResult and applies process-level provider
 * cooldowns on quota/rate errors. Each test resets modules for a fresh flag state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Helpers ───────────────────────────────────────────────────────────────────

type SendFn = (msg: { type: string; data?: string }) => void

function makeSend(): { send: SendFn; chunks: string[] } {
  const chunks: string[] = []
  const send: SendFn = (msg) => {
    if (msg.type === 'audio_chunk' && msg.data) chunks.push(msg.data)
  }
  return { send, chunks }
}

function makeOpenAIMock(impl: () => object) {
  vi.doMock('openai', () => ({ default: vi.fn().mockImplementation(impl) }))
}

// ── Suite 1: OpenAI TTS success ───────────────────────────────────────────────

describe('TTS — OpenAI success path', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns { ok: true } and emits audio_chunk when OpenAI TTS succeeds', async () => {
    const mp3Data = Buffer.from('fake-mp3')

    makeOpenAIMock(() => ({
      audio: {
        speech: {
          create: vi.fn().mockResolvedValue({
            body: new ReadableStream({
              start(controller: ReadableStreamDefaultController) {
                controller.enqueue(new Uint8Array(mp3Data))
                controller.close()
              },
            }),
          }),
        },
      },
    }))
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('ELEVENLABS_API_KEY', '')

    const { speakToClient } = await import('../tts.js')
    const { send, chunks } = makeSend()

    const result = await speakToClient(send as never, 'Hello kids!', undefined, 'nova')

    expect(result.ok).toBe(true)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0]).toBe(mp3Data.toString('base64'))
  })
})

// ── Suite 2: OpenAI TTS 429 — single call ────────────────────────────────────

describe('TTS — OpenAI 429 quota error (single call)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns { ok: false, reason: TTS_PROVIDER_QUOTA } on 429', async () => {
    const quotaError = Object.assign(new Error('429 You exceeded your current quota'), { status: 429 })
    makeOpenAIMock(() => ({
      audio: { speech: { create: vi.fn().mockRejectedValue(quotaError) } },
    }))
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('ELEVENLABS_API_KEY', '')

    const { speakToClient } = await import('../tts.js')
    const { send } = makeSend()

    const result = await speakToClient(send as never, 'Hello!', undefined)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.textOnly).toBe(true)
      expect(result.reason).toBe('TTS_PROVIDER_QUOTA')
    }
  })

  it('does not throw — returns TtsResult even on quota failure', async () => {
    const quotaError = Object.assign(new Error('429 insufficient_quota'), { status: 429 })
    makeOpenAIMock(() => ({
      audio: { speech: { create: vi.fn().mockRejectedValue(quotaError) } },
    }))
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('ELEVENLABS_API_KEY', '')

    const { speakToClient } = await import('../tts.js')
    const { send } = makeSend()

    await expect(speakToClient(send as never, 'Hello!', undefined)).resolves.toBeDefined()
  })
})

// ── Suite 3: Cooldown — OpenAI not retried after 429 ────────────────────────

describe('TTS — OpenAI cooldown after 429 (sequential turns)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('does not call OpenAI create() again after quota failure', async () => {
    const quotaError = Object.assign(new Error('429 quota exceeded'), { status: 429 })
    const createMock = vi.fn().mockRejectedValue(quotaError)
    makeOpenAIMock(() => ({
      audio: { speech: { create: createMock } },
    }))
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('ELEVENLABS_API_KEY', '')

    const { speakToClient } = await import('../tts.js')
    const { send } = makeSend()

    // Turn 1 — hits 429, sets openAiTtsDisabled
    const r1 = await speakToClient(send as never, 'Turn 1', undefined)
    expect(r1.ok).toBe(false)
    expect(createMock).toHaveBeenCalledTimes(1)

    // Turn 2 — OpenAI must be skipped (cooldown), no new create() call
    const r2 = await speakToClient(send as never, 'Turn 2', undefined)
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.reason).toBe('TTS_PROVIDER_UNAVAILABLE')
    expect(createMock).toHaveBeenCalledTimes(1)  // still 1 — not retried

    // Turn 3 — still skipped
    await speakToClient(send as never, 'Turn 3', undefined)
    expect(createMock).toHaveBeenCalledTimes(1)
  })
})

// ── Suite 4: ElevenLabs quota → fallthrough to OpenAI ────────────────────────

describe('TTS — ElevenLabs 429 fallthrough to OpenAI', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('falls through to OpenAI when ElevenLabs returns 429', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => '{"error":"quota_exceeded"}',
    })
    vi.stubGlobal('fetch', fetchMock)

    const createMock = vi.fn().mockResolvedValue({
      body: new ReadableStream({
        start(controller: ReadableStreamDefaultController) {
          controller.enqueue(Buffer.from('openai-mp3'))
          controller.close()
        },
      }),
    })
    makeOpenAIMock(() => ({ audio: { speech: { create: createMock } } }))

    vi.stubEnv('ELEVENLABS_API_KEY', 'el-test')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    const { speakToClient } = await import('../tts.js')
    const { send, chunks } = makeSend()

    const result = await speakToClient(send as never, 'Hello!', undefined)

    expect(result.ok).toBe(true)
    expect(chunks.length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('ElevenLabs disabled after 429 — not called on subsequent turns', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => '{"error":"quota_exceeded"}',
    })
    vi.stubGlobal('fetch', fetchMock)

    const createMock = vi.fn().mockResolvedValue({
      body: new ReadableStream({
        start(c: ReadableStreamDefaultController) { c.enqueue(Buffer.from('mp3')); c.close() },
      }),
    })
    makeOpenAIMock(() => ({ audio: { speech: { create: createMock } } }))

    vi.stubEnv('ELEVENLABS_API_KEY', 'el-test')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    const { speakToClient } = await import('../tts.js')
    const { send } = makeSend()

    // Call 3 times — ElevenLabs must only be hit once (disabled after first 429)
    await speakToClient(send as never, 'Turn 1', undefined)
    await speakToClient(send as never, 'Turn 2', undefined)
    await speakToClient(send as never, 'Turn 3', undefined)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledTimes(3)  // OpenAI still used for all turns
  })
})

// ── Suite 5: Both providers unavailable ──────────────────────────────────────

describe('TTS — Both providers unavailable', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns { ok: false } when ElevenLabs and OpenAI both fail with quota', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => '{"error":"quota_exceeded"}',
    }))
    makeOpenAIMock(() => ({
      audio: {
        speech: {
          create: vi.fn().mockRejectedValue(
            Object.assign(new Error('429 quota exceeded'), { status: 429 }),
          ),
        },
      },
    }))
    vi.stubEnv('ELEVENLABS_API_KEY', 'el-test')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    const { speakToClient } = await import('../tts.js')
    const { send } = makeSend()

    const result = await speakToClient(send as never, 'Hello!', undefined)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.textOnly).toBe(true)
      expect(['TTS_PROVIDER_QUOTA', 'TTS_RATE_LIMITED', 'TTS_PROVIDER_UNAVAILABLE']).toContain(result.reason)
    }
  })
})

// ── Suite 6: AbortSignal (intentional interrupt) ──────────────────────────────

describe('TTS — AbortSignal (intentional interrupt)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns { ok: true } when aborted — lesson not treated as TTS failure', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    makeOpenAIMock(() => ({
      audio: { speech: { create: vi.fn().mockRejectedValue(abortError) } },
    }))
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('ELEVENLABS_API_KEY', '')

    const { speakToClient } = await import('../tts.js')
    const { send, chunks } = makeSend()

    const ctrl = new AbortController()
    ctrl.abort()

    const result = await speakToClient(send as never, 'Hello!', ctrl.signal)

    expect(result.ok).toBe(true)
    expect(chunks.length).toBe(0)
  })
})
