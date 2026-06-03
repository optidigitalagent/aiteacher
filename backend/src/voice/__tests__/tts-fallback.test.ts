/**
 * TTS Fallback Tests
 *
 * Verifies speakToClient() returns TtsResult, applies TTL-based provider
 * cooldowns on quota/rate errors, and handles provider selection via TTS_PROVIDER env.
 * Each test resets modules for a fresh flag/cooldown state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

  it('does not call OpenAI create() again during cooldown window', async () => {
    const quotaError = Object.assign(new Error('429 quota exceeded'), { status: 429 })
    const createMock = vi.fn().mockRejectedValue(quotaError)
    makeOpenAIMock(() => ({
      audio: { speech: { create: createMock } },
    }))
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('ELEVENLABS_API_KEY', '')

    const { speakToClient } = await import('../tts.js')
    const { send } = makeSend()

    // Turn 1 — hits 429, sets cooldown timestamp
    const r1 = await speakToClient(send as never, 'Turn 1', undefined)
    expect(r1.ok).toBe(false)
    expect(createMock).toHaveBeenCalledTimes(1)

    // Turn 2 — within cooldown window, OpenAI must be skipped
    const r2 = await speakToClient(send as never, 'Turn 2', undefined)
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.reason).toBe('TTS_PROVIDER_UNAVAILABLE')
    expect(createMock).toHaveBeenCalledTimes(1)  // still 1 — not retried

    // Turn 3 — still skipped
    await speakToClient(send as never, 'Turn 3', undefined)
    expect(createMock).toHaveBeenCalledTimes(1)
  })
})

// ── Suite 3b: Cooldown recovery after TTL expires ────────────────────────────

describe('TTS — cooldown recovery after TTL expires', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries OpenAI after cooldown window expires', async () => {
    const quotaError = Object.assign(new Error('429 quota exceeded'), { status: 429 })
    const createMock = vi.fn()
      .mockRejectedValueOnce(quotaError)
      .mockResolvedValue({
        body: new ReadableStream({
          start(c: ReadableStreamDefaultController) {
            c.enqueue(Buffer.from('recovered-mp3'))
            c.close()
          },
        }),
      })
    makeOpenAIMock(() => ({ audio: { speech: { create: createMock } } }))
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('ELEVENLABS_API_KEY', '')

    const { speakToClient } = await import('../tts.js')
    const { send } = makeSend()

    // Turn 1: quota error → cooldown set (15 min)
    const r1 = await speakToClient(send as never, 'Turn 1', undefined)
    expect(r1.ok).toBe(false)

    // Advance time past the 15-min cooldown
    vi.advanceTimersByTime(16 * 60 * 1000)

    // Turn 2: cooldown expired — OpenAI retried and succeeds
    const r2 = await speakToClient(send as never, 'Turn 2', undefined)
    expect(r2.ok).toBe(true)
    expect(createMock).toHaveBeenCalledTimes(2)
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

    // Use mockImplementation so each call gets a fresh ReadableStream (avoids
    // shared stream state after the first call drains and closes the source).
    const createMock = vi.fn().mockImplementation(async () => ({
      body: new ReadableStream({
        start(c: ReadableStreamDefaultController) { c.enqueue(Buffer.from('mp3')); c.close() },
      }),
    }))
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

// ── Suite 4b: ElevenLabs 401 auth error → fallthrough to OpenAI ──────────────

describe('TTS — ElevenLabs 401 auth error fallthrough', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('falls through to OpenAI when ElevenLabs returns 401 invalid key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"detail":"invalid_api_key"}',
    })
    vi.stubGlobal('fetch', fetchMock)

    const createMock = vi.fn().mockResolvedValue({
      body: new ReadableStream({
        start(c: ReadableStreamDefaultController) { c.enqueue(Buffer.from('mp3')); c.close() },
      }),
    })
    makeOpenAIMock(() => ({ audio: { speech: { create: createMock } } }))

    vi.stubEnv('ELEVENLABS_API_KEY', 'el-invalid')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    const { speakToClient } = await import('../tts.js')
    const { send, chunks } = makeSend()

    const result = await speakToClient(send as never, 'Hello!', undefined)

    expect(result.ok).toBe(true)
    expect(chunks.length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('classifies 401 as TTS_PROVIDER_UNAVAILABLE (not TTS_UNKNOWN_ERROR)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"detail":"invalid_api_key"}',
    })
    vi.stubGlobal('fetch', fetchMock)

    // OpenAI also fails so we see the ElevenLabs reason propagate
    const quotaError = Object.assign(new Error('429 quota exceeded'), { status: 429 })
    makeOpenAIMock(() => ({
      audio: { speech: { create: vi.fn().mockRejectedValue(quotaError) } },
    }))

    vi.stubEnv('ELEVENLABS_API_KEY', 'el-invalid')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    const { speakToClient } = await import('../tts.js')
    const { send } = makeSend()

    // Let both providers fail
    await speakToClient(send as never, 'Hello!', undefined)

    // After quota hits OpenAI, next turn skips both → UNAVAILABLE
    const r2 = await speakToClient(send as never, 'Hello again!', undefined)
    expect(r2.ok).toBe(false)
    if (!r2.ok) {
      expect(['TTS_PROVIDER_UNAVAILABLE', 'TTS_PROVIDER_QUOTA']).toContain(r2.reason)
    }
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

  it('returns TTS_PROVIDER_UNAVAILABLE when no keys are configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    vi.stubEnv('ELEVENLABS_API_KEY', '')

    const { speakToClient } = await import('../tts.js')
    const { send } = makeSend()

    const result = await speakToClient(send as never, 'Hello!', undefined)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.textOnly).toBe(true)
      expect(result.reason).toBe('TTS_PROVIDER_UNAVAILABLE')
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

// ── Suite 7: Provider selection via TTS_PROVIDER env ─────────────────────────

describe('TTS — TTS_PROVIDER env var forces provider selection', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('TTS_PROVIDER=openai skips ElevenLabs even when key is present', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const createMock = vi.fn().mockResolvedValue({
      body: new ReadableStream({
        start(c: ReadableStreamDefaultController) { c.enqueue(Buffer.from('mp3')); c.close() },
      }),
    })
    makeOpenAIMock(() => ({ audio: { speech: { create: createMock } } }))

    vi.stubEnv('TTS_PROVIDER', 'openai')
    vi.stubEnv('ELEVENLABS_API_KEY', 'el-test')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    const { speakToClient } = await import('../tts.js')
    const { send } = makeSend()

    const result = await speakToClient(send as never, 'Hello!', undefined)

    expect(result.ok).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()     // ElevenLabs skipped
    expect(createMock).toHaveBeenCalledTimes(1)  // OpenAI used
  })

  it('TTS_PROVIDER=elevenlabs skips OpenAI when ElevenLabs key is present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(c: ReadableStreamDefaultController) {
          c.enqueue(Buffer.from('el-mp3'))
          c.close()
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const createMock = vi.fn()
    makeOpenAIMock(() => ({ audio: { speech: { create: createMock } } }))

    vi.stubEnv('TTS_PROVIDER', 'elevenlabs')
    vi.stubEnv('ELEVENLABS_API_KEY', 'el-test')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    const { speakToClient } = await import('../tts.js')
    const { send } = makeSend()

    const result = await speakToClient(send as never, 'Hello!', undefined)

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)  // ElevenLabs used
    expect(createMock).not.toHaveBeenCalled()   // OpenAI skipped
  })
})

// ── Suite 8: Provider status health check ────────────────────────────────────

describe('TTS — getTtsProviderStatus reports config without exposing secrets', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('reports key presence and model config without exposing key values', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-super-secret-key')
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    vi.stubEnv('OPENAI_TTS_MODEL', 'tts-1')
    vi.stubEnv('OPENAI_TTS_VOICE', 'alloy')

    const { getTtsProviderStatus } = await import('../tts.js')
    const status = getTtsProviderStatus()

    expect(status.openai.keyPresent).toBe(true)
    expect(status.openai.model).toBe('tts-1')
    expect(status.openai.voice).toBe('alloy')
    expect(status.openai.available).toBe(true)
    expect(status.elevenlabs.keyPresent).toBe(false)

    // Verify no secret values leak into the status object
    const statusStr = JSON.stringify(status)
    expect(statusStr).not.toContain('sk-super-secret-key')
  })

  it('reports available=false for provider in cooldown', async () => {
    const quotaError = Object.assign(new Error('429 quota exceeded'), { status: 429 })
    makeOpenAIMock(() => ({
      audio: { speech: { create: vi.fn().mockRejectedValue(quotaError) } },
    }))
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('ELEVENLABS_API_KEY', '')

    const { speakToClient, getTtsProviderStatus } = await import('../tts.js')
    const { send } = makeSend()

    await speakToClient(send as never, 'Trigger quota', undefined)

    const status = getTtsProviderStatus()
    expect(status.openai.available).toBe(false)
    expect(status.openai.disabledUntil).not.toBeNull()
  })
})

// ── Suite 9: OpenAI model env var is respected ────────────────────────────────

describe('TTS — OPENAI_TTS_MODEL env var is passed to OpenAI SDK', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses OPENAI_TTS_MODEL from env instead of hardcoded tts-1', async () => {
    let capturedModel = ''
    makeOpenAIMock(() => ({
      audio: {
        speech: {
          create: vi.fn().mockImplementation(async (params: { model: string }) => {
            capturedModel = params.model
            return {
              body: new ReadableStream({
                start(c: ReadableStreamDefaultController) {
                  c.enqueue(Buffer.from('mp3'))
                  c.close()
                },
              }),
            }
          }),
        },
      },
    }))

    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    vi.stubEnv('OPENAI_TTS_MODEL', 'gpt-4o-mini-tts')

    const { speakToClient } = await import('../tts.js')
    const { send } = makeSend()

    await speakToClient(send as never, 'Hello!', undefined)

    expect(capturedModel).toBe('gpt-4o-mini-tts')
  })
})
