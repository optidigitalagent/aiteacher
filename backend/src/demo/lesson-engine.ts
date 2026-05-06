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

// audioMode drives the future static-audio pipeline:
//   'static' — scripted text suitable for pre-recorded audio; use audioKey to look up the asset
//   'tts'    — dynamic AI text; generate live TTS until static assets exist
//   'none'   — do not voice (moderation, help, system messages)
export interface TeacherMessageItem {
  text: string
  delay: number
  audioMode?: 'static' | 'tts' | 'none'
  audioKey?: string
}

export interface StepContent {
  key: string
  index: number
  type: StepType
  teacherMessages: TeacherMessageItem[]
  prompt?: string
  placeholder?: string
  minLength: number
  maxRetries: number
  options?: string[]
  // correctIndex intentionally omitted — server-only
}

export interface IntroContent {
  messages: TeacherMessageItem[]
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
      { text: tone.greeting,    delay: 0,    audioMode: 'static', audioKey: `intro_greeting_${session.teacher_style}` },
      { text: missionNote,      delay: 1600, audioMode: 'static', audioKey: `intro_mission_${session.demo_mission}` },
      { text: confidenceNote,   delay: 3000, audioMode: 'static', audioKey: `intro_confidence_${session.speaking_confidence}` },
      { text: `I saw you're interested in ${topic.label} — I'll use that in today's tasks. It makes the whole thing more real.`, delay: 4400, audioMode: 'static', audioKey: `intro_topic_${session.interest_area}` },
      { text: "Let's start.",   delay: 5600, audioMode: 'static', audioKey: 'intro_start' },
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
          { text: `Before we get into the exercises, I want to hear from you.`, delay: 0,    audioMode: 'static', audioKey: 'warm_up_intro' },
          { text: topic.warmUpQuestion,                                          delay: 1100, audioMode: 'static', audioKey: `warm_up_question_${session.interest_area}` },
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
          { text: topic.warmUpFollowUpQuestion, delay: 0, audioMode: 'static', audioKey: `warm_up_followup_${session.interest_area}` },
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
          { text: tone.transition,                                                                       delay: 0,    audioMode: 'static', audioKey: `grammar_transition_${session.teacher_style}` },
          { text: `Quick grammar check — ${grammar.target}. One sentence, four options.`,               delay: 1000, audioMode: 'static', audioKey: `grammar_intro_${session.demo_mission}` },
          { text: grammar.explanation,                                                                   delay: 2000, audioMode: 'static', audioKey: `grammar_explanation_${session.demo_mission}` },
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
          { text: "Now let's hear you actually speak.", delay: 0,    audioMode: 'static', audioKey: 'speaking_transition' },
          { text: topic.speakingPrompt,                 delay: 1100, audioMode: 'static', audioKey: `speaking_prompt_${session.interest_area}` },
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
          { text: topic.speakingFollowUpQuestion, delay: 0, audioMode: 'static', audioKey: `speaking_followup_${session.interest_area}` },
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
          { text: "Last one — this is where I see how you actually think in writing.", delay: 0,    audioMode: 'static', audioKey: 'writing_transition' },
          { text: topic.writingPrompt,                                                 delay: 1200, audioMode: 'static', audioKey: `writing_prompt_${session.interest_area}` },
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
    return `${cap} — that's a start. Give me one full sentence: "I really like ${word} because..." — I want to hear your actual opinion.`
  }

  // School subjects — respond to what the student actually said
  if (/\b(math|maths|mathematic|mathematics|algebra|geometry|calculus|trigonometry)\b/i.test(answer)) {
    if (wordCount >= 8) {
      return "Maths — good choice. The fact that it trains your thinking is exactly right — that's what we'll build on today."
    }
    return "Maths — I'll use that today."
  }
  if (/\b(physics)\b/i.test(answer)) {
    return wordCount >= 8
      ? "Physics — a subject that connects everything. That analytical mindset is useful here."
      : "Physics — got it. Let's go."
  }
  if (/\b(chemistry|biology|science)\b/i.test(answer)) {
    const m = answer.match(/\b(chemistry|biology|science)\b/i)
    const subj = m ? m[0].charAt(0).toUpperCase() + m[0].slice(1) : 'Science'
    return `${subj} — solid. I'll pull from that today.`
  }
  if (/\b(history|geography)\b/i.test(answer)) {
    const m = answer.match(/\b(history|geography)\b/i)
    const subj = m ? m[0].charAt(0).toUpperCase() + m[0].slice(1) : 'That'
    return wordCount >= 8
      ? `${subj} — understanding context is a real skill. Let's use that.`
      : `${subj} — I've got what I need.`
  }
  if (/\b(literature|language|english|writing)\b/i.test(answer)) {
    return "Language — then you already know what it means to think carefully about words. Let's use that."
  }
  if (/\b(art|music|sport|sports|pe|physical)\b/i.test(answer)) {
    const m = answer.match(/\b(art|music|sport|sports|pe|physical)\b/i)
    const subj = m ? m[0].charAt(0).toUpperCase() + m[0].slice(1) : 'That'
    return `${subj} — good. I've got a clear picture. Let's get into the work.`
  }

  // YouTube / creator content — detect before "watching nothing" since both can appear together
  if (/\b(youtube|youtuber|mr\.?\s*beast|pewdiepie|channel|vlog)\b/i.test(answer)) {
    if (/\b(watching\s+nothing|not\s+watching|nothing\s+right\s+now)\b/i.test(answer)) {
      return "MrBeast fan, here for lessons right now — good call. Let's use that."
    }
    return "YouTube — got it. That gives me a lot to work with."
  }

  // Not watching anything right now
  if (/\b(watching\s+nothing|not\s+watching|nothing\s+right\s+now|nothing\s+at\s+the\s+moment)\b/i.test(answer)) {
    return "Nothing right now — fine. Think of the last thing you watched that you genuinely enjoyed. We'll use that."
  }

  // Extract first significant proper noun (show/movie/channel name)
  const stopWords = new Set(['The', 'I', 'A', 'An', 'And', 'But', 'Or', 'So', 'In', 'On', 'At', 'To', 'For', 'Of', 'With', 'Because', 'Right', 'Now', 'My', 'Me', 'We', 'It', 'Its', 'He', 'She', 'They', 'You', 'Your', 'Just', 'Here'])
  const properNouns = words.filter(w => w.length > 2 && /^[A-Z]/.test(w) && !stopWords.has(w))
  if (properNouns.length > 0 && wordCount >= 5) {
    const name = properNouns[0]!
    return `${name} — got it. I've got what I need.`
  }

  const hasPersonal = /\b(i|my|me)\b/i.test(answer)
  if (wordCount >= 12 && hasPersonal) {
    return "Good — I've got a clear picture. Let's get into the exercises."
  }
  if (wordCount >= 6 && hasPersonal) {
    return "Got it — that's enough to start. Let's go."
  }
  return "Okay — let's get started."
}

export function buildFollowUpFeedback(session: DemoSession, answer: string, stepKey: string): string {
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length

  if (wordCount <= 3) {
    return "Tell me a bit more — give me a full sentence with that idea."
  }

  if (stepKey === 'speaking_followup') {
    // School-life topic has completely different content from movies — handle separately
    if (session.interest_area === 'school_life') {
      if (/\b(simple|simply|easy|clearly|explain|show|teach|describe)\b/i.test(answer)) {
        return "That's the right approach — clear, simple language is what actually works when you explain to someone new."
      }
      if (/\b(example|like\s+(when|how)|imagine|picture|think\s+of)\b/i.test(answer)) {
        return "Good — using examples is the most effective way to explain anything. That's real teaching instinct."
      }
      if (/\b(computer|online|internet|app|phone|digital|learn\w*)\b/i.test(answer)) {
        return "Modern context — makes it immediately relatable. That's a smart way to frame it."
      }
      if (wordCount >= 12) {
        return "Clear idea — the way you'd explain it shows you actually understood it yourself."
      }
      // Short but real content — push for one more sentence
      return "Almost there — give me one more sentence: how would you actually put it in words a younger student would understand?"
    }
  }

  if (stepKey === 'speaking_followup') {
    // Special effects — also catch the common "here is/are" error for immediate correction
    if (/\b(special\s+effect|cgi|visual|cinematograph|director)\b/i.test(answer)) {
      if (/\bhere\s+(is|are)\b/i.test(answer)) {
        return "Good observation — and one quick fix: instead of 'here is,' say 'there are good special effects' or 'it has great visual effects.' Same idea, more natural. Good eye for craft."
      }
      return "You're thinking about craft, not just story — that's the mark of a real viewer. What makes the effect work for you — the realism, the scale, something else?"
    }
    // "effect" alone (catches "a good special effect" phrasing)
    if (/\beffect\b/i.test(answer)) {
      if (/\bhere\s+(is|are)\b/i.test(answer)) {
        return "Good — effects are what you notice first. One correction: say 'the effects are great' instead of 'here is good effect.' Try it in a sentence."
      }
      return "Good — effects pull you in immediately. What kind — visual, sound, or something else?"
    }
    if (/\b(acting|performance|actor|actress|character|cast)\b/i.test(answer)) {
      return "The acting — that's what makes or breaks a show. Good call."
    }
    if (/\b(script|writing|dialogue|story|plot|twist)\b/i.test(answer)) {
      return "The writing — that's the hardest thing to fake. Solid answer."
    }
    if (/\b(music|soundtrack|score|sound)\b/i.test(answer)) {
      return "The music — most people don't notice the soundtrack until it's gone. Sharp observation."
    }
    return "Specific answer — exactly the kind of detail that shows you're paying attention."
  }

  // warm_up_followup — acknowledge and model correct English
  const isFragment = /^(because|since|but|and|so)\b/i.test(answer.trim())

  if (/\b(locked\s+in|in\s+the\s+zone|on\s+a\s+grind|grinding|hustl)/i.test(answer)) {
    if (isFragment) {
      return "I understand — 'locked in' means focused. A complete sentence: 'I usually watch alone because I focus better that way.' Got it — let's keep going."
    }
    return "I get it — focused and solo. A natural version: 'I usually watch alone because I stay more concentrated.' Let's keep going."
  }
  if (/\b(alone|by\s+myself|solo|on\s+my\s+own)\b/i.test(answer)) {
    if (isFragment || wordCount < 5) {
      return "Solo — good. A complete sentence: 'I usually watch alone because I pick up more details.' Let's keep going."
    }
    return "Solo viewer — you pick up things groups miss. Makes sense."
  }
  if (/\b(with\s+(someone|a\s+friend|friends|family|my|the))\b/i.test(answer)) {
    return "Social viewing — it changes the whole experience. Let's keep going."
  }
  // If no specific keyword matched, check for substance before accepting
  if (wordCount <= 8) {
    return "I need more than that — give me a full sentence with your actual reason. Try: 'I think it's the topic itself because...' or 'The way it's taught makes sense to me because...'"
  }
  return "Got it. Let's keep going."
}

// Builds the teacher reply when a student asks about grammar or task rules instead of answering.
// Uses the session's grammar pack (rule-based, zero AI cost).
// Returns the explanation + a prompt to return to the current task.
export function buildStudentQuestionResponse(session: DemoSession, stepPrompt: string): string {
  const grammar = GRAMMAR_PACKS[session.demo_mission] ?? GRAMMAR_PACKS['real_conversation_mission']!
  // wrongExplanation explains the rule AND why the correct answer is right — best fit for "why is the answer X"
  const rule = grammar.wrongExplanation.replace(/\*\*/g, '')
  return [
    `Good question.`,
    rule,
    `Now let's return to the task: ${stepPrompt}`,
  ].join('\n')
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
