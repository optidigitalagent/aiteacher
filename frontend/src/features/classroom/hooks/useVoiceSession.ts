import { useState, useCallback, useRef } from 'react'
import type { VoiceState, VoiceTurnState } from '../types'
import type { SendFn } from '../services/classroomSocket'
import {
  requestMicPermission,
  startPCMCapture,
  stopPCMCapture,
  playAudioChunk,
  stopAudioPlayback,
  warmAudioContext,
  getScheduledAudioEndMs,
} from '../services/voiceApi'

interface Options { send: SendFn }

export function useVoiceSession({ send }: Options): VoiceState & {
  toggle:           (beforeCapture?: () => void) => Promise<void>
  stopRecording:    () => void
  onAudioChunk:     (base64: string) => void
  onTranscript:     (text: string) => void
  setSpeaking:      (v: boolean) => void
  onTeacherTurnEnd: () => void
} {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking,  setIsSpeaking]  = useState(false)
  const [transcript,  setTranscript]  = useState('')
  const [voiceTurnState, setVoiceTurnState] = useState<VoiceTurnState>('idle')

  const streamRef        = useRef<MediaStream | null>(null)
  const stopSpeakRef     = useRef<ReturnType<typeof setTimeout>>()
  // Mirrors isSpeaking but readable synchronously in callbacks (avoids stale closure)
  const isSpeakingRef    = useRef(false)

  const scheduleSpeakOff = useCallback((delayMs: number) => {
    clearTimeout(stopSpeakRef.current)
    stopSpeakRef.current = setTimeout(() => {
      isSpeakingRef.current = false
      setIsSpeaking(false)
    }, delayMs)
  }, [])

  // Stop mic without sending interrupt (called when teacher starts speaking or WS disconnects)
  const stopRecording = useCallback(() => {
    if (!streamRef.current) return
    const reason = 'teacher_speaking'
    console.log('[paid-lesson] mic_enabled=false reason=' + reason)
    stopPCMCapture(streamRef.current, reason)
    streamRef.current = null
    setIsListening(false)
    setVoiceTurnState('finalizing_transcript')
  }, [])

  // Toggle mic on/off.
  // Stopping recording does NOT send interrupt — that comes from paidToggle only when
  // the teacher is actively speaking. Sending interrupt on normal stop causes the backend
  // to set interruptPending=true, which then skips TTS for the student's response.
  const toggle = useCallback(async (beforeCapture?: () => void) => {
    if (isListening) {
      if (streamRef.current) stopPCMCapture(streamRef.current, 'mic_stop_toggle')
      streamRef.current = null
      setIsListening(false)
      setVoiceTurnState('finalizing_transcript')
      return
    }

    // Stop current TTS playback first (kills in-flight audio nodes cleanly).
    // THEN warm a fresh AudioContext in the same user-gesture frame so future
    // TTS chunks can resume() without hitting autoplay policy.
    // Also ensure any stale PCM pipeline is destroyed before starting a new one.
    if (streamRef.current) {
      stopPCMCapture(streamRef.current, 'mic_restart')
      streamRef.current = null
    }
    stopAudioPlayback()
    warmAudioContext()
    isSpeakingRef.current = false
    setIsSpeaking(false)
    clearTimeout(stopSpeakRef.current)
    setTranscript('')

    try {
      const stream = await requestMicPermission()
      beforeCapture?.()
      streamRef.current = stream
      setIsListening(true)
      setTranscript('')
      setVoiceTurnState('listening')
      console.log('[paid-lesson] mic_enabled=true reason=student_turn')
      startPCMCapture(stream, (base64) => {
        send({ type: 'audio_chunk', data: base64 })
      })
    } catch (err) {
      console.error('[voice] mic access denied:', err)
      setVoiceTurnState('error')
    }
  }, [isListening, send])

  // Called when backend sends an audio_chunk event (TTS streaming).
  // Interrupt gating is handled upstream in ClassroomLayout (interruptSentRef).
  // Here we only ensure speaking state is active — handles the race where audio_chunk
  // arrives before isSpeakingRef is set by the ai_text handler.
  const onAudioChunk = useCallback((base64: string) => {
    if (!isSpeakingRef.current) {
      isSpeakingRef.current = true
      setIsSpeaking(true)
    }
    scheduleSpeakOff(8000)
    void playAudioChunk(base64)
  }, [scheduleSpeakOff])

  // Called when backend signals all TTS audio has been sent for this teacher turn.
  // Schedule isSpeaking=false at the precise moment the audio queue drains.
  const onTeacherTurnEnd = useCallback(() => {
    const remaining = getScheduledAudioEndMs()
    scheduleSpeakOff(Math.max(remaining + 300, 500))
    // Return to idle after teacher finishes — voice turn fully complete
    setTimeout(() => setVoiceTurnState('idle'), Math.max(remaining + 300, 500))
  }, [scheduleSpeakOff])

  // Called when backend sends a transcript event (Deepgram STT result)
  const onTranscript = useCallback((text: string) => {
    setTranscript(text)
    // Any transcript while listening = partial preview
    if (text) {
      setVoiceTurnState((prev) =>
        prev === 'listening' || prev === 'partial_transcribing' ? 'partial_transcribing' : prev
      )
    } else {
      // Empty transcript clears back to listening or idle
      setVoiceTurnState((prev) =>
        prev === 'partial_transcribing' ? 'listening' : prev === 'finalizing_transcript' ? 'idle' : prev
      )
    }
  }, [])

  // Called by ClassroomLayout when AI starts/stops speaking (ai_text event)
  const setSpeaking = useCallback((v: boolean) => {
    isSpeakingRef.current = v
    setIsSpeaking(v)
    if (v) {
      setVoiceTurnState('teacher_speaking')
      // Fallback: if no audio chunks arrive, stop speaking indicator after 8s
      scheduleSpeakOff(8000)
    } else {
      clearTimeout(stopSpeakRef.current)
      stopAudioPlayback()
      setVoiceTurnState('idle')
    }
  }, [scheduleSpeakOff])

  const isPartialTranscript = voiceTurnState === 'partial_transcribing'

  return {
    isListening, isSpeaking, transcript,
    voiceTurnState, isPartialTranscript,
    toggle, stopRecording, onAudioChunk, onTranscript, setSpeaking, onTeacherTurnEnd,
  }
}
