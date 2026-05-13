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

// Once ElevenLabs fails with a billing/auth error, skip it for the whole process lifetime
let elevenLabsDisabled = false

export async function speakToClient(
  send: (msg: OutboundMessage) => void,
  text: string,
  signal?: AbortSignal,
  voiceId?: string,
): Promise<void> {
  if (ELEVENLABS_KEY && !elevenLabsDisabled) {
    try {
      await speakElevenLabs(send, text, signal, resolveElevenLabsVoiceId(voiceId))
      return
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('402') || msg.includes('401') || msg.includes('payment') || msg.includes('invalid_api_key')) {
        console.warn('[tts] ElevenLabs unavailable — switching to OpenAI TTS for this session')
        elevenLabsDisabled = true
      } else if (err instanceof Error && err.name === 'AbortError') {
        return
      } else {
        throw err
      }
    }
  }

  if (OPENAI_KEY) {
    await speakOpenAI(send, text, signal, resolveOpenAIVoice(voiceId))
    return
  }

  console.warn('[tts] no TTS provider configured — voice output disabled')
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
    ? AbortSignal.any([signal, timeoutCtrl.signal])
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
  const combined    = signal
    ? AbortSignal.any([signal, timeoutCtrl.signal])
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
      { signal: combined },
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
    const combined = Buffer.concat(chunks.map(c => Buffer.from(c)))
    send({ type: 'audio_chunk', data: combined.toString('base64') })
  }
}
