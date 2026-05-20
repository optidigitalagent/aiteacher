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
  prompt?: string
  placeholder?: string
  minLength: number
  maxRetries: number
  options?: string[]
  // correctIndex intentionally omitted — server-only
}

const TOTAL_STEPS = 6

export function getTotalSteps(): number {
  return TOTAL_STEPS
}

// Single AI teacher intro message — greeting + mission context + topic hook.
// Kept under ~320 chars so TTS can speak the whole thing in one call.
export function buildIntroText(session: DemoSession): string {
  const tone = TEACHER_TONES[session.teacher_style] ?? TEACHER_TONES['friendly_coach']!
  const missionNote = MISSION_INTROS[session.demo_mission] ?? ''
  const topic = TOPIC_PACKS[session.interest_area] ?? TOPIC_PACKS['school_life']!
  return [
    tone.greeting,
    missionNote,
    `I saw you're interested in ${topic.label} — I'll use that today. Let's start.`,
  ].filter(Boolean).join(' ')
}

// What the AI teacher says when introducing a step — used for transitions between steps
// and when a session resumes mid-lesson. Returns null only when nextStep is null (end of lesson).
export function buildNextStepIntro(session: DemoSession, nextStep: StepContent | null): string | null {
  if (!nextStep) return null
  const topic = TOPIC_PACKS[session.interest_area] ?? TOPIC_PACKS['school_life']!
  const tone  = TEACHER_TONES[session.teacher_style] ?? TEACHER_TONES['friendly_coach']!
  const grammar = GRAMMAR_PACKS[session.demo_mission] ?? GRAMMAR_PACKS['real_conversation_mission']!

  switch (nextStep.key) {
    case 'warm_up':
      return topic.warmUpQuestion

    case 'warm_up_followup':
      return topic.warmUpFollowUpQuestion

    case 'grammar_mcq':
      return `Quick challenge — ${grammar.target}. Pick the one that sounds right to you.`

    case 'speaking_task':
      return topic.speakingPrompt

    case 'speaking_followup':
      return topic.speakingFollowUpQuestion

    case 'writing_task':
      return `Last one — and this is where it gets interesting. ${topic.writingPrompt}`

    default:
      return nextStep.prompt ?? null
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
    // Short answer accepted (after retry floor in routes.ts) — just acknowledge.
    // warm_up_followup fires immediately after with its own elaboration question,
    // so we must NOT end this message with a question or the student hears two at once.
    const word = answer.trim()
    const cap = word.charAt(0).toUpperCase() + word.slice(1)
    return `${cap} — interesting. I'll use that today.`
  }

  // School subjects — respond to what the student actually said
  if (/\b(math|maths|mathematic|mathematics|algebra|geometry|calculus|trigonometry)\b/i.test(answer)) {
    if (wordCount >= 8) {
      return "Maths — good choice. It trains a kind of thinking that most subjects don't — that's exactly what we'll build on today."
    }
    return "Maths — I'll use that today."
  }
  if (/\b(physics)\b/i.test(answer)) {
    return wordCount >= 8
      ? "Physics is interesting because the more you learn, the more questions you get. That kind of curiosity is useful here."
      : "Physics is interesting — it explains why things work the way they do. Let's use that."
  }
  if (/\b(chemistry|biology|science)\b/i.test(answer)) {
    const m = answer.match(/\b(chemistry|biology|science)\b/i)
    const subj = m ? m[0].charAt(0).toUpperCase() + m[0].slice(1) : 'Science'
    return `${subj} — solid. The way you think about cause and effect there will come up today too.`
  }
  if (/\b(history|geography)\b/i.test(answer)) {
    const m = answer.match(/\b(history|geography)\b/i)
    const subj = m ? m[0].charAt(0).toUpperCase() + m[0].slice(1) : 'That'
    return wordCount >= 8
      ? `${subj} — understanding context is a real skill. We'll use that thinking today.`
      : `${subj} — I've got what I need.`
  }
  if (/\b(literature|language|english|writing)\b/i.test(answer)) {
    return "Language — then you already think carefully about words. That's useful here. Let's go."
  }
  if (/\b(art|music|sport|sports|pe|physical)\b/i.test(answer)) {
    const m = answer.match(/\b(art|music|sport|sports|pe|physical)\b/i)
    const subj = m ? m[0].charAt(0).toUpperCase() + m[0].slice(1) : 'That'
    return `${subj} — interesting. I've got a clear picture. Let's get into the work.`
  }

  // YouTube / creator content — detect before "watching nothing" since both can appear together
  if (/\b(youtube|youtuber|mr\.?\s*beast|pewdiepie|channel|vlog)\b/i.test(answer)) {
    if (/\b(watching\s+nothing|not\s+watching|nothing\s+right\s+now)\b/i.test(answer)) {
      return "MrBeast fan, here for lessons right now — good call. Let's use that."
    }
    return "YouTube — that gives me a lot to work with. Let's go."
  }

  // Not watching anything right now
  if (/\b(watching\s+nothing|not\s+watching|nothing\s+right\s+now|nothing\s+at\s+the\s+moment)\b/i.test(answer)) {
    return "Nothing right now — that's fine. I've got what I need."
  }

  // Extract first significant proper noun (show/movie/channel name)
  const stopWords = new Set(['The', 'I', 'A', 'An', 'And', 'But', 'Or', 'So', 'In', 'On', 'At', 'To', 'For', 'Of', 'With', 'Because', 'Right', 'Now', 'My', 'Me', 'We', 'It', 'Its', 'He', 'She', 'They', 'You', 'Your', 'Just', 'Here'])
  const properNouns = words.filter(w => w.length > 2 && /^[A-Z]/.test(w) && !stopWords.has(w))
  if (properNouns.length > 0 && wordCount >= 5) {
    const name = properNouns[0]!
    return `${name} — interesting. I've got what I need.`
  }

  const hasPersonal = /\b(i|my|me)\b/i.test(answer)
  if (wordCount >= 12 && hasPersonal) {
    return "Good — that gives me something real to work with. Let's get into the exercises."
  }
  if (wordCount >= 6 && hasPersonal) {
    return "Yeah, I can hear that. Let's use it today."
  }
  return "Okay — let's get into it."
}

export function buildFollowUpFeedback(session: DemoSession, answer: string, stepKey: string): string {
  // Polite refusal — don't force elaboration
  if (/\bi\s+don'?t\s+want\s+(?:to\s+)?(?:tell|say|share|talk|explain)\b/i.test(answer)) {
    return "No problem — you don't have to say more. Let's keep going."
  }

  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length

  if (wordCount <= 3) {
    return "Tell me a bit more — one full sentence with that idea."
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
      return "Good — that approach makes sense."
    }
  }

  if (stepKey === 'speaking_followup') {
    // Special effects — also catch the common "here is/are" error for immediate correction
    if (/\b(special\s+effect|cgi|visual|cinematograph|director)\b/i.test(answer)) {
      if (/\bhere\s+(is|are)\b/i.test(answer)) {
        return "Good observation — quick note: say 'there are good special effects' or 'it has great visual effects' instead of 'here is.' Good eye for craft."
      }
      return "You're thinking about craft, not just story — that's the mark of a real viewer."
    }
    // "effect" alone (catches "a good special effect" phrasing)
    if (/\beffect\b/i.test(answer)) {
      if (/\bhere\s+(is|are)\b/i.test(answer)) {
        return "Good — effects are what you notice first. Quick note: 'the effects are great' is more natural than 'here is good effect.'"
      }
      return "Good — effects pull you in. Solid observation."
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
    // Generic followup response — close cleanly (bridge step transitions immediately after)
    const wordCount2 = answer.trim().split(/\s+/).filter(Boolean).length
    if (wordCount2 >= 10) {
      return "Yeah — I can see what you mean. That gives me enough to work with."
    }
    return "Good — I've got what I needed from that."
  }

  // warm_up_followup — acknowledge and model correct English
  const isFragment = /^(because|since|but|and|so)\b/i.test(answer.trim())

  if (/\b(locked\s+in|in\s+the\s+zone|on\s+a\s+grind|grinding|hustl)/i.test(answer)) {
    if (isFragment) {
      return "I understand — 'locked in' means focused. A complete sentence: 'I usually watch alone because I focus better that way.'"
    }
    return "I get it — focused and solo. A natural version: 'I usually watch alone because I stay more concentrated.'"
  }
  if (/\b(alone|by\s+myself|solo|on\s+my\s+own)\b/i.test(answer)) {
    if (isFragment || wordCount < 5) {
      return "Solo — good. A complete sentence: 'I usually watch alone because I pick up more details.'"
    }
    return "Solo viewer — you pick up things groups miss. Makes sense."
  }
  if (/\b(with\s+(someone|a\s+friend|friends|family|my|the))\b/i.test(answer)) {
    return "Social viewing — it changes the whole experience."
  }
  return "Yeah — that makes sense."
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

// Returns a clarification for embedded confusion (student asks "what should I describe").
// More specific than buildConfusedHint — directly rephrases the task in simpler terms.
export function buildTaskClarification(session: DemoSession, stepKey: string, stepPrompt: string): string {
  const topic = TOPIC_PACKS[session.interest_area] ?? TOPIC_PACKS['school_life']!

  if (stepKey === 'speaking_followup') {
    // Student often confused here because they said "I don't have a project" earlier.
    // Rephrase to be about ANY learning moment, not necessarily a formal project.
    return `Let me rephrase — I'm asking: if you had to teach this topic to a younger student, how would you explain it simply? You can imagine it, or use any subject you know something about.`
  }
  if (stepKey === 'speaking_task') {
    const frame = topic.speakingPlaceholder.replace(/^e\.g\.\s*/i, '')
    return `Let me clarify — I'm asking you to describe any moment at ${topic.label.replace('&', 'or')} you actually remember. Something like: "${frame}"`
  }
  if (stepKey === 'writing_task') {
    const frame = topic.writingPlaceholder.replace(/^e\.g\.\s*/i, '')
    return `Let me clarify — write about ${stepPrompt.toLowerCase().slice(0, 60)}... For example: "${frame}"`
  }
  return `Let me clarify — the question is: "${stepPrompt}". Try starting with "I…" and describe something real.`
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
    if (retryCount === 0) {
      return `That's okay — a lot of people need a second with this. It doesn't have to be something big. Just describe any moment you actually remember. Start with "I…"`
    }
    return `No problem — just start with "I…" and describe what happened. Even something small counts.`
  }
  if (stepKey === 'writing_task') {
    return retryCount === 0
      ? `Take your time. Just start with one clear idea — even 2–3 sentences with a reason is a solid start.`
      : `Start with what you actually think. Even a short, simple sentence is better than nothing.`
  }
  return `No problem — even one full sentence is fine. Try starting with "I think…" or "In my opinion…"`
}
