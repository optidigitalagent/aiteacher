// Conversational Teacher Moves — Phase 2D
//
// Deterministic phrase selection for human, curious, emotionally-aware teacher responses.
// Zero AI calls. Zero DB/Redis ops. In-process only.
//
// Design:
//   • Zero extra AI calls
//   • Zero DB/Redis ops
//   • No raw student text stored — phrases selected by index only
//   • Best-effort — never throws into lesson runtime

import { recordTraceEvent } from './trace-recorder.js'
import type { ConversationContinuityState } from './conversation-continuity.js'

// ── Topic-aware reactions ─────────────────────────────────────────────────────
// Short one-liners showing the teacher registered the student's topic.

const TOPIC_REACTIONS: Record<string, string[]> = {
  youtube: [
    "YouTube is a solid context — there's a lot of real English there.",
    "YouTube covers everything now — good frame for today.",
    "Good — YouTube has a wide range of English styles to draw from.",
  ],
  gaming: [
    "Games are a real communicative context — good to work with.",
    "Gaming has its own vocabulary worth knowing — useful here.",
    "Good choice. Games create real situational language.",
  ],
  films: [
    "Films are great for this — emotional language, natural scenes.",
    "Good. Cinema gives you authentic language and real situations.",
    "Movies are a solid frame — a lot of natural English to draw from.",
  ],
  music: [
    "Music is a strong choice — lyrics carry a lot of natural English.",
    "Good — music gives you rhythm and vocabulary at once.",
  ],
  sports: [
    "Sports give you competitive and descriptive language — useful.",
    "Good. Sports coverage is full of natural spoken English.",
  ],
  technology: [
    "Tech is a useful context — fast-moving, real communication needs.",
    "Good. The tech world has its own register worth knowing.",
  ],
  history: [
    "History gives you strong narrative language — cause, effect, sequence.",
    "Good context. History requires precise descriptive English.",
  ],
  maths: [
    "Maths is useful here — you already think in patterns and logic.",
    "Good. That kind of analytical thinking transfers to language.",
  ],
  physics: [
    "Physics is a great frame — cause, effect, explanation.",
    "Good context. Physics demands clear, precise English.",
  ],
  biology: [
    "Biology gives you good descriptive and process language.",
    "Good. Science topics build precise vocabulary naturally.",
  ],
  chemistry: [
    "Chemistry is interesting — cause and effect in everything.",
    "Good. Scientific contexts build careful, specific language.",
  ],
}

// ── Topic-aware curiosity followups ──────────────────────────────────────────
// Specific questions showing genuine interest. Never pretend deep memory.

const TOPIC_CURIOUS_FOLLOWUPS: Record<string, string[]> = {
  youtube: [
    "What kind of content takes up most of your YouTube time?",
    "Is it mainly background watching, or do you actually sit down and focus?",
    "What does YouTube give you that you couldn't get anywhere else?",
  ],
  gaming: [
    "Is it more of a solo thing, or do you play with others?",
    "How much of the appeal is the challenge of getting better vs just playing?",
    "Would you ever play it competitively, or is it purely personal?",
  ],
  films: [
    "Do you usually watch alone or with someone — does it change the experience?",
    "What's the last film that actually made you think about it afterward?",
    "Is it something you watch properly or more as background?",
  ],
  music: [
    "Is music something you sit with properly, or more of a background thing?",
    "What's the last song that genuinely stuck with you?",
    "Is there a genre you always go back to when nothing else works?",
  ],
  sports: [
    "Is it something you actively play or mostly watch?",
    "What does sport give you emotionally that other entertainment doesn't?",
    "Would you say it's more about the result or the experience of watching it live?",
  ],
  technology: [
    "Is it more professional interest or personal curiosity?",
    "What part of tech actually interests you — building it, understanding it, or just using it?",
    "Is there a specific area of tech you follow closely?",
  ],
  history: [
    "Is there a particular period or region of history that draws you in?",
    "Is it more about the events themselves, or trying to understand why they happened?",
  ],
  maths: [
    "Is there a specific area of maths that you actually enjoy, or does it depend on the topic?",
    "What's the part that feels satisfying when it clicks?",
  ],
}

// Generic curious followups — used when topic is unknown or generic
const GENERIC_CURIOUS_FOLLOWUPS: string[] = [
  "What's the specific part of that you enjoy most?",
  "What keeps you coming back to it?",
  "What would you say makes it interesting to you personally?",
  "Is it something you'd actually recommend to someone else?",
  "How long have you been into that?",
]

// ── Expansion softeners ───────────────────────────────────────────────────────
// Replaces "Tell me more" / "I need 2–3 sentences" with specific, human prompts.

const EXPANSION_SOFTENERS: string[] = [
  "Give me one real detail — something specific you actually remember.",
  "What happened after that?",
  "What's the part that actually stuck with you?",
  "Walk me through that a bit more.",
  "Why did that part stand out to you?",
  "What made it worth remembering?",
  "What's the most specific thing you can say about it?",
  "Give me one concrete reason behind that.",
]

// ── Short-answer reaction prompts ─────────────────────────────────────────────
// Replaces "Tell me a bit more — give me a full sentence with your actual reasoning."

const SHORT_ANSWER_REACTIONS: string[] = [
  "What's your reason for that — can you put it into a full sentence?",
  "Connect that into a sentence for me — what's behind it?",
  "Give me one more detail — why specifically?",
  "Tell me the reason — even one sentence works.",
]

// ── Correction bridges ────────────────────────────────────────────────────────
// Used before delivering a correction to soften the transition.

const CORRECTION_BRIDGES: string[] = [
  "I can see what you mean —",
  "Yeah, the idea is clear —",
  "The meaning comes through —",
  "Good instinct —",
  "That reads naturally —",
]

// ── Reflective transitions ────────────────────────────────────────────────────
// Used when moving to the next step cleanly.

const REFLECTIVE_TRANSITIONS: string[] = [
  "Right — I've got a clear sense of that now.",
  "Yeah — that gives me what I need.",
  "Good — that's enough context to work with.",
  "Fair enough — let's move forward.",
  "I can work with that — let's keep going.",
]

// ── Inline vocabulary explanations ───────────────────────────────────────────
// For phrase questions that detectVocabWord might miss.
// Keys: lowercase normalized phrase exactly as a student might ask about it.

const INLINE_VOCAB_RESPONSES: Record<string, string> = {
  'worth my time':
    "'Worth my time' means good or interesting enough to deserve your attention — so: why should I watch it instead of something else?",
  'worth your time':
    "'Worth your time' means something valuable enough to be worth spending time on — interesting or useful enough to justify it.",
  'worth it':
    "'Worth it' means the result or experience justifies the effort — yes, it was good enough.",
  'worth watching':
    "'Worth watching' means the film or show is good enough to spend time on — not a waste.",
  'convince me':
    "'Convince me' means: give me strong enough reasons to believe it's worth doing. What's your best argument?",
  'pitch me':
    "'Pitch me' means: try to sell me on the idea — give me your best reasons why it's worth watching.",
  'without major spoilers':
    "'Without major spoilers' means: describe it without revealing the ending, the big twist, or the key surprises.",
  'pitch':
    "'Pitch' here means: try to persuade me — convince me it's worth watching. Give me your strongest reasons.",
  'convince':
    "'Convince' means to make someone believe something or want to do something. Try: 'You should watch ___ because ___.'",
}

// Patterns to extract vocabulary questions (catches "what means X", "what's mean X", etc.)
const VOCAB_QUESTION_PATTERNS: Array<RegExp> = [
  /\bwhat\s+means?\s+['"]?([a-z][\w\s']{1,35}?)['"]?\s*[?!.,]?$/i,
  /\bwhat(?:'s|\s+is|\s+does|\s+do)\s+['"]?([a-z][\w\s']{1,35}?)['"]?\s+mean/i,
  /\bmeaning\s+of\s+['"]?([a-z][\w\s']{1,35}?)['"]?/i,
  /\bi\s+don'?t\s+(?:know|understand)\s+(?:what\s+)?['"]?([a-z][\w\s']{1,35}?)['"]?\s+mean/i,
]

function extractVocabPhrase(text: string): string | null {
  const lower = text.toLowerCase().trim().replace(/[?!.,]+$/, '').trim()
  for (const re of VOCAB_QUESTION_PATTERNS) {
    const m = lower.match(re)
    if (m) {
      const phrase = (m[1] ?? '').trim().replace(/[?!.,'"+]+/g, '').trim()
      if (phrase.length >= 2 && phrase.length <= 40) return phrase
    }
  }
  return null
}

// ── Public exports ────────────────────────────────────────────────────────────

// Detects if the student is asking what a phrase means and returns an inline explanation.
// Returns null if the phrase is not recognized or no vocab question detected.
// Zero AI calls. Zero DB/Redis ops.
export function detectAndExplainVocabQuestion(
  text: string,
  sessionId?: string,
): string | null {
  try {
    const phrase = extractVocabPhrase(text)
    if (!phrase) return null
    const response = INLINE_VOCAB_RESPONSES[phrase]
    if (!response) return null
    emitMoveTrace(sessionId, `vocabulary_clarification_used phrase="${phrase.slice(0, 40)}"`)
    return response
  } catch {
    return null
  }
}

// Returns a short topic-aware reaction (e.g. "YouTube is a solid context — a lot of real English there.")
// Returns null if no topic detected or topic not in map.
export function chooseHumanReaction(
  state: ConversationContinuityState,
  sessionId?: string,
): string | null {
  try {
    const topic = state.recentTopics[0]
    if (!topic) return null
    const pool = TOPIC_REACTIONS[topic]
    if (!pool || pool.length === 0) return null
    const phrase = pool[state.turnCount % pool.length]!
    emitMoveTrace(sessionId, `human_reaction topic=${topic}`)
    return phrase
  } catch {
    return null
  }
}

// Returns a topic-aware curiosity followup question.
// Falls back to generic followups when topic is unknown.
export function chooseCuriousFollowup(
  state: ConversationContinuityState,
  sessionId?: string,
): string {
  try {
    const topic = state.recentTopics[0]
    if (topic) {
      const pool = TOPIC_CURIOUS_FOLLOWUPS[topic]
      if (pool && pool.length > 0) {
        const phrase = pool[state.turnCount % pool.length]!
        emitMoveTrace(sessionId, `curious_followup topic=${topic}`)
        return phrase
      }
    }
    const phrase = GENERIC_CURIOUS_FOLLOWUPS[state.turnCount % GENERIC_CURIOUS_FOLLOWUPS.length]!
    emitMoveTrace(sessionId, `curious_followup topic=generic`)
    return phrase
  } catch {
    return "What else can you tell me about that?"
  }
}

// Returns a guided expansion prompt (replaces "Tell me more" / "I need 2–3 sentences").
export function softenExpansionRequest(
  state: ConversationContinuityState,
  sessionId?: string,
): string {
  try {
    const phrase = EXPANSION_SOFTENERS[state.turnCount % EXPANSION_SOFTENERS.length]!
    emitMoveTrace(sessionId, 'guided_expansion')
    return phrase
  } catch {
    return "Give me a bit more context."
  }
}

// Returns a short-answer prompt (replaces "Tell me a bit more — give me a full sentence with your actual reasoning.").
export function chooseShortAnswerReaction(
  state: ConversationContinuityState,
  sessionId?: string,
): string {
  try {
    const phrase = SHORT_ANSWER_REACTIONS[state.turnCount % SHORT_ANSWER_REACTIONS.length]!
    emitMoveTrace(sessionId, 'short_answer_reaction')
    return phrase
  } catch {
    return "Give me a full sentence with a reason."
  }
}

// Returns a correction bridge phrase (softens correction delivery).
export function chooseCorrectionBridge(
  state: ConversationContinuityState,
  sessionId?: string,
): string {
  try {
    const phrase = CORRECTION_BRIDGES[state.turnCount % CORRECTION_BRIDGES.length]!
    emitMoveTrace(sessionId, 'correction_bridge')
    return phrase
  } catch {
    return "I can see what you mean —"
  }
}

// Returns a reflective transition phrase (clean step handoff).
export function chooseReflectiveTransition(
  state: ConversationContinuityState,
  sessionId?: string,
): string {
  try {
    const phrase = REFLECTIVE_TRANSITIONS[state.turnCount % REFLECTIVE_TRANSITIONS.length]!
    emitMoveTrace(sessionId, 'reflective_transition')
    return phrase
  } catch {
    return "Good — let's keep going."
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function emitMoveTrace(sessionId: string | undefined, moveType: string): void {
  if (process.env.ENABLE_RUNTIME_TRACE !== '1' || !sessionId) return
  try {
    recordTraceEvent({
      sessionId,
      eventType:      'conversation_phrase_rotated',
      payloadSummary: `conversational_move_selected type=${moveType}`,
      severity:       'debug',
    })
  } catch {
    // never propagate into lesson runtime
  }
}
