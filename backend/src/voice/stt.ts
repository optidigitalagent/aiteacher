import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import type { LiveSchema } from '@deepgram/sdk/dist/main/lib/types/TranscriptionSchema.js'
import { type IncomingMessage, type ClientRequest } from 'node:http'

const API_KEY = process.env.DEEPGRAM_API_KEY ?? ''

// How long after speech stops before we fire the transcript.
// 1500ms = student can think for 1.5s mid-answer without triggering AI.
const UTTERANCE_END_MS = 1500

// Kids sessions: tighter window — children say one word and stop.
// 700ms is enough silence to confirm a single spoken word without clipping.
const UTTERANCE_END_MS_KIDS = 700

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

// Kids-specific Deepgram options — identical audio format, tighter silence window.
// Short single-word answers (blue, green, cat) do not need 1.5s of trailing silence.
// vad_events: true is required for UtteranceEnd events to fire (Deepgram API requirement).
export const DEEPGRAM_KIDS_LIVE_OPTIONS: LiveSchema = {
  ...DEEPGRAM_LIVE_OPTIONS,
  utterance_end_ms: UTTERANCE_END_MS_KIDS,
  vad_events:       true,
}

type DgLive = ReturnType<ReturnType<typeof createClient>['listen']['live']>

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

export class DeepgramSTT {
  private conn: DgLive | null = null
  private ready = false
  private queue: Buffer[] = []
  private keepAliveRef:   ReturnType<typeof setInterval> | null = null
  private openTimeoutRef: ReturnType<typeof setTimeout>  | null = null
  // true during intentional close() call — suppresses onConnectionDied callback
  private closing = false

  // Promises waiting for Deepgram Open — resolved true on Open, false on Error/Close/timeout
  private openResolvers: Array<(v: boolean) => void> = []

  // Accumulate final transcript segments until utterance truly ends
  private transcriptBuffer = ''
  // Tracks the last appended is_final segment (normalized) to skip Deepgram duplicates.
  private lastFinalSegmentNorm = ''
  // Resets on clearBuffer() — prevents redundant [stt:audio] first-chunk logs.
  private sentFirst = false

  constructor(
    private onTranscript: (text: string) => void,
    private onInterim?: (text: string) => void,
    options: LiveSchema = DEEPGRAM_LIVE_OPTIONS,
    // Called when connection closes unexpectedly (not via close()). Use for pre-warming.
    private onConnectionDied?: () => void,
  ) {
    if (!API_KEY) {
      console.warn('[stt] DEEPGRAM_API_KEY not set — voice input disabled')
      return
    }

    // [stt:config] — log resolved config (no secrets)
    console.log(JSON.stringify({
      event:            '[stt:config]',
      provider:         'deepgram',
      model:            options.model,
      language:         options.language,
      encoding:         options.encoding,
      sample_rate:      options.sample_rate,
      channels:         options.channels,
      interim_results:  options.interim_results,
      endpointing:      options.endpointing,
      utterance_end_ms: options.utterance_end_ms,
      vad_events:       (options as Record<string, unknown>)['vad_events'] ?? false,
      smart_format:     options.smart_format,
      keyPresent:       true,
    }))

    const conn = createClient(API_KEY).listen.live(options)
    console.log(JSON.stringify({ event: '[stt:lifecycle]', status: 'create' }))
    console.log(JSON.stringify({ event: '[stt:lifecycle]', status: 'connecting' }))

    // If Open doesn't fire within 5s, discard queued audio — prevents infinite queue growth.
    this.openTimeoutRef = setTimeout(() => {
      this.openTimeoutRef = null
      if (!this.ready) {
        const discarded = this.queue.length
        this.queue = []
        console.error(JSON.stringify({
          event: '[stt:lifecycle]', status: 'open_timeout',
          discardedChunks: discarded,
          message: 'Deepgram Open never fired in 5000ms — queue discarded',
        }))
      }
    }, 5000)

    // ── Phase 16G.3 diagnostic: expose Deepgram WebSocket handshake failure ──
    // ws emits 'unexpected-response' for HTTP 401/402/403 upgrade rejections
    // — this is the only event that carries the actual HTTP status + body.
    type DiagWs = {
      on(event: 'unexpected-response', cb: (req: ClientRequest, res: IncomingMessage) => void): void
      on(event: 'close',               cb: (code: number, reason: Buffer) => void): void
      on(event: 'error',               cb: (err: NodeJS.ErrnoException & { response?: IncomingMessage }) => void): void
    }
    const connInternal = conn as unknown as { getWebSocket?: () => unknown; conn?: unknown }
    const rawWsCandidate = connInternal.getWebSocket?.() ?? connInternal.conn ?? null
    // Guard: some Deepgram SDK versions return a non-ws object from getWebSocket()/conn.
    // Check .on is a function before attaching diagnostic hooks to avoid TypeError crash.
    const rawWs: DiagWs | null = (
      rawWsCandidate !== null &&
      rawWsCandidate !== undefined &&
      typeof (rawWsCandidate as { on?: unknown }).on === 'function'
    ) ? (rawWsCandidate as DiagWs) : null
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
    } else if (rawWsCandidate) {
      console.error('[stt:diag] rawWs.on is not a function — Deepgram SDK internal structure changed; skipping diagnostic hooks')
    } else {
      console.error('[stt:diag] could not access underlying WebSocket — getWebSocket() returned null')
    }
    // ── End Phase 16G.3 diagnostic ──

    conn.on(LiveTranscriptionEvents.Open, () => {
      if (this.openTimeoutRef) { clearTimeout(this.openTimeoutRef); this.openTimeoutRef = null }
      const queuedChunks = this.queue.length
      const queuedBytes  = this.queue.reduce((sum, b) => sum + b.byteLength, 0)
      console.log(JSON.stringify({
        event: '[stt:lifecycle]', status: 'open', queuedChunks, queuedBytes,
      }))
      this.ready = true
      const resolvers = this.openResolvers.splice(0)
      for (const fn of resolvers) fn(true)
      const pending = this.queue.splice(0)
      if (pending.length > 0) {
        const flushedBytes = pending.reduce((sum, b) => sum + b.byteLength, 0)
        console.log(JSON.stringify({
          event: '[stt:queue]', status: 'flushed', flushedChunks: pending.length, flushedBytes,
        }))
        for (const buf of pending) {
          try {
            conn.send(toArrayBuffer(buf))
          } catch (err) {
            console.error('[stt] queue flush send error:', err)
          }
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
      const isErr = err instanceof Error
      let detail: string
      if (isErr) {
        detail = `${err.name}: ${err.message}`
      } else if (typeof err === 'object' && err !== null) {
        // Deepgram SDK v3 emits ErrorEvent (browser-compatible WS) as the error arg.
        // ErrorEvent properties (message, error, type) are non-enumerable —
        // JSON.stringify(event) always returns '{}'. Extract them explicitly.
        const e = err as Record<string, unknown>
        const msg   = typeof e['message'] === 'string' ? e['message'] : ''
        const inner = e['error'] instanceof Error ? (e['error'] as Error).message : String(e['error'] ?? '')
        const typ   = typeof e['type']    === 'string' ? e['type']    : ''
        detail = `type=${typ || 'unknown'} msg=${msg || inner || '(no message)'}`
      } else {
        detail = String(err)
      }
      console.error(JSON.stringify({
        event:        '[stt:lifecycle]',
        status:       'error',
        detail,
        wasReady:     this.ready,
        queuedChunks: this.queue.length,
      }))
      if (isErr && err.stack) console.error('[stt:diag] error stack: %s', err.stack)
      // FIX: null conn on error so send() returns fast and future isAlive() is accurate.
      // Close event will follow and also null conn, but doing it here prevents any
      // send() calls between Error and Close from queueing on a dead socket.
      this.ready = false
      if (this.keepAliveRef) { clearInterval(this.keepAliveRef); this.keepAliveRef = null }
      this.conn  = null
      this.queue = []   // discard stale queued audio — this conn is dead
      const errResolvers = this.openResolvers.splice(0)
      for (const fn of errResolvers) fn(false)
    })

    conn.on(LiveTranscriptionEvents.Close, (code: unknown, reason: unknown) => {
      // Deepgram SDK v3 emits CloseEvent as first arg (browser-compatible WS API),
      // not separate (code, reason) integers/Buffers. Extract .code and .reason explicitly.
      let codeStr: string
      let safeReason: string
      if (typeof code === 'object' && code !== null) {
        const ev = code as Record<string, unknown>
        codeStr   = typeof ev['code'] === 'number' ? String(ev['code']) : '(object)'
        const r   = typeof ev['reason'] === 'string' ? ev['reason'] : ''
        safeReason = (r || '(none)').slice(0, 200)
      } else {
        codeStr = String(code ?? '(none)')
        const reasonRaw = reason instanceof Buffer
          ? reason.toString('utf8')
          : (typeof reason === 'string' ? reason : String(reason ?? ''))
        safeReason = (reasonRaw || '(none)').slice(0, 200)
      }
      console.error(JSON.stringify({
        event:          '[stt:lifecycle]',
        status:         'close',
        code:           codeStr,
        reason:         safeReason,
        wasReady:       this.ready,
        wasIntentional: this.closing,
      }))
      const wasIntentional = this.closing
      this.closing = false
      if (this.keepAliveRef)   { clearInterval(this.keepAliveRef);   this.keepAliveRef   = null }
      if (this.openTimeoutRef) { clearTimeout(this.openTimeoutRef);   this.openTimeoutRef = null }
      // FIX: null conn on close so send() returns immediately instead of queueing forever.
      // This ensures isAlive() correctly returns false: conn===null → false.
      this.ready = false
      this.conn  = null
      this.queue = []   // discard stale queued audio — this conn is dead
      const closeResolvers = this.openResolvers.splice(0)
      for (const fn of closeResolvers) fn(false)
      // Notify parent of unexpected close so it can pre-warm the next connection
      // while TTS is playing (before the next mic_start).
      if (!wasIntentional) {
        this.onConnectionDied?.()
      }
    })

    this.conn = conn
  }

  // Max 120 buffered chunks (~30 seconds at 4 chunks/s). Beyond this we drop
  // oldest chunks to prevent unbounded memory growth during slow Deepgram connect.
  private static readonly MAX_QUEUE = 120

  send(base64: string): void {
    if (!this.conn) return   // conn is null (died) — discard silently
    const buf = Buffer.from(base64, 'base64')
    if (this.ready) {
      if (!this.sentFirst) {
        this.sentFirst = true
        console.log(JSON.stringify({ event: '[stt:audio]', status: 'first_chunk_after_open', bytes: buf.byteLength }))
      }
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
      // Log queue state at start and at every 10-chunk milestone (bounded)
      if (this.queue.length === 1 || this.queue.length % 10 === 0) {
        console.log(JSON.stringify({
          event:        '[stt:queue]',
          status:       'buffering',
          queuedChunks: this.queue.length,
          bytes:        buf.byteLength,
        }))
      }
    }
  }

  // Returns true if the Deepgram WebSocket is open and ready to accept audio.
  // Used by mic_start to detect a dead connection before the turn begins.
  isAlive(): boolean {
    return this.conn !== null && this.ready
  }

  clearBuffer(): void {
    this.transcriptBuffer     = ''
    this.lastFinalSegmentNorm = ''
    this.sentFirst            = false   // reset so next turn logs first-chunk again
  }

  // Returns and clears the accumulated is_final buffer so mic_stop can submit
  // immediately without waiting for UtteranceEnd.
  flushBuffer(): string {
    const text                = this.transcriptBuffer.trim()
    this.transcriptBuffer     = ''
    this.lastFinalSegmentNorm = ''
    return text
  }

  // Resolves true when Deepgram Open fires (or immediately if already ready).
  // Resolves false on timeout, Error, or Close before Open.
  // Used by mic_start to gate audio acceptance until the connection is live.
  waitUntilReady(timeoutMs: number): Promise<boolean> {
    if (this.ready) return Promise.resolve(true)
    if (!this.conn) return Promise.resolve(false)
    return new Promise<boolean>((resolve) => {
      let done = false
      const finish = (val: boolean) => {
        if (done) return
        done = true
        clearTimeout(timer)
        const idx = this.openResolvers.indexOf(finish)
        if (idx !== -1) this.openResolvers.splice(idx, 1)
        resolve(val)
      }
      const timer = setTimeout(() => finish(false), timeoutMs)
      this.openResolvers.push(finish)
    })
  }

  close(): void {
    if (!this.conn) return
    this.closing = true   // suppress onConnectionDied — this is an intentional close
    const c = this.conn
    this.conn  = null     // prevent double-close race
    this.ready = false
    this.queue = []       // discard any queued audio — session is ending
    // Drain pending waitUntilReady callers immediately — connection is gone.
    const resolvers = this.openResolvers.splice(0)
    for (const r of resolvers) r(false)
    if (this.openTimeoutRef) { clearTimeout(this.openTimeoutRef);  this.openTimeoutRef = null }
    if (this.keepAliveRef)   { clearInterval(this.keepAliveRef);   this.keepAliveRef   = null }
    this.transcriptBuffer     = ''
    this.lastFinalSegmentNorm = ''
    try { c.finish() } catch (err) {
      console.error('[stt] close error (ignored):', err)
    }
  }
}
