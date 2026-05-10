import { useState, useCallback, useRef } from 'react'
import type { Exercise, LessonStep } from '../types'
import type { BackendExercise, ExerciseCursor, SendFn } from '../services/classroomSocket'

interface Options { send: SendFn }

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

// Normalize any run of underscores to the 8-underscore blank that ExercisePanel splits on
function normalizeBlank(text: string): string {
  return text.replace(/_{2,}/g, '________')
}

function mapExercise(be: BackendExercise, index: number): Exercise {
  return {
    id:       be.id,
    index:    be.exerciseNumber ?? index,
    total:    8,   // reasonable max; shown as "Exercise N of 8" until lesson ends
    prompt:   be.instruction ?? be.skillFocus ?? 'Complete the exercise.',
    hint:     be.hint,
    sentence: normalizeBlank(be.question),
    answer:   '',  // correct answer not sent by backend; populated after feedback
  }
}

export function useLessonSession({ send }: Options) {
  const [exercise,       setExercise]       = useState<Exercise | null>(null)
  const [exerciseCursor, setExerciseCursor] = useState<ExerciseCursor | null>(null)
  const exerciseIndexRef                    = useRef(0)
  const [pendingId,      setPendingId]      = useState<string | null>(null)
  const [steps,          setSteps]          = useState<LessonStep[]>(PHASE_STEPS)

  const progress = Math.round(
    (steps.filter((s) => s.status === 'done').length / steps.length) * 100,
  )

  // Called by ClassroomLayout when WS 'exercise' event arrives
  const onExercise = useCallback((be: BackendExercise) => {
    exerciseIndexRef.current++
    setExercise(mapExercise(be, exerciseIndexRef.current))
    setPendingId(be.id)
  }, [])

  // Called by ClassroomLayout when WS 'exercise_cursor_updated' event arrives
  const onCursorUpdated = useCallback((cursor: ExerciseCursor) => {
    setExerciseCursor(cursor)
  }, [])

  // Called by ClassroomLayout when WS 'phase_change' event arrives
  const onPhaseChange = useCallback((from: string, to: string) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id === from) return { ...s, status: 'done'   as const }
        if (s.id === to)   return { ...s, status: 'active' as const }
        return s
      }),
    )
  }, [])

  // Submit the current exercise answer (or fall back to text_message)
  const submitAnswer = useCallback(
    (answer: string) => {
      if (pendingId) {
        send({ type: 'exercise_answer', exerciseId: pendingId, answer })
      } else {
        send({ type: 'text_message', text: answer })
      }
    },
    [pendingId, send],
  )

  return { question: exercise, exerciseCursor, progress, steps, submitAnswer, onExercise, onPhaseChange, onCursorUpdated }
}
