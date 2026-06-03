import OpenAI from 'openai'
import type { OutboundMessage } from '../ws/message-types.js'

const ELEVENLABS_KEY     = process.env.ELEVENLABS_API_KEY ?? ''
const ELEVENLABS_VOICE_DEFAULT = process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM'
const OPENAI_KEY         = process.env.OPENAI_API_KEY ?? ''

// Per-voice ElevenLabs IDs (optional): ELEVENLABS_VOICE_ONYX, _ECHO, _NOVA, _SHIMMER
// If not set, all voices fall back to ELEVENLABS_VOICE_ID.
function resolveElevenLabsVoiceId(voiceId?: string): string {
  if (!voiceId) return ELEVENLABS_VOICE_DEFAULT
  const key = `ELEVENLABS_VOICE_${voiceId.toUpperCase()}`
  return process.env[key] ?? ELEVENLABS_VOICE_DEFAULT
}

// OpenAI accepts these voice names directly — they match our frontend voice IDs.
const OPENAI_VALID_VOICES = new Set(['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'])
type OpenAIVoice = 'alloy' | 'ash' | 'coral' | 'echo' | 'fable' | 'onyx' | 'nova' | 'sage' | 'shimmer'

function resolveOpenAIVoice(voiceId?: string): OpenAIVoice {
  if (voiceId && OPENAI_VALID_VOICES.has(voiceId)) return voiceId as OpenAIVoice
  return 'nova'
}

// AbortSignal.any was added in Node 20.3.0 — polyfill for older Railway builds
function combineSignals(...signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals)
  const ctrl = new AbortController()
  for (const sig of signals) {
    if (sig.aborted) { ctrl.abort(sig.reason); break }
    sig.addEventListener('abort', () => ctrl.abort(sig.reason), { once: true })
  }
  return ctrl.signal
}

// ── TTS result types ──────────────────────────────────────────────────────────

export type TtsFailureReason =
  | 'TTS_PROVIDER_QUOTA'
  | 'TTS_RATE_LIMITED'
  | 'TTS_PROVIDER_UNAVAILABLE'
  | 'TTS_UNKNOWN_ERROR'

export type TtsResult =
  | { ok: true }
  | { ok: false; textOnly: true; reason: TtsFailureReason }

// ── Process-level provider disable flags ─────────────────────────────────────
// Once a provider fails with a quota/billing error the flag is set for the
// remainder of the process lifetime. Prevents retry storms on every turn.

let elevenLabsDisabled = false
let openAiTtsDisabled  = false

// ── Error classification ──────────────────────────────────────────────────────

function classifyTtsError(err: unknown): TtsFailureReason {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  // Check .status on OpenAI SDK APIError objects
  const status = (err as Record<string, unknown>)['status']
  if (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('insufficient_quota')
  ) return 'TTS_PROVIDER_QUOTA'
  if (
    msg.includes('rate_limit') ||
    msg.includes('rate limit') ||
    msg.includes('ratelimit')
  ) return 'TTS_RATE_LIMITED'
  if (
    status === 502 || status === 503 ||
    msg.includes('502') || msg.includes('503') ||
    msg.includes('unavailable')
  ) return 'TTS_PROVIDER_UNAVAILABLE'
  return 'TTS_UNKNOWN_ERROR'
}

function isQuotaOrRateError(err: unknown): boolean {
  const r = classifyTtsError(err)
  return r === 'TTS_PROVIDER_QUOTA' || r === 'TTS_RATE_LIMITED'
}

function isBillingOrAuthError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  const status = (err as Record<string, unknown>)['status']
  return (
    status === 401 || status === 402 ||
    msg.includes('402') || msg.includes('401') ||
    msg.includes('payment') || msg.includes('invalid_api_key') ||
    msg.includes('billing')
  )
}

// ── Main TTS entry point ──────────────────────────────────────────────────────
//
// Returns TtsResult — never throws. Callers must check result.ok to determine
// whether audio was emitted. On failure the caller should emit voice_unavailable
// and still send teacher_turn_end so the frontend mic lifecycle completes.
//
// Provider cooldown: quota/rate errors set a process-level disable flag so the
// failed provider is not retried on subsequent turns (prevents retry storms).

export async function speakToClient(
  send: (msg: OutboundMessage) => void,
  text: string,
  signal?: AbortSignal,
  voiceId?: string,
): Promise<TtsResult> {
  // ── ElevenLabs ────────────────────────────────────────────────────────────
  if (ELEVENLABS_KEY && !elevenLabsDisabled) {
    try {
      await speakElevenLabs(send, text, signal, resolveElevenLabsVoiceId(voiceId))
      return { ok: true }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return { ok: true }

      if (isBillingOrAuthError(err) || isQuotaOrRateError(err)) {
        const reason = classifyTtsError(err)
        console.warn(`[tts:fallback] ElevenLabs disabled reason=${reason} — falling through to OpenAI`)
        elevenLabsDisabled = true
        // fall through to OpenAI
      } else {
        // Unknown error — log and fall through to OpenAI without permanently disabling
        console.warn('[tts:fallback] ElevenLabs unknown error — trying OpenAI:', err instanceof Error ? err.message : err)
      }
    }
  }

  // ── OpenAI TTS ────────────────────────────────────────────────────────────
  if (OPENAI_KEY && !openAiTtsDisabled) {
    try {
      await speakOpenAI(send, text, signal, resolveOpenAIVoice(voiceId))
      return { ok: true }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return { ok: true }

      const reason = classifyTtsError(err)
      if (reason === 'TTS_PROVIDER_QUOTA' || reason === 'TTS_RATE_LIMITED') {
        console.warn(`[tts:fallback] OpenAI TTS ${reason} — disabling for process lifetime`)
        openAiTtsDisabled = true
      } else {
        console.warn('[tts:fallback] OpenAI TTS error reason=%s:', reason, err instanceof Error ? err.message : err)
      }
      return { ok: false, textOnly: true, reason }
    }
  }

  // ── No provider available ─────────────────────────────────────────────────
  if (!ELEVENLABS_KEY && !OPENAI_KEY) {
    console.warn('[tts] no TTS provider configured — voice output disabled')
  }
  return { ok: false, textOnly: true, reason: 'TTS_PROVIDER_UNAVAILABLE' }
}

// ── ElevenLabs ────────────────────────────────────────────────────────────────

async function speakElevenLabs(
  send: (msg: OutboundMessage) => void,
  text: string,
  signal?: AbortSignal,
  voiceId: string = ELEVENLABS_VOICE_DEFAULT,
): Promise<void> {
  const timeoutCtrl = new AbortController()
  const timeoutRef  = setTimeout(() => timeoutCtrl.abort(), 10_000)
  const combined    = signal
    ? combineSignals(signal, timeoutCtrl.signal)
    : timeoutCtrl.signal

  let response: Response
  try {
    response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        signal: combined,
        headers: {
          'xi-api-key':   ELEVENLABS_KEY,
          'Content-Type': 'application/json',
          'Accept':       'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id:       'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        }),
      },
    )
  } catch (err: unknown) {
    clearTimeout(timeoutRef)
    if (err instanceof Error && err.name === 'AbortError') return
    throw err
  } finally {
    clearTimeout(timeoutRef)
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`[tts] ElevenLabs ${response.status}: ${body}`)
  }

  if (!response.body) return

  const reader = response.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (signal?.aborted) break
      send({ type: 'audio_chunk', data: Buffer.from(value).toString('base64') })
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') return
    throw err
  } finally {
    reader.cancel()
  }
}

// ── OpenAI TTS ────────────────────────────────────────────────────────────────

async function speakOpenAI(
  send: (msg: OutboundMessage) => void,
  text: string,
  signal?: AbortSignal,
  voice: OpenAIVoice = 'nova',
): Promise<void> {
  const client = new OpenAI({ apiKey: OPENAI_KEY })

  const timeoutCtrl = new AbortController()
  const timeoutRef  = setTimeout(() => timeoutCtrl.abort(), 15_000)
  const combinedSignal = signal
    ? combineSignals(signal, timeoutCtrl.signal)
    : timeoutCtrl.signal

  let response: Response
  try {
    const speechResponse = await client.audio.speech.create(
      {
        model:           'tts-1',
        voice,
        input:           text,
        response_format: 'mp3',
      },
      { signal: combinedSignal },
    )
    response = speechResponse as unknown as Response
  } catch (err: unknown) {
    clearTimeout(timeoutRef)
    if (err instanceof Error && err.name === 'AbortError') return
    throw err
  } finally {
    clearTimeout(timeoutRef)
  }

  // openai SDK returns a Response-compatible object — buffer the full MP3 before sending.
  // OpenAI TTS generates the complete audio before streaming, so HTTP chunks are arbitrary
  // network read() boundaries (not logical audio frames). Sending partial MP3 frames causes
  // decoding errors on the client. Buffering gives one clean decodable chunk.
  const body = (response as unknown as { body: ReadableStream<Uint8Array> | null }).body
  if (!body) return

  const reader  = body.getReader()
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (signal?.aborted) break
      chunks.push(value)
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') return
    throw err
  } finally {
    reader.cancel()
  }

  if (chunks.length > 0 && !signal?.aborted) {
    const mp3Buffer = Buffer.concat(chunks.map(c => Buffer.from(c)))
    send({ type: 'audio_chunk', data: mp3Buffer.toString('base64') })
  }
}
