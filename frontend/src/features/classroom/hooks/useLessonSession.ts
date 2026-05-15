import { useState, useCallback, useRef } from 'react'
import type { Exercise, LessonStep } from '../types'
import type { BackendExercise, ExerciseCursor, SendFn } from '../services/classroomSocket'

interface Options { send: SendFn }

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

// Normalize any run of underscores to the 8-underscore blank that ExercisePanel splits on
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

export function useLessonSession({ send }: Options) {
  const [exercise,       setExercise]       = useState<Exercise | null>(null)
  const [exerciseCursor, setExerciseCursor] = useState<ExerciseCursor | null>(null)
  const exerciseIndexRef                    = useRef(0)
  const [pendingId,      setPendingId]      = useState<string | null>(null)
  const [steps,          setSteps]          = useState<LessonStep[]>(PHASE_STEPS)
  const [currentPhase,   setCurrentPhase]   = useState<string>('DIAGNOSTIC')

  const progress = Math.round(
    (steps.filter((s) => s.status === 'done').length / steps.length) * 100,
  )

  // Called by ClassroomLayout when WS 'exercise' event arrives
  const onExercise = useCallback((be: BackendExercise) => {
    exerciseIndexRef.current++
    setExercise(mapExercise(be, exerciseIndexRef.current))
    setPendingId(be.id)
  }, [])

  // Called by ClassroomLayout when WS 'exercise_cursor_updated' event arrives.
  // Phase 2.6: cursor.exerciseId is the authoritative server-assigned ID.
  // pendingId must follow it so submitAnswer never targets a stale exercise.
  const onCursorUpdated = useCallback((cursor: ExerciseCursor) => {
    setExerciseCursor(cursor)
    if (cursor.exerciseId != null) {
      // Authoritative exerciseId present — sync pendingId unconditionally
      setPendingId(cursor.exerciseId)
    } else if (!cursor.currentItem) {
      // No active item and no exerciseId — exercise state has cleared
      setPendingId(null)
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
    // Clear the exercise cursor and pendingId when leaving the EXERCISES phase so stale
    // exercise cards don't remain visible during VOCABULARY, DEEP_THINKING, and WRAP_UP.
    if (from === 'EXERCISES') {
      setExerciseCursor(null)
      setPendingId(null)
    }
  }, [])

  // Called when lesson resumes to restore phase awareness
  const setPhase = useCallback((phase: string) => {
    setCurrentPhase(phase)
  }, [])

  // Submit the current exercise answer.
  // Phase 2.6: requires an authoritative exerciseId from the cursor before submitting.
  // If a structured exercise is active but exerciseId not yet received, block the submit
  // so the AI cannot improvise instead of running the deterministic validator.
  // text_message fallback is only safe in open-chat / speaking context (no exercise loaded).
  const submitAnswer = useCallback(
    (answer: string) => {
      if (pendingId) {
        send({ type: 'exercise_answer', exerciseId: pendingId, answer })
      } else if (exercise !== null) {
        // Structured exercise is visible but cursor exerciseId hasn't arrived yet — block.
        // Sending as text_message here would bypass the validator and let the AI improvise.
        console.warn('[submitAnswer] blocked: structured exercise active but pendingId not yet received from cursor')
      } else {
        // No active exercise (free chat / speaking phase) — text_message is safe
        send({ type: 'text_message', text: answer })
      }
    },
    [pendingId, exercise, send],
  )

  return {
    question: exercise, exerciseCursor, progress, steps,
    submitAnswer, onExercise, onPhaseChange, onCursorUpdated,
    currentPhase, setPhase,
  }
}
