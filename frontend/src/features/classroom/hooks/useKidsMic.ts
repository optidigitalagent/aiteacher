// Kids mic hook — manages voice capture for the Kids classroom.
// Uses existing voiceApi PCM pipeline (16kHz → base64 → audio_chunk frames).
// Safety: never auto-starts; requires explicit child/parent tap.
// Stops automatically when `enabled` is false (teacher speaking, sending, etc.).

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  requestMicPermission,
  startPCMCapture,
  stopPCMCapture,
} from '../services/voiceApi'
import { sendMessage } from '../services/classroomSocket'

export type KidsMicState =
  | 'idle'         // ready to record, tap to start
  | 'requesting'   // waiting for browser permission dialog
  | 'recording'    // actively capturing and streaming PCM
  | 'blocked'      // permission denied by user
  | 'unavailable'  // getUserMedia API not present (old browser/iOS WebView)

interface UseKidsMicOptions {
  // Direct WebSocket ref — same ref as KidsClassroomPage uses
  wsRef: React.MutableRefObject<WebSocket | null>
  // False while teacher is speaking, lesson is sending, or WS is not in 'listening' state.
  // Hook stops an active recording immediately when this becomes false.
  enabled: boolean
}

export interface UseKidsMicResult {
  micState: KidsMicState
  startRecording: () => Promise<void>
  stopRecording: (reason?: string) => void
  // true when the device/browser supports mic (show mic button)
  available: boolean
}

export function useKidsMic({ wsRef, enabled }: UseKidsMicOptions): UseKidsMicResult {
  const [micState, setMicState] = useState<KidsMicState>(() =>
    typeof navigator !== 'undefined' && !!navigator.mediaDevices
      ? 'idle'
      : 'unavailable',
  )

  const streamRef      = useRef<MediaStream | null>(null)
  const isActiveRef    = useRef(false)  // sync flag mirrors micState === 'recording'

  const stopRecording = useCallback((reason = 'stop') => {
    if (!isActiveRef.current) return
    isActiveRef.current = false
    sendMessage(wsRef.current, { type: 'mic_stop' })
    if (streamRef.current) {
      stopPCMCapture(streamRef.current, reason)
      streamRef.current = null
    }
    setMicState('idle')
  }, [wsRef])

  const startRecording = useCallback(async () => {
    if (!enabled || isActiveRef.current) return
    if (micState === 'blocked' || micState === 'unavailable' || micState === 'requesting') return

    setMicState('requesting')

    let stream: MediaStream
    try {
      stream = await requestMicPermission()
    } catch (err) {
      const name = err instanceof Error ? err.name : String(err)
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setMicState('blocked')
      } else {
        // Device error or abort — fall back to idle so user can retry
        setMicState(
          typeof navigator !== 'undefined' && !!navigator.mediaDevices
            ? 'idle'
            : 'unavailable',
        )
      }
      return
    }

    streamRef.current = stream
    isActiveRef.current = true
    sendMessage(wsRef.current, { type: 'mic_start' })
    setMicState('recording')

    startPCMCapture(stream, (base64) => {
      sendMessage(wsRef.current, { type: 'audio_chunk', data: base64 })
    })
  }, [enabled, micState, wsRef])

  // Stop recording when the lesson state disables input (teacher speaking, etc.)
  useEffect(() => {
    if (!enabled && isActiveRef.current) {
      stopRecording('teacher_speaking')
    }
  }, [enabled, stopRecording])

  // Hard cleanup on unmount (route leave, page close)
  useEffect(() => {
    return () => {
      if (isActiveRef.current) {
        stopRecording('unmount')
      }
    }
  }, [stopRecording])

  return {
    micState,
    startRecording,
    stopRecording,
    available: micState !== 'unavailable',
  }
}
