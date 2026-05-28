import { useState, useRef, useEffect } from 'react'

export type CharacterState = 'listening' | 'speaking' | 'thinking' | 'celebrating'

interface Params {
  isSpeaking:         boolean
  isListening:        boolean
  isThinking:         boolean
  completedStepCount: number
  lessonStarted:      boolean
  phase:              string
}

export interface CharacterVideoState {
  characterState: CharacterState
  danceIndex:     number
  onDanceEnded:   () => void
}

// Derives character avatar state from existing demo lesson signals.
// Priority: celebrating > speaking > thinking > listening.
// Dance rotation: 0→1→2→0 per successful step.
// Mic always interrupts a running dance.
export function useCharacterVideoState({
  isSpeaking,
  isListening,
  isThinking,
  completedStepCount,
  lessonStarted,
  phase,
}: Params): CharacterVideoState {
  const [isCelebrating,         setIsCelebrating]  = useState(false)
  const danceIndexRef          = useRef(0)
  const lastCelebratedCountRef = useRef(0)
  const prevStateRef           = useRef<CharacterState>('listening')

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
  useEffect(() => {
    if (isListening && isCelebrating) {
      console.log('[character_dance_interrupted_by_mic]')
      danceIndexRef.current = (danceIndexRef.current + 1) % 3
      setIsCelebrating(false)
    }
  }, [isListening, isCelebrating])

  const onDanceEnded = () => {
    console.log(`[character_dance_ended] index=${danceIndexRef.current}`)
    danceIndexRef.current = (danceIndexRef.current + 1) % 3
    setIsCelebrating(false)
  }

  // Priority: celebrating > speaking > thinking > listening
  let characterState: CharacterState
  if (isCelebrating)   characterState = 'celebrating'
  else if (isSpeaking) characterState = 'speaking'
  else if (isThinking) characterState = 'thinking'
  else                 characterState = 'listening'

  // Log state transitions (during render, using ref to avoid effect lag)
  if (prevStateRef.current !== characterState) {
    console.log(`[character_state_changed] from=${prevStateRef.current} to=${characterState} reason=derived`)
    prevStateRef.current = characterState
  }

  return { characterState, danceIndex: danceIndexRef.current, onDanceEnded }
}
