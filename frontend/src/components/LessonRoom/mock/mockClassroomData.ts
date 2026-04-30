// FUTURE: all lesson step data comes from backend section plan via WebSocket

export interface LessonStep {
  id:     string
  label:  string
  done:   boolean
  active: boolean
}

export const MOCK_LESSON_STEPS: LessonStep[] = [
  { id: 'warm-up',    label: 'Warm up',    done: true,  active: false },
  { id: 'grammar',   label: 'Grammar',    done: true,  active: false },
  { id: 'vocab-1',   label: 'Vocabulary', done: true,  active: false },
  { id: 'exercise-1', label: 'Exercise 1', done: false, active: true  },
  { id: 'exercise-2', label: 'Exercise 2', done: false, active: false },
  { id: 'exercise-3', label: 'Exercise 3', done: false, active: false },
  { id: 'vocab-2',   label: 'Vocabulary', done: false, active: false },
  { id: 'speaking',  label: 'Speaking',   done: false, active: false },
]

export const MOCK_PROGRESS_PERCENT = 31

export const MOCK_ENCOURAGEMENT = {
  message: 'Great progress today!',
  sub:     "You're doing really well.",
}
