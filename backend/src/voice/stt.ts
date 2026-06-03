import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import type { LiveSchema } from '@deepgram/sdk/dist/main/lib/types/TranscriptionSchema.js'
import { type IncomingMessage, type ClientRequest } from 'node:http'

const API_KEY = process.env.DEEPGRAM_API_KEY ?? ''

// How long after speech stops before we fire the transcript.
// 1500ms = student can think for 1.5s mid-answer without triggering AI.
const UTTERANCE_END_MS = 1500

// Exported for unit tests — change here propagates to test assertions automatically.
// detect_language is a PrerecordedSchema-only field; sending it to the Live API
// causes HTTP 400. Use explicit language=en instead.
export const DEEPGRAM_LIVE_OPTIONS: LiveSchema = {
  model:            'nova-2',
  language:         'en',
  smart_format:     true,
  interim_results:  true,
  endpointing:      300,
  utterance_end_ms: UTTERANCE_END_MS,
  encoding:         'linear16',
  sample_rate:      16000,
  channels:         1,
}

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
  // Tracks the last appended is_final segment (normalized) to skip Deepgram duplicates.
  private lastFinalSegmentNorm = ''

  constructor(
    private onTranscript: (text: string) => void,
    private onInterim?: (text: string) => void,
  ) {
    if (!API_KEY) {
      console.warn('[stt] DEEPGRAM_API_KEY not set — voice input disabled')
      return
    }

    const conn = createClient(API_KEY).listen.live(DEEPGRAM_LIVE_OPTIONS)

    // ── Phase 16G.3 diagnostic: expose Deepgram WebSocket handshake failure ──
    // ws emits 'unexpected-response' for HTTP 401/402/403 upgrade rejections
    // — this is the only event that carries the actual HTTP status + body.
    type DiagWs = {
      on(event: 'unexpected-response', cb: (req: ClientRequest, res: IncomingMessage) => void): void
      on(event: 'close',               cb: (code: number, reason: Buffer) => void): void
      on(event: 'error',               cb: (err: NodeJS.ErrnoException & { response?: IncomingMessage }) => void): void
    }
    const connInternal = conn as unknown as { getWebSocket?: () => DiagWs | null; conn?: DiagWs | null }
    const rawWs: DiagWs | null = connInternal.getWebSocket?.() ?? connInternal.conn ?? null
    if (rawWs) {
      rawWs.on('unexpected-response', (req, res) => {
        console.error('[stt:diag] Deepgram rejected HTTP upgrade — status=%d %s',
          res.statusCode, res.statusMessage)
        // Redact Authorization token before logging request headers
        const reqHeaders = { ...req.getHeaders() }
        if (reqHeaders['authorization']) reqHeaders['authorization'] = 'Token [REDACTED]'
        console.error('[stt:diag] request headers: %j', reqHeaders)
        console.error('[stt:diag] response headers: %j', res.headers)
        let body = ''
        res.on('data', (chunk: Buffer) => { body += chunk.toString('utf8') })
        res.on('end', () => console.error('[stt:diag] response body: %s', body || '(empty)'))
      })
      rawWs.on('close', (code, reason) => {
        console.error('[stt:diag] raw ws close — code=%d reason=%s',
          code, reason?.toString('utf8') || '(none)')
      })
      rawWs.on('error', (err) => {
        console.error('[stt:diag] raw ws error — %s', err.message)
        if (err.response) {
          console.error('[stt:diag] error.response status=%d', err.response.statusCode)
          console.error('[stt:diag] error.response headers: %j', err.response.headers)
        }
      })
    } else {
      console.error('[stt:diag] could not access underlying WebSocket — getWebSocket() returned null')
    }
    // ── End Phase 16G.3 diagnostic ──

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
      const channel      = data['channel'] as Record<string, unknown> | undefined
      const alts         = channel?.['alternatives'] as Array<Record<string, unknown>> | undefined
      const text         = (alts?.[0]?.['transcript'] as string) ?? ''
      const detectedLang = (channel?.['detected_language'] as string | undefined) ?? 'unknown'
      if (!text) return
      if (data['is_final']) {
        console.log(`[demo_stt_language_detected] lang=${detectedLang} chars=${text.length}`)
        // Skip segment if it is identical to the most recently appended segment.
        // Deepgram can emit the same is_final text multiple times for poor audio,
        // which causes "View. View. View." accumulation artifacts.
        // Phase 7.2: use Unicode letter class (\p{L}) so Cyrillic segments are
        // normalised correctly — /[^a-z\s]/g stripped all non-ASCII and broke dedup.
        const segNorm = text.toLowerCase().replace(/[^\p{L}\s]/gu, '').trim()
        if (segNorm && segNorm === this.lastFinalSegmentNorm) {
          // Duplicate is_final — skip but still emit interim so UI stays updated
          this.onInterim?.(this.transcriptBuffer)
          return
        }
        if (segNorm) this.lastFinalSegmentNorm = segNorm
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
      console.error('[stt:diag] LiveTranscriptionEvents.Error raw: %j', err)
      const isErr = err instanceof Error
      const detail = isErr
        ? `${err.name}: ${err.message}`
        : (typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err))
      if (isErr && err.stack) console.error('[stt:diag] error stack: %s', err.stack)
      console.error('[stt] deepgram error:', detail)
    })

    conn.on(LiveTranscriptionEvents.Close, (code: unknown, reason: unknown) => {
      const reasonStr = reason instanceof Buffer
        ? reason.toString('utf8')
        : (typeof reason === 'string' ? reason : JSON.stringify(reason))
      console.error('[stt:diag] LiveTranscriptionEvents.Close — code=%s reason=%s',
        String(code), reasonStr || '(none)')
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
    this.transcriptBuffer        = ''
    this.lastFinalSegmentNorm    = ''
  }

  // Returns and clears the accumulated is_final buffer so mic_stop can submit
  // immediately without waiting for UtteranceEnd.
  flushBuffer(): string {
    const text                   = this.transcriptBuffer.trim()
    this.transcriptBuffer        = ''
    this.lastFinalSegmentNorm    = ''
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
    this.transcriptBuffer     = ''
    this.lastFinalSegmentNorm = ''
    try { c.finish() } catch (err) {
      console.error('[stt] close error (ignored):', err)
    }
  }
}
