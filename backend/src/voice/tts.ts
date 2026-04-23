import OpenAI from 'openai'
import type { OutboundMessage } from '../ws/message-types.js'

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY ?? ''
const VOICE_ID       = process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM'
const OPENAI_KEY     = process.env.OPENAI_API_KEY ?? ''

// Once ElevenLabs fails with a billing/auth error, skip it for the whole process lifetime
let elevenLabsDisabled = false

export async function speakToClient(
  send: (msg: OutboundMessage) => void,
  text: string,
  signal?: AbortSignal,
): Promise<void> {
  if (ELEVENLABS_KEY && !elevenLabsDisabled) {
    try {
      await speakElevenLabs(send, text, signal)
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
    await speakOpenAI(send, text, signal)
    return
  }

  console.warn('[tts] no TTS provider configured — voice output disabled')
}

// ── ElevenLabs ────────────────────────────────────────────────────────────────

async function speakElevenLabs(
  send: (msg: OutboundMessage) => void,
  text: string,
  signal?: AbortSignal,
): Promise<void> {
  const timeoutCtrl = new AbortController()
  const timeoutRef  = setTimeout(() => timeoutCtrl.abort(), 10_000)
  const combined    = signal
    ? AbortSignal.any([signal, timeoutCtrl.signal])
    : timeoutCtrl.signal

  let response: Response
  try {
    response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
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
        voice:           'nova',   // warm, friendly — good for a teacher
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

  // openai SDK returns a Response-compatible object — stream the body
  const body = (response as unknown as { body: ReadableStream<Uint8Array> | null }).body
  if (!body) return

  const reader = body.getReader()
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
