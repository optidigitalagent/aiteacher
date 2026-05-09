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

let captureCtx:      AudioContext | null = null
let captureSource:   MediaStreamAudioSourceNode | null = null
let captureProc:     ScriptProcessorNode | null = null

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
  captureCtx    = new AudioContext({ sampleRate: 16000 })
  captureSource = captureCtx.createMediaStreamSource(stream)
  captureProc   = captureCtx.createScriptProcessor(4096, 1, 1)

  captureProc.onaudioprocess = (ev) => {
    const pcm = ev.inputBuffer.getChannelData(0)
    onChunk(float32ToBase64PCM(pcm))
  }

  // Route through a silent gain node so the mic audio is not played back
  const silence = captureCtx.createGain()
  silence.gain.value = 0
  captureSource.connect(captureProc)
  captureProc.connect(silence)
  silence.connect(captureCtx.destination)
}

export function stopPCMCapture(stream: MediaStream): void {
  captureProc?.disconnect()
  captureSource?.disconnect()
  captureCtx?.close()
  captureProc   = null
  captureSource = null
  captureCtx    = null
  stream.getTracks().forEach((t) => t.stop())
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

/** Returns how many milliseconds of queued audio remain before playback ends. */
export function getScheduledAudioEndMs(): number {
  if (!playCtx || playCtx.state === 'closed') return 0
  const remaining = nextPlayTime - playCtx.currentTime
  return remaining > 0 ? remaining * 1000 : 0
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
