import OpenAI from 'openai'
import type { OutboundMessage } from '../ws/message-types.js'

// ── Provider configuration from env ──────────────────────────────────────────
// Read once at module load. Never log full values — only presence/prefix.

const ELEVENLABS_KEY           = process.env.ELEVENLABS_API_KEY ?? ''
const ELEVENLABS_VOICE_DEFAULT = process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM'
const OPENAI_KEY               = process.env.OPENAI_API_KEY ?? ''
const OPENAI_TTS_MODEL_ENV     = process.env.OPENAI_TTS_MODEL ?? 'tts-1'
const OPENAI_TTS_VOICE_ENV     = process.env.OPENAI_TTS_VOICE ?? 'nova'

// TTS_PROVIDER=elevenlabs | openai | auto (default: auto)
// auto: try ElevenLabs first (if key present), fall back to OpenAI.
// Set TTS_PROVIDER=openai in Railway to force OpenAI and skip ElevenLabs entirely.
type TtsProviderPref = 'elevenlabs' | 'openai' | 'auto'
const TTS_PROVIDER_PREF: TtsProviderPref = (() => {
  const v = (process.env.TTS_PROVIDER ?? 'auto').toLowerCase()
  if (v === 'elevenlabs' || v === 'openai') return v as TtsProviderPref
  return 'auto'
})()

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
  // Priority: explicit voiceId arg → OPENAI_TTS_VOICE env → 'nova'
  if (voiceId && OPENAI_VALID_VOICES.has(voiceId)) return voiceId as OpenAIVoice
  if (OPENAI_VALID_VOICES.has(OPENAI_TTS_VOICE_ENV)) return OPENAI_TTS_VOICE_ENV as OpenAIVoice
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

// ── TTL-based provider cooldown ───────────────────────────────────────────────
// Replaces permanent boolean flags with bounded timestamps.
// After cooldown expires the provider is retried automatically — no process restart needed.
//
// Quota/rate errors  → 15 min  (provider may recover if credits are added)
// Auth/config errors → 6 hours (misconfiguration rarely self-heals quickly)
// Unknown errors     → 15 min  (safe conservative default)

const QUOTA_COOLDOWN_MS = 15 * 60 * 1000       // 15 min
const AUTH_COOLDOWN_MS  = 6  * 60 * 60 * 1000  // 6 hours

let elevenLabsDisabledUntil = 0
let openAiTtsDisabledUntil  = 0

function isElevenLabsAvailable(): boolean { return Date.now() > elevenLabsDisabledUntil }
function isOpenAiAvailable():     boolean { return Date.now() > openAiTtsDisabledUntil }

// ── Provider health status (for diagnostics / health checks) ──────────────────
// Never exposes secret values — only key presence and runtime readiness.

export interface TtsProviderStatus {
  openai: {
    keyPresent:    boolean
    model:         string
    voice:         string
    available:     boolean
    disabledUntil: number | null
  }
  elevenlabs: {
    keyPresent:     boolean
    voiceIdPresent: boolean
    voiceId:        string
    available:      boolean
    disabledUntil:  number | null
  }
  selectedProvider: TtsProviderPref
}

export function getTtsProviderStatus(): TtsProviderStatus {
  const now = Date.now()
  return {
    openai: {
      keyPresent:    OPENAI_KEY.length > 0,
      model:         OPENAI_TTS_MODEL_ENV,
      voice:         OPENAI_TTS_VOICE_ENV,
      available:     OPENAI_KEY.length > 0 && now > openAiTtsDisabledUntil,
      disabledUntil: openAiTtsDisabledUntil > 0 ? openAiTtsDisabledUntil : null,
    },
    elevenlabs: {
      keyPresent:     ELEVENLABS_KEY.length > 0,
      voiceIdPresent: !!process.env.ELEVENLABS_VOICE_ID,
      voiceId:        ELEVENLABS_VOICE_DEFAULT,
      available:      ELEVENLABS_KEY.length > 0 && now > elevenLabsDisabledUntil,
      disabledUntil:  elevenLabsDisabledUntil > 0 ? elevenLabsDisabledUntil : null,
    },
    selectedProvider: TTS_PROVIDER_PREF,
  }
}

// ── Startup diagnostic — fires once at module load ───────────────────────────
// Visible immediately in Railway logs. Never logs actual key values.

console.log('[tts:provider_check]', JSON.stringify({
  selectedProvider:   TTS_PROVIDER_PREF,
  elevenlabs: {
    keyPresent:     ELEVENLABS_KEY.length > 0,
    voiceId:        ELEVENLABS_VOICE_DEFAULT,
    voiceIdFromEnv: !!process.env.ELEVENLABS_VOICE_ID,
  },
  openai: {
    keyPresent: OPENAI_KEY.length > 0,
    model:      OPENAI_TTS_MODEL_ENV,
    voice:      OPENAI_TTS_VOICE_ENV,
  },
}))

// ── Error classification ──────────────────────────────────────────────────────

function classifyTtsError(err: unknown): TtsFailureReason {
  const msg    = (err instanceof Error ? err.message : String(err)).toLowerCase()
  const status = (err as Record<string, unknown>)['status']

  // Quota / billing exhausted (429 + variants)
  if (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('insufficient_quota')
  ) return 'TTS_PROVIDER_QUOTA'

  // Rate limited (separate from quota — may be transient)
  if (
    msg.includes('rate_limit') ||
    msg.includes('rate limit') ||
    msg.includes('ratelimit')
  ) return 'TTS_RATE_LIMITED'

  // Auth / invalid key / payment required (401, 402, 403)
  if (
    status === 401 || status === 402 || status === 403 ||
    msg.includes('invalid_api_key') || msg.includes('unauthorized') ||
    msg.includes('payment') || msg.includes('billing')
  ) return 'TTS_PROVIDER_UNAVAILABLE'

  // Service unavailable (502, 503)
  if (
    status === 502 || status === 503 ||
    msg.includes('502') || msg.includes('503') ||
    msg.includes('unavailable')
  ) return 'TTS_PROVIDER_UNAVAILABLE'

  return 'TTS_UNKNOWN_ERROR'
}

function providerCooldownMs(err: unknown): number {
  const reason = classifyTtsError(err)
  if (reason === 'TTS_PROVIDER_QUOTA' || reason === 'TTS_RATE_LIMITED') return QUOTA_COOLDOWN_MS
  if (reason === 'TTS_PROVIDER_UNAVAILABLE') return AUTH_COOLDOWN_MS
  return QUOTA_COOLDOWN_MS  // TTS_UNKNOWN_ERROR: conservative 15 min
}

// ── Main TTS entry point ──────────────────────────────────────────────────────
//
// Returns TtsResult — never throws. Callers must check result.ok to determine
// whether audio was emitted. On failure the caller should emit voice_unavailable
// and still send teacher_turn_end so the frontend mic lifecycle completes.
//
// Provider selection: controlled by TTS_PROVIDER env var.
// Cooldown: TTL-based — expired providers are retried automatically.

export async function speakToClient(
  send: (msg: OutboundMessage) => void,
  text: string,
  signal?: AbortSignal,
  voiceId?: string,
): Promise<TtsResult> {
  const tryEl  = TTS_PROVIDER_PREF === 'auto' || TTS_PROVIDER_PREF === 'elevenlabs'
  const tryOai = TTS_PROVIDER_PREF === 'auto' || TTS_PROVIDER_PREF === 'openai'

  // ── ElevenLabs ─────────────────────────────────────────────────────────────
  if (tryEl && ELEVENLABS_KEY && isElevenLabsAvailable()) {
    const elVoice = resolveElevenLabsVoiceId(voiceId)
    console.log(`[tts:provider_selected] provider=elevenlabs voiceId=${elVoice}`)
    try {
      await speakElevenLabs(send, text, signal, elVoice)
      return { ok: true }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return { ok: true }

      const reason = classifyTtsError(err)
      const cdMs   = providerCooldownMs(err)
      elevenLabsDisabledUntil = Date.now() + cdMs
      const cdMin  = Math.round(cdMs / 60_000)
      console.warn(
        `[tts:provider_error] provider=elevenlabs reason=${reason} ` +
        `cooldown=${cdMin}min voiceId=${elVoice} ` +
        `msg="${(err instanceof Error ? err.message : String(err)).slice(0, 160)}"`,
      )

      if (tryOai && OPENAI_KEY && isOpenAiAvailable()) {
        console.warn(`[tts:fallback] elevenlabs_failed reason=${reason} — trying openai`)
        // fall through to OpenAI
      } else {
        return { ok: false, textOnly: true, reason }
      }
    }
  }

  // ── OpenAI TTS ─────────────────────────────────────────────────────────────
  if (tryOai && OPENAI_KEY && isOpenAiAvailable()) {
    const voice = resolveOpenAIVoice(voiceId)
    console.log(`[tts:provider_selected] provider=openai model=${OPENAI_TTS_MODEL_ENV} voice=${voice}`)
    try {
      await speakOpenAI(send, text, signal, voice)
      return { ok: true }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return { ok: true }

      const reason = classifyTtsError(err)
      const cdMs   = providerCooldownMs(err)
      openAiTtsDisabledUntil = Date.now() + cdMs
      const cdMin  = Math.round(cdMs / 60_000)
      console.warn(
        `[tts:provider_error] provider=openai reason=${reason} ` +
        `cooldown=${cdMin}min model=${OPENAI_TTS_MODEL_ENV} ` +
        `msg="${(err instanceof Error ? err.message : String(err)).slice(0, 160)}"`,
      )
      console.warn(`[tts:fallback] openai_failed reason=${reason}`)
      return { ok: false, textOnly: true, reason }
    }
  }

  // ── No provider available ───────────────────────────────────────────────────
  const elStatus = !ELEVENLABS_KEY ? 'no_key'
    : isElevenLabsAvailable() ? 'configured_but_skipped'
    : `cooldown_until=${new Date(elevenLabsDisabledUntil).toISOString()}`
  const oaiStatus = !OPENAI_KEY ? 'no_key'
    : isOpenAiAvailable() ? 'configured_but_skipped'
    : `cooldown_until=${new Date(openAiTtsDisabledUntil).toISOString()}`
  console.warn(
    `[tts:fallback] no_provider_available ` +
    `provider_pref=${TTS_PROVIDER_PREF} elevenlabs=${elStatus} openai=${oaiStatus}`,
  )

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
    // Attach HTTP status as a property so classifyTtsError can distinguish
    // 401 (invalid key), 422 (bad voice ID), 429 (quota), 503 (unavailable).
    const httpStatus = response.status
    const statusErr  = new Error(`[tts] ElevenLabs ${httpStatus}: ${body.slice(0, 200)}`)
    ;(statusErr as unknown as Record<string, number>)['status'] = httpStatus
    throw statusErr
  }

  if (!response.body) return

  const reader = response.body.getReader()
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
        model:           OPENAI_TTS_MODEL_ENV,  // configurable via OPENAI_TTS_MODEL env
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
