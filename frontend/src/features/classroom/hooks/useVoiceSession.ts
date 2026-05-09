import { useState, useCallback, useRef } from 'react'
import type { VoiceState } from '../types'
import type { SendFn } from '../services/classroomSocket'
import {
  requestMicPermission,
  startPCMCapture,
  stopPCMCapture,
  playAudioChunk,
  stopAudioPlayback,
  getScheduledAudioEndMs,
} from '../services/voiceApi'

interface Options { send: SendFn }

export function useVoiceSession({ send }: Options): VoiceState & {
  toggle:           () => Promise<void>
  stopRecording:    () => void
  onAudioChunk:     (base64: string) => void
  onTranscript:     (text: string) => void
  setSpeaking:      (v: boolean) => void
  onTeacherTurnEnd: () => void
} {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking,  setIsSpeaking]  = useState(false)
  const [transcript,  setTranscript]  = useState('')

  const streamRef    = useRef<MediaStream | null>(null)
  const stopSpeakRef = useRef<ReturnType<typeof setTimeout>>()

  const scheduleSpeakOff = useCallback((delayMs: number) => {
    clearTimeout(stopSpeakRef.current)
    stopSpeakRef.current = setTimeout(() => setIsSpeaking(false), delayMs)
  }, [])

  // Stop mic without sending interrupt (used when teacher starts speaking)
  const stopRecording = useCallback(() => {
    if (!streamRef.current) return
    console.log('[paid-lesson] mic_enabled=false reason=teacher_speaking')
    stopPCMCapture(streamRef.current)
    streamRef.current = null
    setIsListening(false)
  }, [])

  // Toggle mic on/off
  const toggle = useCallback(async () => {
    if (isListening) {
      if (streamRef.current) stopPCMCapture(streamRef.current)
      streamRef.current = null
      setIsListening(false)
      send({ type: 'interrupt' })
      return
    }

    // Starting mic: stop any ongoing TTS first
    stopAudioPlayback()
    setIsSpeaking(false)
    clearTimeout(stopSpeakRef.current)

    try {
      const stream = await requestMicPermission()
      streamRef.current = stream
      setIsListening(true)
      setTranscript('')
      console.log('[paid-lesson] mic_enabled=true reason=student_turn')
      startPCMCapture(stream, (base64) => {
        send({ type: 'audio_chunk', data: base64 })
      })
    } catch (err) {
      console.error('[voice] mic access denied:', err)
    }
  }, [isListening, send])

  // Called when backend sends an audio_chunk event (TTS streaming).
  // Use a rolling 2s window while chunks arrive.  onTeacherTurnEnd replaces
  // this with a precise queue-end timer once the backend signals completion.
  const onAudioChunk = useCallback((base64: string) => {
    setIsSpeaking(true)
    scheduleSpeakOff(2000)
    void playAudioChunk(base64)
  }, [scheduleSpeakOff])

  // Called when backend signals all TTS audio has been sent for this teacher turn.
  // We now know no more chunks are coming, so we can schedule isSpeaking=false
  // at the precise moment the audio queue drains — not 1.5s after the last chunk.
  const onTeacherTurnEnd = useCallback(() => {
    const remaining = getScheduledAudioEndMs()
    // 300ms buffer so isSpeaking flips off just after the last word finishes
    scheduleSpeakOff(Math.max(remaining + 300, 500))
  }, [scheduleSpeakOff])

  // Called when backend sends a transcript event (Deepgram STT result)
  const onTranscript = useCallback((text: string) => {
    setTranscript(text)
  }, [])

  // Called by ClassroomLayout when AI starts/stops speaking (ai_text event)
  const setSpeaking = useCallback((v: boolean) => {
    setIsSpeaking(v)
    if (v) {
      // Fallback: if no audio chunks arrive, stop speaking indicator after 8s
      scheduleSpeakOff(8000)
    } else {
      clearTimeout(stopSpeakRef.current)
      stopAudioPlayback()
    }
  }, [scheduleSpeakOff])

  return { isListening, isSpeaking, transcript, toggle, stopRecording, onAudioChunk, onTranscript, setSpeaking, onTeacherTurnEnd }
}
