import type { ExerciseCard } from '../../../hooks/useLesson'

// FUTURE: replace with live exercise data from backend WebSocket
export const MOCK_EXERCISE: ExerciseCard = {
  id: 'mock-exercise-3',
  exerciseType: 'reconstruction',
  exerciseNumber: 3,
  skillFocus: 'Question Forms',
  instruction: 'Match the questions with the correct answers.',
  difficulty: 0.4,
  question: 'Who first reached the summit of Everest?',
  hint: 'Think about the auxiliary verb in Wh-questions with Past Simple.',
  items: [
    '1. Who first reached the summit of Everest?',
    '2. What did Hillary use to breathe at high altitude?',
    '3. How long did the whole expedition take?',
    '4. Where did they set up their base camp?',
    '5. When did they finally reach the top?',
    '6. Why did earlier expeditions fail?',
  ],
}

export const MOCK_EXERCISE_SIMPLE: ExerciseCard = {
  id: 'mock-exercise-1',
  exerciseType: 'form_transformation',
  exerciseNumber: 4,
  skillFocus: 'Present Simple',
  instruction: 'Complete the sentence with the correct form of the verb.',
  difficulty: 0.25,
  question: 'She ________ (go) to the gym every morning.',
  hint: 'Use the third person singular. Regular verbs add -s or -es in Present Simple.',
}

export const MOCK_EXERCISE_ERROR: ExerciseCard = {
  id: 'mock-exercise-2',
  exerciseType: 'error_correction',
  exerciseNumber: 2,
  skillFocus: 'Irregular Verbs',
  instruction: 'Find and correct the mistake in each sentence.',
  difficulty: 0.55,
  question: 'They rised early and leaved the camp before sunrise.',
  hint: "Both 'rise' and 'leave' are irregular verbs.",
}
