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

export async function playAudioChunk(base64: string): Promise<void> {
  try {
    const ctx = getPlayCtx()
    if (ctx.state === 'suspended') await ctx.resume()

    const binary = atob(base64)
    const bytes  = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0))
    const source      = ctx.createBufferSource()
    source.buffer     = audioBuffer
    source.connect(ctx.destination)

    const now = ctx.currentTime
    if (nextPlayTime < now) nextPlayTime = now
    source.start(nextPlayTime)
    nextPlayTime += audioBuffer.duration
  } catch {
    // Partial MP3 frame — skip gracefully
  }
}

export function stopAudioPlayback(): void {
  nextPlayTime = 0
  if (playCtx) {
    playCtx.close()
    playCtx = null
  }
}
