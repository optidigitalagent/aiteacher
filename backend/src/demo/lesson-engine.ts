import {
  TOPIC_PACKS,
  TEACHER_TONES,
  GRAMMAR_PACKS,
  CONFIDENCE_INTROS,
  MISSION_INTROS,
} from './script-data.js'

export interface DemoSession {
  id: string
  user_id: string
  lesson_mood: string
  interest_area: string
  teacher_style: string
  speaking_confidence: string
  demo_mission: string
  status: string
  current_step: string
  step_index: number
  answers: Record<string, string>
  scores: Record<string, ScoreRecord>
  final_result: FinalResult | null
  ai_calls_used: number
  started_lesson_at: string | null
  completed_at: string | null
}

export interface ScoreRecord {
  correct?: boolean
  score?: number
  feedback?: string
  correction?: string
  skipped?: boolean
}

export interface FinalResult {
  level: string
  score: number
  strengths: string[]
  areas_to_improve: string[]
  teacher_message: string
}

export type StepType = 'text_input' | 'mcq'

export interface StepContent {
  key: string
  index: number
  type: StepType
  teacherMessages: Array<{ text: string; delay: number }>
  prompt?: string
  placeholder?: string
  minLength: number
  maxRetries: number
  options?: string[]
  // correctIndex intentionally omitted — server-only
}

export interface IntroContent {
  messages: Array<{ text: string; delay: number }>
}

const TOTAL_STEPS = 4

export function getTotalSteps(): number {
  return TOTAL_STEPS
}

export function buildIntro(session: DemoSession): IntroContent {
  const tone = TEACHER_TONES[session.teacher_style] ?? TEACHER_TONES['friendly_coach']!
  const confidenceNote = CONFIDENCE_INTROS[session.speaking_confidence] ?? ''
  const missionNote = MISSION_INTROS[session.demo_mission] ?? ''

  return {
    messages: [
      { text: tone.greeting, delay: 0 },
      { text: missionNote, delay: 1200 },
      { text: confidenceNote, delay: 2200 },
      { text: "Let's start with a quick introduction.", delay: 3000 },
    ],
  }
}

export function buildStep(session: DemoSession, stepIndex: number): StepContent | null {
  const topic = TOPIC_PACKS[session.interest_area] ?? TOPIC_PACKS['school_life']!
  const tone = TEACHER_TONES[session.teacher_style] ?? TEACHER_TONES['friendly_coach']!
  const grammar = GRAMMAR_PACKS[session.demo_mission] ?? GRAMMAR_PACKS['real_conversation_mission']!

  switch (stepIndex) {
    case 0: // warm_up
      return {
        key: 'warm_up',
        index: 0,
        type: 'text_input',
        teacherMessages: [
          { text: `I'd love to know a bit more about you first.`, delay: 0 },
          { text: topic.warmUpQuestion, delay: 900 },
        ],
        prompt: topic.warmUpQuestion,
        placeholder: topic.warmUpPlaceholder,
        minLength: 5,
        maxRetries: 2,
      }

    case 1: // grammar_mcq
      return {
        key: 'grammar_mcq',
        index: 1,
        type: 'mcq',
        teacherMessages: [
          { text: tone.transition, delay: 0 },
          { text: `Let's check a grammar point — **${grammar.target}**.`, delay: 800 },
          { text: grammar.explanation, delay: 1600 },
        ],
        prompt: grammar.question,
        options: grammar.options.map((o, i) => `${['A', 'B', 'C', 'D'][i]}) ${o}`),
        minLength: 1,
        maxRetries: 2,
      }

    case 2: // speaking_task
      return {
        key: 'speaking_task',
        index: 2,
        type: 'text_input',
        teacherMessages: [
          { text: tone.encouragement[0] ?? "Good.", delay: 0 },
          { text: "Now I want to hear you speak — or write — more freely.", delay: 900 },
          { text: topic.speakingPrompt, delay: 1700 },
        ],
        prompt: topic.speakingPrompt,
        placeholder: topic.speakingPlaceholder,
        minLength: 10,
        maxRetries: 2,
      }

    case 3: // writing_task
      return {
        key: 'writing_task',
        index: 3,
        type: 'text_input',
        teacherMessages: [
          { text: tone.encouragement[1] ?? "Well done.", delay: 0 },
          { text: "One last task — a bit more writing this time.", delay: 900 },
          { text: topic.writingPrompt, delay: 1700 },
        ],
        prompt: topic.writingPrompt,
        placeholder: topic.writingPlaceholder,
        minLength: 20,
        maxRetries: 2,
      }

    default:
      return null
  }
}

export interface SpamResult {
  spam: boolean
  reason?: string
}

export function checkSpam(answer: string, minLength: number): SpamResult {
  const trimmed = answer.trim()

  if (trimmed.length < minLength) {
    return { spam: true, reason: 'too_short' }
  }

  if (trimmed.length > 500) {
    return { spam: true, reason: 'too_long' }
  }

  // Repeated character check: e.g. "aaaaaaa", "........."
  if (/^(.)\1{6,}$/.test(trimmed)) {
    return { spam: true, reason: 'repeated_chars' }
  }

  // Keyboard smash: very high ratio of non-alpha chars
  const alphaCount = (trimmed.match(/[a-zA-Z]/g) ?? []).length
  if (trimmed.length > 10 && alphaCount / trimmed.length < 0.3) {
    return { spam: true, reason: 'low_alpha_ratio' }
  }

  return { spam: false }
}

export function evaluateMcqServerSide(
  session: DemoSession,
  selectedIndex: number,
): { correct: boolean; feedback: string } {
  const grammar = GRAMMAR_PACKS[session.demo_mission] ?? GRAMMAR_PACKS['real_conversation_mission']!

  if (selectedIndex === grammar.correctIndex) {
    return { correct: true, feedback: grammar.correctExplanation }
  }
  return { correct: false, feedback: grammar.wrongExplanation }
}

export function buildWarmUpFeedback(session: DemoSession): string {
  const tone = TEACHER_TONES[session.teacher_style] ?? TEACHER_TONES['friendly_coach']!
  return tone.encouragement[Math.floor(Math.random() * tone.encouragement.length)] ?? "Thanks for that!"
}
