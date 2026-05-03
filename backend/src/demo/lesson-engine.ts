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
  abuse_flags: number
  answer_attempts_total: number
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

const TOTAL_STEPS = 6

export function getTotalSteps(): number {
  return TOTAL_STEPS
}

export function buildIntro(session: DemoSession): IntroContent {
  const tone = TEACHER_TONES[session.teacher_style] ?? TEACHER_TONES['friendly_coach']!
  const confidenceNote = CONFIDENCE_INTROS[session.speaking_confidence] ?? ''
  const missionNote = MISSION_INTROS[session.demo_mission] ?? ''
  const topic = TOPIC_PACKS[session.interest_area] ?? TOPIC_PACKS['school_life']!

  return {
    messages: [
      { text: tone.greeting, delay: 0 },
      { text: missionNote, delay: 1600 },
      { text: confidenceNote, delay: 3000 },
      { text: `I saw you're interested in ${topic.label} — I'll use that in today's tasks. It makes the whole thing more real.`, delay: 4400 },
      { text: "Let's start.", delay: 5600 },
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
          { text: `Before we get into the exercises, I want to hear from you.`, delay: 0 },
          { text: topic.warmUpQuestion, delay: 1100 },
        ],
        prompt: topic.warmUpQuestion,
        placeholder: topic.warmUpPlaceholder,
        minLength: 5,
        maxRetries: 2,
      }

    case 1: // warm_up_followup
      return {
        key: 'warm_up_followup',
        index: 1,
        type: 'text_input',
        teacherMessages: [
          { text: "Good — quick follow-up:", delay: 0 },
          { text: topic.warmUpFollowUpQuestion, delay: 900 },
        ],
        prompt: topic.warmUpFollowUpQuestion,
        placeholder: topic.warmUpFollowUpPlaceholder,
        minLength: 5,
        maxRetries: 2,
      }

    case 2: // grammar_mcq
      return {
        key: 'grammar_mcq',
        index: 2,
        type: 'mcq',
        teacherMessages: [
          { text: tone.transition, delay: 0 },
          { text: `Quick grammar check — ${grammar.target}. One sentence, four options.`, delay: 1000 },
          { text: grammar.explanation, delay: 2000 },
        ],
        prompt: grammar.question,
        options: grammar.options.map((o, i) => `${['A', 'B', 'C', 'D'][i]}) ${o}`),
        minLength: 1,
        maxRetries: 2,
      }

    case 3: // speaking_task
      return {
        key: 'speaking_task',
        index: 3,
        type: 'text_input',
        teacherMessages: [
          { text: "Now let's hear you actually speak.", delay: 0 },
          { text: topic.speakingPrompt, delay: 1100 },
        ],
        prompt: topic.speakingPrompt,
        placeholder: topic.speakingPlaceholder,
        minLength: 10,
        maxRetries: 2,
      }

    case 4: // speaking_followup
      return {
        key: 'speaking_followup',
        index: 4,
        type: 'text_input',
        teacherMessages: [
          { text: "One more thing about that:", delay: 0 },
          { text: topic.speakingFollowUpQuestion, delay: 900 },
        ],
        prompt: topic.speakingFollowUpQuestion,
        placeholder: topic.speakingFollowUpPlaceholder,
        minLength: 5,
        maxRetries: 2,
      }

    case 5: // writing_task
      return {
        key: 'writing_task',
        index: 5,
        type: 'text_input',
        teacherMessages: [
          { text: "Last one — this is where I see how you actually think in writing.", delay: 0 },
          { text: topic.writingPrompt, delay: 1200 },
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

export function buildWarmUpFeedback(_session: DemoSession, answer: string): string {
  const words = answer.trim().split(/\s+/).filter(Boolean)
  const wordCount = words.length

  if (wordCount <= 3) {
    const word = answer.trim()
    const cap = word.charAt(0).toUpperCase() + word.slice(1)
    return `${cap} — that's a start. Now give me one full sentence with that idea. For example: "I really like ${word} because..." — that gives me something real to work with.`
  }

  // Neutral acknowledgment — never use scripted encouragement for warm-up
  // since we can't verify quality without AI at this step
  const hasPersonal = /\b(i|my|me)\b/i.test(answer)
  if (wordCount >= 15 && hasPersonal) {
    return "Got it — that gives me a useful picture of where you are."
  }
  return "Okay, I've got something to work with. Let's keep going."
}

export function buildFollowUpFeedback(_session: DemoSession, answer: string, stepKey: string): string {
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length

  if (wordCount <= 3) {
    return "Tell me a bit more — give me a full sentence with that idea."
  }

  if (stepKey === 'speaking_followup') {
    return "Useful — that rounds out your answer. Let's move to the final task now."
  }
  return "Got it — that gives me a better picture. Let's keep going."
}

export function buildConfusedHint(session: DemoSession, stepKey: string, retryCount: number): string {
  const topic = TOPIC_PACKS[session.interest_area] ?? TOPIC_PACKS['school_life']!

  if (retryCount >= 2) {
    const raw =
      stepKey === 'speaking_task'   ? topic.speakingPlaceholder :
      stepKey === 'speaking_followup' ? topic.speakingFollowUpPlaceholder :
      topic.writingPlaceholder
    const example = raw.replace(/^e\.g\.\s*/i, '')
    return `Try something like: "${example}" — just put it in your own words, it doesn't have to be perfect.`
  }

  if (stepKey === 'speaking_task' || stepKey === 'speaking_followup') {
    return `No problem — describe something real from your experience. Start with "I…" and tell me what happened or what you think.`
  }
  if (stepKey === 'writing_task') {
    return `Take your time. Start with one clear idea and add a reason — even 2–3 sentences is a solid start.`
  }
  return `No problem — even one full sentence is fine. Try starting with "I think…" or "In my opinion…"`
}
