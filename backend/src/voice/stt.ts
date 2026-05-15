import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'

const API_KEY = process.env.DEEPGRAM_API_KEY ?? ''

// How long after speech stops before we fire the transcript.
// 1500ms = student can think for 1.5s mid-answer without triggering AI.
const UTTERANCE_END_MS = 1500

type DgLive = ReturnType<ReturnType<typeof createClient>['listen']['live']>

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

export class DeepgramSTT {
  private conn: DgLive | null = null
  private ready = false
  private queue: Buffer[] = []
  private keepAliveRef: ReturnType<typeof setInterval> | null = null

  // Accumulate final transcript segments until utterance truly ends
  private transcriptBuffer = ''

  constructor(
    private onTranscript: (text: string) => void,
    private onInterim?: (text: string) => void,
  ) {
    if (!API_KEY) {
      console.warn('[stt] DEEPGRAM_API_KEY not set — voice input disabled')
      return
    }

    const conn = createClient(API_KEY).listen.live({
      model:           'nova-2',
      language:        'en-US',
      smart_format:    true,
      interim_results: true,
      // endpointing controls how fast Deepgram marks is_final — keep it snappy
      endpointing:     300,
      // utterance_end_ms: fires UtteranceEnd event after N ms of silence
      // This is what we use to actually send the transcript to the AI
      utterance_end_ms: UTTERANCE_END_MS,
      encoding:        'linear16',
      sample_rate:     16000,
      channels:        1,
    })

    conn.on(LiveTranscriptionEvents.Open, () => {
      this.ready = true
      const pending = this.queue.splice(0)
      for (const buf of pending) {
        try {
          conn.send(toArrayBuffer(buf))
        } catch (err) {
          console.error('[stt] queue flush send error:', err)
        }
      }
      this.keepAliveRef = setInterval(() => {
        try { conn.keepAlive() } catch (err) {
          console.error('[stt] keepAlive error (ignored):', err)
        }
      }, 8_000)
    })

    // Accumulate is_final segments and forward interim for live display
    conn.on(LiveTranscriptionEvents.Transcript, (data: Record<string, unknown>) => {
      const channel = data['channel'] as Record<string, unknown> | undefined
      const alts    = channel?.['alternatives'] as Array<Record<string, unknown>> | undefined
      const text    = (alts?.[0]?.['transcript'] as string) ?? ''
      if (!text) return
      if (data['is_final']) {
        this.transcriptBuffer += (this.transcriptBuffer ? ' ' : '') + text
        // Emit confirmed accumulated text so frontend input stays updated
        this.onInterim?.(this.transcriptBuffer)
      } else {
        // Interim: show growing transcript (confirmed + current being spoken)
        const preview = this.transcriptBuffer
          ? this.transcriptBuffer + ' ' + text
          : text
        this.onInterim?.(preview)
      }
    })

    // UtteranceEnd fires after UTTERANCE_END_MS ms of silence — safe to send to AI now
    conn.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      const text = this.transcriptBuffer.trim()
      if (text) {
        this.transcriptBuffer = ''
        this.onTranscript(text)
      }
    })

    conn.on(LiveTranscriptionEvents.Error, (err: unknown) => {
      console.error('[stt] deepgram error:', err)
    })

    conn.on(LiveTranscriptionEvents.Close, () => {
      if (this.keepAliveRef) clearInterval(this.keepAliveRef)
      this.ready = false
    })

    this.conn = conn
  }

  // Max 120 buffered chunks (~30 seconds at 4 chunks/s). Beyond this we drop
  // oldest chunks to prevent unbounded memory growth during slow Deepgram connect.
  private static readonly MAX_QUEUE = 120

  send(base64: string): void {
    if (!this.conn) return
    const buf = Buffer.from(base64, 'base64')
    if (this.ready) {
      try {
        this.conn.send(toArrayBuffer(buf))
      } catch (err) {
        console.error('[stt] send error (conn may be closing):', err)
      }
    } else {
      if (this.queue.length >= DeepgramSTT.MAX_QUEUE) {
        this.queue.shift()  // drop oldest to prevent memory growth
      }
      this.queue.push(buf)
    }
  }

  clearBuffer(): void {
    this.transcriptBuffer = ''
  }

  // Returns and clears the accumulated is_final buffer so mic_stop can submit
  // immediately without waiting for UtteranceEnd.
  flushBuffer(): string {
    const text = this.transcriptBuffer.trim()
    this.transcriptBuffer = ''
    return text
  }

  close(): void {
    if (!this.conn) return
    const c = this.conn
    this.conn = null  // prevent double-close race
    if (this.keepAliveRef) {
      clearInterval(this.keepAliveRef)
      this.keepAliveRef = null
    }
    this.transcriptBuffer = ''
    try { c.finish() } catch (err) {
      console.error('[stt] close error (ignored):', err)
    }
  }
}
