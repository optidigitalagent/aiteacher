import { useState, useCallback, useRef } from 'react'
import type { Exercise, LessonStep } from '../types'
import type { BackendExercise, ExerciseCursor, SendFn } from '../services/classroomSocket'

interface Options {
  send:       SendFn
  sessionId?: string   // paid lesson session ID — included in exercise_answer payloads
}

export type { ExerciseCursor }

// Map backend LessonPhase → human label for the section timeline
const PHASE_STEPS: LessonStep[] = [
  { id: 'DIAGNOSTIC',     label: 'Warm up',          status: 'active'   },
  { id: 'CONTEXT_INPUT',  label: 'Reading',           status: 'upcoming' },
  { id: 'RULE_DISCOVERY', label: 'Grammar Discovery', status: 'upcoming' },
  { id: 'EXERCISES',      label: 'Exercises',         status: 'upcoming' },
  { id: 'VOCABULARY',     label: 'Vocabulary',        status: 'upcoming' },
  { id: 'DEEP_THINKING',  label: 'Deep Thinking',     status: 'upcoming' },
  { id: 'WRAP_UP',        label: 'Wrap up',           status: 'upcoming' },
]

function normalizeBlank(text: string): string {
  return text.replace(/_{2,}/g, '________')
}

function mapExercise(be: BackendExercise, index: number): Exercise {
  return {
    id:           be.id,
    index:        be.exerciseNumber ?? index,
    total:        8,
    prompt:       be.instruction ?? be.skillFocus ?? 'Complete the exercise.',
    hint:         be.hint,
    sentence:     normalizeBlank(be.question),
    answer:       '',
    exerciseType: be.exerciseType,
    skillFocus:   be.skillFocus,
    items:        be.items,
  }
}

export function useLessonSession({ send, sessionId }: Options) {
  const [exercise,       setExercise]       = useState<Exercise | null>(null)
  const [exerciseCursor, setExerciseCursor] = useState<ExerciseCursor | null>(null)
  const exerciseIndexRef                    = useRef(0)
  const [pendingId,      setPendingId]      = useState<string | null>(null)
  const [steps,          setSteps]          = useState<LessonStep[]>(PHASE_STEPS)
  const [currentPhase,   setCurrentPhase]   = useState<string>('DIAGNOSTIC')
  const [isRecovering,   setIsRecovering]   = useState(false)

  const progress = Math.round(
    (steps.filter((s) => s.status === 'done').length / steps.length) * 100,
  )

  // Called by ClassroomLayout when WS 'exercise' event arrives (legacy path)
  const onExercise = useCallback((be: BackendExercise) => {
    exerciseIndexRef.current++
    setExercise(mapExercise(be, exerciseIndexRef.current))
    setPendingId(be.id)
  }, [])

  // Called when WS 'exercise_cursor_updated' arrives.
  // exerciseCursor is the primary source of truth for paid lessons.
  // pendingId follows cursor.exerciseId so submitAnswer always targets the live exercise.
  const onCursorUpdated = useCallback((cursor: ExerciseCursor) => {
    setExerciseCursor(cursor)
    if (cursor.exerciseId != null) {
      setPendingId(cursor.exerciseId)
    } else if (!cursor.currentItem) {
      setPendingId(null)
    }
    if (import.meta.env.DEV) {
      console.log('[cursor] updated', {
        exerciseId: cursor.exerciseId,
        exerciseNumber: cursor.exerciseNumber,
        itemIndex: cursor.itemIndex,
        completionState: cursor.completionState,
        expectedInputMode: cursor.expectedInputMode,
      })
    }
  }, [])

  // Called when WS 'lesson_state_snapshot' arrives on reconnect.
  // Replaces any stale cursor/phase state — backend is authoritative.
  const onStateSnapshot = useCallback((cursor: ExerciseCursor, phase: string) => {
    setExerciseCursor(cursor)
    if (cursor.exerciseId != null) setPendingId(cursor.exerciseId)
    setCurrentPhase(phase)
    setIsRecovering(false)
    if (import.meta.env.DEV) {
      console.log('[cursor] reconnect snapshot received', { exerciseId: cursor.exerciseId, phase })
    }
  }, [])

  // Called by ClassroomLayout when WS 'phase_change' event arrives
  const onPhaseChange = useCallback((from: string, to: string) => {
    setCurrentPhase(to)
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id === from) return { ...s, status: 'done'   as const }
        if (s.id === to)   return { ...s, status: 'active' as const }
        return s
      }),
    )
    // Clear exercise cursor and pendingId when leaving EXERCISES phase
    if (from === 'EXERCISES') {
      setExerciseCursor(null)
      setPendingId(null)
    }
  }, [])

  const setPhase = useCallback((phase: string) => {
    setCurrentPhase(phase)
  }, [])

  // Submit the current exercise answer.
  //
  // Priority order for the exercise ID:
  //   1. cursor.exerciseId (engine-authoritative, always preferred)
  //   2. pendingId (set from cursor or from legacy 'exercise' event)
  //
  // If a cursor/exercise is active but no ID has arrived yet, block the submit
  // so the AI cannot improvise instead of running the deterministic validator.
  //
  // Payload includes sessionId, inputMode, and itemIndex when available
  // so the backend engine can route to the correct step.
  const submitAnswer = useCallback(
    (answer: string) => {
      const cursorId = exerciseCursor?.exerciseId ?? pendingId

      if (cursorId) {
        const payload: Record<string, unknown> = {
          type:       'exercise_answer',
          exerciseId: cursorId,
          answer,
        }
        if (sessionId)                              payload.sessionId = sessionId
        if (exerciseCursor?.expectedInputMode)      payload.inputMode = exerciseCursor.expectedInputMode
        if (exerciseCursor?.itemIndex != null)      payload.itemIndex = exerciseCursor.itemIndex

        send(payload)
        if (import.meta.env.DEV) {
          console.log('[cursor] answer submitted', payload)
        }
      } else if (exerciseCursor !== null || exercise !== null) {
        // Exercise is visible but engine ID hasn't arrived yet — block to prevent AI improvisation
        console.warn('[submitAnswer] blocked: exercise/cursor active but exerciseId not yet received from engine')
      } else {
        // No active exercise — safe to send as free-chat text
        send({ type: 'text_message', text: answer })
      }
    },
    [pendingId, exerciseCursor, exercise, sessionId, send],
  )

  return {
    question: exercise, exerciseCursor, progress, steps,
    submitAnswer, onExercise, onPhaseChange, onCursorUpdated,
    currentPhase, setPhase,
    isRecovering, setIsRecovering, onStateSnapshot,
  }
}
