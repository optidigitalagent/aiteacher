import { useState, useRef, useEffect } from 'react'

export type CharacterState = 'listening' | 'speaking' | 'thinking' | 'celebrating'

interface Params {
  audioActuallySpeaking:  boolean  // true only when TTS audio.play() has resolved
  isListening:            boolean
  isThinking:             boolean
  completedStepCount:     number
  lessonStarted:          boolean
  phase:                  string
  onDanceEndedCallback?:  () => void  // Phase 7.13C: notifies dance gate in useDemoSession
}

export interface CharacterVideoState {
  characterState: CharacterState
  danceIndex:     number
  onDanceEnded:   () => void
}

// Derives character avatar state from demo lesson signals.
// Priority: celebrating > audioActuallySpeaking > thinking > listening.
// Speaking video triggers ONLY when real TTS audio has started playing, not on message render.
// Dance rotation: 0→1→2→0 per successful step.
// Mic always interrupts a running dance.
export function useCharacterVideoState({
  audioActuallySpeaking,
  isListening,
  isThinking,
  completedStepCount,
  lessonStarted,
  phase,
  onDanceEndedCallback,
}: Params): CharacterVideoState {
  const [isCelebrating,         setIsCelebrating]  = useState(false)
  const danceIndexRef          = useRef(0)
  const lastCelebratedCountRef = useRef(0)
  const prevStateRef           = useRef<CharacterState>('listening')

  // Phase 7.13C: stable ref for the gate callback — avoids stale closure in handlers.
  const onDanceEndedCallbackRef = useRef(onDanceEndedCallback)
  useEffect(() => { onDanceEndedCallbackRef.current = onDanceEndedCallback }, [onDanceEndedCallback])

  // Fire dance when a new step is accepted (completedStepCount increases).
  // Guard: same count never triggers twice (React StrictMode double-effect safe).
  useEffect(() => {
    if (!lessonStarted) return
    if (phase === 'complete') return
    if (completedStepCount > lastCelebratedCountRef.current) {
      const stepKey = `count:${completedStepCount}`
      console.log(`[character_dance_started] index=${danceIndexRef.current} stepKey=${stepKey}`)
      lastCelebratedCountRef.current = completedStepCount
      setIsCelebrating(true)
    }
  }, [completedStepCount, lessonStarted, phase])

  // Mic always wins — stop dance immediately when recording starts.
  // Phase 7.13C: also resolves dance gate so teacher chain can proceed.
  useEffect(() => {
    if (isListening && isCelebrating) {
      console.log('[character_dance_interrupted_by_mic]')
      danceIndexRef.current = (danceIndexRef.current + 1) % 3
      setIsCelebrating(false)
      onDanceEndedCallbackRef.current?.()
    }
  }, [isListening, isCelebrating])

  // Phase 7.13C: called by CharacterVideoPanel on video ended/error.
  // Resolves dance gate in useDemoSession so next teacher prompt can play.
  const onDanceEnded = () => {
    console.log(`[character_dance_ended] index=${danceIndexRef.current}`)
    danceIndexRef.current = (danceIndexRef.current + 1) % 3
    setIsCelebrating(false)
    onDanceEndedCallbackRef.current?.()
  }

  // Priority: celebrating > audioActuallySpeaking > thinking > listening
  let characterState: CharacterState
  if (isCelebrating)            characterState = 'celebrating'
  else if (audioActuallySpeaking) characterState = 'speaking'
  else if (isThinking)          characterState = 'thinking'
  else                          characterState = 'listening'

  // Log state transitions (during render, using ref to avoid effect lag)
  if (prevStateRef.current !== characterState) {
    console.log(`[character_state_changed] from=${prevStateRef.current} to=${characterState} reason=derived`)
    prevStateRef.current = characterState
  }

  return { characterState, danceIndex: danceIndexRef.current, onDanceEnded }
}
