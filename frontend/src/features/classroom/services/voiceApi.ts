// Voice pipeline:
//   MIC → AudioContext (16kHz) → ScriptProcessorNode → PCM Int16 → base64 → WS audio_chunk
//   WS audio_chunk → base64 MP3 → AudioContext.decodeAudioData → scheduled playback

// ── Mic capture ───────────────────────────────────────────────────────────────

export async function requestMicPermission(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  })
}

// Phase 7.9: Mic permission preflight — call synchronously inside Begin Lesson tap.
// Requests getUserMedia, stops tracks immediately (no recording started), and returns
// whether permission was granted. On iOS/Android, initiating this within the same
// gesture as primeAudioContext() ensures the browser prompt appears before first TTS,
// so the user does not need a second interaction to unlock audio.
export async function requestMicPreflight(): Promise<boolean> {
  console.log('[demo_mic_permission_requested]')
  if (!navigator.mediaDevices?.getUserMedia) {
    console.log('[demo_mobile_preflight_failed] reason=api_unavailable')
    return false
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach(t => t.stop())
    console.log('[demo_mic_permission_granted]')
    console.log('[demo_mobile_preflight_success]')
    return true
  } catch (err) {
    const name = err instanceof Error ? err.name : String(err)
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      console.log('[demo_mic_permission_denied]')
    } else {
      console.log(`[demo_mic_permission_denied] reason=${name}`)
    }
    console.log('[demo_mobile_preflight_failed]')
    return false
  }
}

let captureCtx:      AudioContext | null = null
let captureSource:   MediaStreamAudioSourceNode | null = null
let captureProc:     ScriptProcessorNode | null = null
// Hard-gate: set false before disconnecting so in-flight onaudioprocess callbacks
// never send chunks from the destroyed pipeline to the new WebSocket.
let captureActive = false

function float32ToBase64PCM(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  const uint8 = new Uint8Array(int16.buffer)
  let binary = ''
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
  return btoa(binary)
}

export function startPCMCapture(stream: MediaStream, onChunk: (base64: string) => void): void {
  captureActive = true  // mark pipeline live before any events fire
  captureCtx    = new AudioContext({ sampleRate: 16000 })
  captureSource = captureCtx.createMediaStreamSource(stream)
  captureProc   = captureCtx.createScriptProcessor(4096, 1, 1)

  captureProc.onaudioprocess = (ev) => {
    if (!captureActive) {
      // Pipeline was destroyed — block this event from reaching the (possibly new) socket.
      console.log('[audio:pipeline] stale_chunk_blocked')
      return
    }
    const pcm = ev.inputBuffer.getChannelData(0)
    onChunk(float32ToBase64PCM(pcm))
  }

  // Route through a silent gain node so the mic audio is not played back
  const silence = captureCtx.createGain()
  silence.gain.value = 0
  captureSource.connect(captureProc)
  captureProc.connect(silence)
  silence.connect(captureCtx.destination)
  console.log('[audio:pipeline] created')
}

export function stopPCMCapture(stream: MediaStream, reason = 'stop'): void {
  // Block in-flight onaudioprocess callbacks BEFORE disconnecting nodes.
  // AudioContext.close() is async; without this flag, events fire after we return.
  captureActive = false
  captureProc?.disconnect()
  captureSource?.disconnect()
  captureCtx?.close()
  captureProc   = null
  captureSource = null
  captureCtx    = null
  stream.getTracks().forEach((t) => t.stop())
  console.log(`[audio:pipeline] destroyed reason=${reason}`)
}

// ── TTS playback ──────────────────────────────────────────────────────────────

let playCtx:      AudioContext | null = null
let nextPlayTime  = 0

function getPlayCtx(): AudioContext {
  if (!playCtx || playCtx.state === 'closed') {
    playCtx      = new AudioContext()
    nextPlayTime = 0
  }
  return playCtx
}

// strict=true: re-throws on decode/resume failures (use for complete MP3 from demo TTS).
// strict=false (default): silently skips decode errors (use for streaming partial MP3 frames).
export async function playAudioChunk(base64: string, strict = false): Promise<void> {
  const ctx = getPlayCtx()
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch (err) {
      if (strict) throw new Error(`audio_resume_failed: autoplay policy — user gesture required`)
      return
    }
    // iOS: resume() may resolve but context stays suspended (autoplay policy silently blocks).
    // Fast-fail here so callers don't wait the full audio duration for an onended that never fires.
    if (ctx.state === 'suspended') {
      if (strict) throw new Error(`audio_context_still_suspended: autoplay policy blocked`)
      return
    }
  }

  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0))
  } catch (err) {
    if (strict) throw new Error(`audio_decode_failed: ${err instanceof Error ? err.message : 'unknown'}`)
    return  // Partial MP3 frame from streaming — skip gracefully
  }

  const source = ctx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(ctx.destination)

  const now = ctx.currentTime
  if (nextPlayTime < now) nextPlayTime = now
  const startAt = nextPlayTime
  source.start(startAt)
  nextPlayTime += audioBuffer.duration

  if (strict) {
    // Wait for the audio to actually finish playing before returning.
    // Without this, await handlePlayAudio() resolved the moment audio was *scheduled*,
    // so the next playMessages() call fired stopAudioPlayback() while speech was
    // still in progress — killing every AI acknowledgement and correction mid-sentence.
    const capturedCtx = ctx
    const delayMs = Math.max(0, (startAt - capturedCtx.currentTime) * 1000) + audioBuffer.duration * 1000
    await new Promise<void>((resolve) => {
      let done = false
      const settle = () => {
        if (done) return
        done = true
        clearTimeout(timer)
        capturedCtx.removeEventListener('statechange', onStateChange as EventListener)
        resolve()
      }
      // Fallback: resolve after expected duration + generous buffer for device jitter
      const timer = setTimeout(settle, delayMs + 600)
      // Normal completion
      source.onended = settle
      // stopAudioPlayback() closes the context — detect and resolve so callers don't hang
      const onStateChange = () => { if (capturedCtx.state === 'closed') settle() }
      capturedCtx.addEventListener('statechange', onStateChange as EventListener)
    })
  }
}

export function stopAudioPlayback(): void {
  nextPlayTime = 0
  if (playCtx) {
    playCtx.close()
    playCtx = null
  }
}

// Call this synchronously inside a user gesture (Begin Lesson, mic toggle) to
// ensure the AudioContext is in 'running' state before async TTS chunks arrive.
// Without this, the context created later in an async WS callback may be
// suspended (autoplay policy) and playAudioChunk(strict=false) silently fails.
export function warmAudioContext(): void {
  const ctx = getPlayCtx()
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {})
  }
}

// Phase 7.8: stronger mobile audio unlock — plays a real silent buffer synchronously
// within the user gesture AND awaits resume(), then reports success/failure.
//
// Why this over warmAudioContext():
//   iOS Safari requires actual audio playback (not only resume()) to permanently lift
//   the autoplay restriction. Scheduling a silent 1-sample buffer synchronously inside
//   the gesture activates the context; the subsequent resume() call confirms it running.
//   Without the silent buffer, resume() may resolve but ctx.state remains 'suspended',
//   causing every async TTS call to silently fail until the user taps again.
//
// Usage: call synchronously in the user-gesture handler; pass the returned Promise to
// startLesson() so it can await the result before scheduling TTS.
export async function primeAudioContext(): Promise<boolean> {
  console.log('[demo_audio_prime_started]')
  try {
    const ctx = getPlayCtx()

    // Schedule a 1-sample silent buffer synchronously — this is the iOS unlock trigger.
    // Must happen before any await so the browser gesture-context is still active.
    const silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate)
    const src = ctx.createBufferSource()
    src.buffer = silentBuf
    src.connect(ctx.destination)
    src.start(0)

    // Resume in case the context is still suspended after the silent play.
    if (ctx.state !== 'running') {
      try { await ctx.resume() } catch { /* non-fatal: silent buffer may have already unlocked */ }
    }

    const success = ctx.state === 'running'
    console.log(success ? '[demo_audio_prime_success]' : `[demo_audio_prime_failed] state=${ctx.state}`)
    return success
  } catch (err) {
    console.log(`[demo_audio_prime_failed] error=${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

/** Returns how many milliseconds of queued audio remain before playback ends. */
export function getScheduledAudioEndMs(): number {
  if (!playCtx || playCtx.state === 'closed') return 0
  const remaining = nextPlayTime - playCtx.currentTime
  return remaining > 0 ? remaining * 1000 : 0
}

// ── Demo TTS: HTMLAudioElement playback ───────────────────────────────────────
// Used for demo mode only. Replaces WebAudio decode/schedule to avoid the iOS
// AudioContext ↔ SpeechRecognition audio-session conflict that caused first-TTS
// cutoff and dead-mic-after-audio symptoms on mobile.

let _htmlAudioEl:      HTMLAudioElement | null = null
let _htmlAudioUrl:     string | null           = null
let _htmlAudioResolve: (() => void) | null     = null

// ── Intro audio: event-gated playback (Phase 7.12C) ──────────────────────────
// Completely separate from the serial queue.
// Promise resolves ONLY on audio.onended / onerror / play() rejection / explicit
// stopIntroAudio() call / maxSafetyMs last-resort timeout — NEVER on a timing
// estimate or queue cap.

let _introAudioEl:      HTMLAudioElement | null              = null
let _introAudioUrl:     string | null                        = null
let _introAudioResolve: (() => void) | null                  = null
let _introAudioTimer:   ReturnType<typeof setTimeout> | null = null

export function stopIntroAudio(): void {
  if (_introAudioTimer) { clearTimeout(_introAudioTimer); _introAudioTimer = null }
  if (_introAudioEl) {
    _introAudioEl.pause()
    _introAudioEl.src     = ''
    _introAudioEl.onended = null
    _introAudioEl.onerror = null
    _introAudioEl         = null
  }
  if (_introAudioUrl) { URL.revokeObjectURL(_introAudioUrl); _introAudioUrl = null }
  const res = _introAudioResolve
  _introAudioResolve = null
  if (res) res()   // unblock any awaiting caller
}

export async function playTeacherAudioAndWaitForRealEnd(
  base64:  string,
  opts:    { jobId: string; maxSafetyMs: number; onStart?: () => void },
): Promise<void> {
  const { jobId, maxSafetyMs, onStart } = opts

  stopIntroAudio()   // tear down any previous intro audio before creating new

  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'audio/mpeg' })
  const url  = URL.createObjectURL(blob)
  _introAudioUrl = url

  const audio   = new Audio(url)
  _introAudioEl = audio

  console.log(`[demo_html_audio_created] jobId=${jobId}`)

  return new Promise<void>((resolve) => {
    _introAudioResolve = resolve

    let settled = false
    const settle = (reason: string) => {
      if (settled) return
      settled = true
      if (_introAudioTimer) { clearTimeout(_introAudioTimer); _introAudioTimer = null }
      if (_introAudioEl === audio)  { _introAudioEl = null }
      if (_introAudioResolve === resolve) { _introAudioResolve = null }
      if (_introAudioUrl === url)   { URL.revokeObjectURL(url); _introAudioUrl = null }
      console.log(`[demo_intro_next_message_allowed] jobId=${jobId} reason=${reason}`)
      resolve()
    }

    _introAudioTimer = setTimeout(() => {
      _introAudioTimer = null
      const ct  = isFinite(audio.currentTime) ? audio.currentTime.toFixed(2) : '?'
      const dur = isFinite(audio.duration)    ? audio.duration.toFixed(2)    : '?'
      console.log(`[demo_intro_audio_safety_timeout] jobId=${jobId} currentTime=${ct} duration=${dur}`)
      audio.pause()
      audio.onended = null
      audio.onerror = null
      settle('safety_timeout')
    }, maxSafetyMs)

    audio.onended = () => {
      const ct  = isFinite(audio.currentTime) ? audio.currentTime.toFixed(2) : '?'
      const dur = isFinite(audio.duration)    ? audio.duration.toFixed(2)    : '?'
      console.log(`[demo_intro_audio_real_ended] jobId=${jobId}`)
      console.log(`[demo_html_audio_duration] duration=${dur} jobId=${jobId}`)
      console.log(`[demo_html_audio_current_time_on_end] currentTime=${ct} duration=${dur} jobId=${jobId}`)
      settle('ended')
    }

    audio.onerror = () => {
      const ct = isFinite(audio.currentTime) ? audio.currentTime.toFixed(2) : '?'
      console.log(`[demo_intro_audio_error] jobId=${jobId} currentTime=${ct}`)
      settle('error')
    }

    console.log(`[demo_html_audio_play_started] jobId=${jobId}`)
    audio.play().then(() => {
      onStart?.()
    }).catch((err: unknown) => {
      const name = err instanceof Error ? err.name : String(err)
      console.log(`[demo_html_audio_play_rejected] reason=${name} jobId=${jobId}`)
      settle('play_rejected')
    })
  })
}

export function stopHtmlAudioPlayback(): void {
  if (_htmlAudioEl) {
    _htmlAudioEl.pause()
    _htmlAudioEl.src     = ''
    _htmlAudioEl.onended = null  // clear before calling resolve so events can't double-fire
    _htmlAudioEl.onerror = null
    _htmlAudioEl         = null
  }
  if (_htmlAudioUrl) {
    URL.revokeObjectURL(_htmlAudioUrl)
    _htmlAudioUrl = null
  }
  const res = _htmlAudioResolve
  _htmlAudioResolve = null
  if (res) res()  // resolve any pending play promise so callers never hang
}

// ── Teacher audio serial queue (demo mode) ────────────────────────────────
// Ensures teacher TTS messages never interrupt each other.
// Only mic interruption via clearTeacherAudioQueue() may break the sequence.
// Each job has a hard maxMs cap so the queue never deadlocks.

type _TJob = {
  id:      string
  playFn:  () => Promise<void>
  maxMs:   number
  resolve: () => void
  reject:  (e: Error) => void
  onEnd?:  () => void
}

let _tJobs: _TJob[] = []
let _tBusy           = false

function _tNext(): void {
  if (_tBusy || _tJobs.length === 0) return
  _tBusy = true
  const job = _tJobs.shift()!
  console.log(`[demo_audio_queue_start] id=${job.id}`)

  let settled = false
  let capId: ReturnType<typeof setTimeout> | null = null

  const finish = (err?: Error) => {
    if (settled) return
    settled = true
    if (capId) { clearTimeout(capId); capId = null }
    _tBusy = false
    console.log(`[demo_audio_queue_end] id=${job.id}`)
    job.onEnd?.()
    if (err) { job.reject(err) } else { job.resolve() }
    _tNext()
  }

  capId = setTimeout(() => {
    capId = null
    console.log(`[demo_audio_queue_cap_hit] id=${job.id}`)
    stopHtmlAudioPlayback()
    finish()
  }, job.maxMs)

  job.playFn()
    .then(() => finish())
    .catch((e: unknown) => finish(e instanceof Error ? e : new Error(String(e))))
}

export function enqueueTeacherAudio(
  jobId: string,
  base64: string,
  maxMs: number,
  callbacks?: { onStart?: () => void; onEnd?: () => void },
): Promise<void> {
  const waiting = _tBusy || _tJobs.length > 0
  console.log(`[demo_audio_queue_enqueue] id=${jobId} pending=${_tJobs.length}`)
  if (waiting) console.log('[demo_teacher_audio_waiting_for_previous]')
  return new Promise<void>((resolve, reject) => {
    _tJobs.push({
      id:      jobId,
      playFn:  () => _playBlobQueued(base64, callbacks?.onStart),
      maxMs,
      resolve,
      reject,
      onEnd:   callbacks?.onEnd,
    })
    _tNext()
  })
}

export function clearTeacherAudioQueue(): void {
  const n = _tJobs.length
  console.log(`[demo_audio_queue_cleared] pending=${n}`)
  const jobs = _tJobs.splice(0)
  _tBusy = false
  for (const j of jobs) j.resolve()  // resolve all pending so awaiting callers don't hang
  stopHtmlAudioPlayback()
  stopIntroAudio()   // also unblock any in-progress event-gated intro audio
}

// Internal: plays base64 MP3 via HTMLAudio without stopping current audio.
// Queue guarantees at most one job plays at a time, so no stop-before-play needed.
function _playBlobQueued(base64: string, onStart?: () => void): Promise<void> {
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'audio/mpeg' })
  const url  = URL.createObjectURL(blob)
  _htmlAudioUrl = url
  const audio   = new Audio(url)
  _htmlAudioEl  = audio
  console.log('[demo_html_audio_created]')
  return new Promise<void>((resolve, reject) => {
    _htmlAudioResolve = resolve
    audio.onended = () => {
      console.log('[demo_html_audio_ended]')
      _htmlAudioEl = null; _htmlAudioResolve = null
      URL.revokeObjectURL(url); if (_htmlAudioUrl === url) _htmlAudioUrl = null
      resolve()
    }
    audio.onerror = () => {
      console.log('[demo_html_audio_error]')
      _htmlAudioEl = null; _htmlAudioResolve = null
      URL.revokeObjectURL(url); if (_htmlAudioUrl === url) _htmlAudioUrl = null
      resolve()
    }
    console.log('[demo_html_audio_play_started]')
    audio.play().then(() => {
      onStart?.()
    }).catch((err: unknown) => {
      const name = err instanceof Error ? err.name : String(err)
      console.log(`[demo_html_audio_play_rejected] reason=${name}`)
      _htmlAudioEl = null; _htmlAudioResolve = null
      URL.revokeObjectURL(url); if (_htmlAudioUrl === url) _htmlAudioUrl = null
      if (name === 'NotAllowedError' || name === 'AbortError')
        reject(new Error(`html_audio_play_rejected: ${name}`))
      else
        resolve()
    })
  })
}

// Play a silent 1-frame WAV inline to grant HTMLAudio playback permission
// within the current user gesture, so subsequent async audio.play() calls
// succeed on iOS without NotAllowedError.
export function primeHtmlAudio(): void {
  // Minimal valid WAV: RIFF/WAVE/fmt (PCM 1ch 44100Hz 16bit) + 0-byte data chunk
  const silent = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
  const a = new Audio(silent)
  void a.play().catch(() => {})
}

export async function playAudioBlobWithHtmlAudio(base64: string): Promise<void> {
  stopHtmlAudioPlayback()  // stop any currently playing demo TTS first

  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'audio/mpeg' })
  const url  = URL.createObjectURL(blob)

  _htmlAudioUrl = url
  const audio   = new Audio(url)
  _htmlAudioEl  = audio

  console.log('[demo_html_audio_created]')

  return new Promise<void>((resolve, reject) => {
    _htmlAudioResolve = resolve

    audio.onended = () => {
      console.log('[demo_html_audio_ended]')
      _htmlAudioEl      = null
      _htmlAudioResolve = null
      URL.revokeObjectURL(url)
      if (_htmlAudioUrl === url) _htmlAudioUrl = null
      resolve()
    }

    audio.onerror = () => {
      console.log('[demo_html_audio_error]')
      _htmlAudioEl      = null
      _htmlAudioResolve = null
      URL.revokeObjectURL(url)
      if (_htmlAudioUrl === url) _htmlAudioUrl = null
      resolve()  // resolve (not reject) on load error so lesson continues via text
    }

    console.log('[demo_html_audio_play_started]')
    audio.play().catch((err: unknown) => {
      const name = err instanceof Error ? err.name : String(err)
      console.log(`[demo_html_audio_play_rejected] reason=${name}`)
      _htmlAudioEl      = null
      _htmlAudioResolve = null
      URL.revokeObjectURL(url)
      if (_htmlAudioUrl === url) _htmlAudioUrl = null
      // Rethrow autoplay policy rejections so handlePlayAudio can show the unlock banner.
      // All other errors resolve so the lesson continues via text.
      const isPolicy = name === 'NotAllowedError' || name === 'AbortError'
      if (isPolicy) reject(new Error(`html_audio_play_rejected: ${name}`))
      else          resolve()
    })
  })
}

// ── Static audio (pre-recorded demo files served from /audio/demo/) ──────────

let _staticEl:            HTMLAudioElement | null               = null
let _staticResolve:       (() => void) | null                   = null
// Fallback timer: if onended never fires (browser glitch), force-resolve after duration+buffer
let _staticDurationTimer: ReturnType<typeof setTimeout> | null  = null

export function stopStaticAudio(): void {
  if (_staticDurationTimer) { clearTimeout(_staticDurationTimer); _staticDurationTimer = null }
  if (_staticEl) {
    _staticEl.pause()
    _staticEl.src = ''
    _staticEl.onended = null
    _staticEl.onerror = null
    _staticEl = null
  }
  const res = _staticResolve
  _staticResolve = null
  if (res) res()  // resolve pending promise so callers don't hang
}

export function isStaticAudioPlaying(): boolean {
  return _staticEl !== null && !_staticEl.paused
}

export function playStaticAudioFile(url: string): Promise<void> {
  stopStaticAudio()      // stop previous static audio + clear any pending timer
  stopAudioPlayback()    // stop TTS so they never overlap

  return new Promise<void>((resolve, reject) => {
    _staticResolve = resolve

    const audio = new Audio(url)
    _staticEl = audio

    // Once we know the duration, arm a fallback timer.
    // If onended is silently dropped (Mobile Safari, memory pressure), this prevents
    // playMessages from hanging and blocking the intro → lesson phase transition.
    audio.addEventListener('loadedmetadata', () => {
      if (_staticDurationTimer) { clearTimeout(_staticDurationTimer); _staticDurationTimer = null }
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        _staticDurationTimer = setTimeout(() => {
          _staticDurationTimer = null
          if (_staticResolve === resolve) {
            _staticEl      = null
            _staticResolve = null
            resolve()
          }
        }, Math.ceil(audio.duration * 1000) + 5000)
      }
    })

    audio.onended = () => {
      if (_staticDurationTimer) { clearTimeout(_staticDurationTimer); _staticDurationTimer = null }
      _staticEl      = null
      _staticResolve = null
      resolve()
    }

    audio.onerror = () => {
      if (_staticDurationTimer) { clearTimeout(_staticDurationTimer); _staticDurationTimer = null }
      _staticEl      = null
      _staticResolve = null
      reject(new Error(`static_audio_load_failed: ${url}`))
    }

    audio.play().catch((err: unknown) => {
      if (_staticDurationTimer) { clearTimeout(_staticDurationTimer); _staticDurationTimer = null }
      _staticEl      = null
      _staticResolve = null
      const autoplay = err instanceof Error && err.name === 'NotAllowedError'
      reject(new Error(autoplay ? 'audio_resume_failed: autoplay policy' : String(err)))
    })
  })
}
