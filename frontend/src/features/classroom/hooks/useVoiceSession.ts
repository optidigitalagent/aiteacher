import { useState, useCallback, useRef } from 'react'
import type { VoiceState } from '../types'
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

  const streamRef        = useRef<MediaStream | null>(null)
  const stopSpeakRef     = useRef<ReturnType<typeof setTimeout>>()
  // Mirrors isSpeaking but readable synchronously in callbacks (avoids stale closure)
  const isSpeakingRef    = useRef(false)
  // Timestamp of last setSpeaking(true) — used to accept chunks within a 3s grace window
  // even if isSpeakingRef hasn't been set yet (handles TCP ordering edge cases)
  const lastSpeakingOnRef = useRef(0)

  const scheduleSpeakOff = useCallback((delayMs: number) => {
    clearTimeout(stopSpeakRef.current)
    stopSpeakRef.current = setTimeout(() => {
      isSpeakingRef.current = false
      setIsSpeaking(false)
    }, delayMs)
  }, [])

  // Stop mic without sending interrupt (called when teacher starts speaking)
  const stopRecording = useCallback(() => {
    if (!streamRef.current) return
    console.log('[paid-lesson] mic_enabled=false reason=teacher_speaking')
    stopPCMCapture(streamRef.current)
    streamRef.current = null
    setIsListening(false)
  }, [])

  // Toggle mic on/off.
  // Stopping recording does NOT send interrupt — that comes from paidToggle only when
  // the teacher is actively speaking. Sending interrupt on normal stop causes the backend
  // to set interruptPending=true, which then skips TTS for the student's response.
  const toggle = useCallback(async () => {
    if (isListening) {
      if (streamRef.current) stopPCMCapture(streamRef.current)
      streamRef.current = null
      setIsListening(false)
      return
    }

    // Stop current TTS playback first (kills in-flight audio nodes cleanly).
    // THEN warm a fresh AudioContext in the same user-gesture frame so future
    // TTS chunks can resume() without hitting autoplay policy.
    stopAudioPlayback()
    warmAudioContext()
    isSpeakingRef.current = false
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
  // Gate: discard chunks that arrive after interrupt or before teacher turn starts.
  // Grace window: if isSpeakingRef is still false but setSpeaking(true) fired within
  // the last 3s, accept the chunk — handles the edge case where the first audio_chunk
  // arrives in the same event-loop tick as ai_text before the ref synchronises.
  const onAudioChunk = useCallback((base64: string) => {
    if (!isSpeakingRef.current) {
      const msSinceLastTurnStart = Date.now() - lastSpeakingOnRef.current
      if (msSinceLastTurnStart > 3000) {
        console.log('[paid-lesson] audio_chunk_discarded reason=not_speaking')
        return
      }
      // Accept the chunk and recover the ref so subsequent chunks pass normally
      isSpeakingRef.current = true
    }
    // 8s safety window: keeps isSpeaking alive between streaming chunks even if the
    // network has a brief stall. teacher_turn_end will override this with the exact
    // drain time via onTeacherTurnEnd, so we never linger longer than needed.
    scheduleSpeakOff(8000)
    void playAudioChunk(base64)
  }, [scheduleSpeakOff])

  // Called when backend signals all TTS audio has been sent for this teacher turn.
  // Schedule isSpeaking=false at the precise moment the audio queue drains.
  const onTeacherTurnEnd = useCallback(() => {
    const remaining = getScheduledAudioEndMs()
    scheduleSpeakOff(Math.max(remaining + 300, 500))
  }, [scheduleSpeakOff])

  // Called when backend sends a transcript event (Deepgram STT result)
  const onTranscript = useCallback((text: string) => {
    setTranscript(text)
  }, [])

  // Called by ClassroomLayout when AI starts/stops speaking (ai_text event)
  const setSpeaking = useCallback((v: boolean) => {
    isSpeakingRef.current = v
    if (v) lastSpeakingOnRef.current = Date.now()
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
