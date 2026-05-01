import type { Exercise, LessonStep, ChatMessage } from './types'

export const MOCK_EXERCISES: Exercise[] = [
  {
    id: 'ex1', index: 4, total: 8,
    prompt: 'Complete the sentence with the correct form of the verb.',
    hint: 'Use Present Simple tense.',
    sentence: 'She ________ (go) to the gym every morning.',
    answer: 'goes',
  },
  {
    id: 'ex2', index: 5, total: 8,
    prompt: 'Fill in the blank with the correct verb form.',
    hint: 'Third person singular needs -s or -es.',
    sentence: 'He ________ (watch) TV every evening.',
    answer: 'watches',
  },
  {
    id: 'ex3', index: 6, total: 8,
    prompt: 'Complete the sentence correctly.',
    hint: 'Negative form uses "doesn\'t".',
    sentence: "She ________ (not/like) spicy food.",
    answer: "doesn't like",
  },
]

export const MOCK_STEPS: LessonStep[] = [
  { id: 's1', label: 'Warm up',              status: 'done'     },
  { id: 's2', label: 'Grammar explanation',  status: 'done'     },
  { id: 's3', label: 'Exercise 1',           status: 'done'     },
  { id: 's4', label: 'Exercise 2',           status: 'active'   },
  { id: 's5', label: 'Exercise 3',           status: 'upcoming' },
  { id: 's6', label: 'Speaking',             status: 'upcoming' },
  { id: 's7', label: 'Summary',              status: 'upcoming' },
]

export const MOCK_MESSAGES: ChatMessage[] = [
  { id: 'm1', sender: 'ai',   text: 'Welcome back, Alex! Ready to continue our lesson?' },
  { id: 'm2', sender: 'user', text: "Yes, let's do it!" },
  { id: 'm3', sender: 'ai',   text: "Great! Let's look at the next exercise." },
  { id: 'm4', sender: 'user', text: "I don't understand this one." },
  { id: 'm5', sender: 'ai',   isTyping: true },
]
