// Conversational Continuity Helper — Phase 2B
//
// Session-scoped, in-process memory only. No DB/Redis writes per turn.
// No AI calls. No raw transcripts stored. Session maps expire with the Node process.
//
// Design guarantees:
//   • Zero extra AI calls
//   • Zero DB/Redis ops per turn (in-process Map only)
//   • No raw student text stored — signals and short topic labels only
//   • Max stored sessions: 10,000 (LRU-style eviction prevents unbounded growth)
//   • Best-effort: never throws into lesson runtime

import { recordTraceEvent } from './trace-recorder.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type EmotionalSignal = 'confident' | 'unsure' | 'curious' | 'frustrated' | 'neutral'
export type TeacherMove = 'acknowledge' | 'correct' | 'followup' | 'transition' | 'support'

export interface ConversationContinuityState {
  recentTopics:     string[]        // max 3 short topic labels — no raw text
  studentInterest?: string          // from session setup (not from transcript)
  emotionalSignal:  EmotionalSignal
  lastTeacherMove?: TeacherMove
  avoidedPhrases:   string[]        // max 5 already-used short phrases this session
  correctionCount:  number
  turnCount:        number
}

// ── In-memory session store ───────────────────────────────────────────────────

const _store = new Map<string, ConversationContinuityState>()
const MAX_SESSIONS = 10_000

export function getOrCreateContinuity(sessionId: string): ConversationContinuityState {
  if (!_store.has(sessionId)) {
    // Evict oldest entry when at capacity (Map preserves insertion order)
    if (_store.size >= MAX_SESSIONS) {
      const oldest = _store.keys().next().value
      if (oldest) _store.delete(oldest)
    }
    _store.set(sessionId, {
      recentTopics:    [],
      emotionalSignal: 'neutral',
      avoidedPhrases:  [],
      correctionCount: 0,
      turnCount:       0,
    })
  }
  return _store.get(sessionId)!
}

export function clearContinuity(sessionId: string): void {
  _store.delete(sessionId)
}

// ── Student input signal detection ───────────────────────────────────────────
// Deterministic only — no AI.

const UNCERTAINTY_RE =
  /\b(i\s+don'?t\s+know|i'?m\s+not\s+sure|no\s+idea|hard\s+to\s+say|i\s+can'?t\s+think|nothing\s+comes\s+to\s+mind|not\s+sure\s+what)\b/i

const FRUSTRATION_RE =
  /\b(too\s+hard|too\s+difficult|confusing|confused|stuck|can'?t\s+do\s+this|bad\s+english|my\s+english\s+is\s+(bad|terrible|awful))\b/i

const CURIOSITY_RE =
  /\b(why|because|discover|wonder|curious|understand|explains?|makes?\s+sense|how\s+does|interesting\s+because)\b/i

const CONFIDENCE_RE =
  /\b(i\s+think|i\s+like|i\s+know|i\s+can|i\s+believe|definitely|of\s+course|obviously|for\s+sure)\b/i

// Topic labels (short, safe to store — not raw student text)
const TOPIC_DETECTORS: Array<[string, RegExp]> = [
  ['maths',      /\b(math|maths|mathematics|algebra|calculus|geometry|statistics)\b/i],
  ['physics',    /\b(physics|quantum|gravity|force|energy|motion)\b/i],
  ['chemistry',  /\b(chemistry|chemical|molecule|atom|compound)\b/i],
  ['biology',    /\b(biology|organism|cell|evolution|ecology|science)\b/i],
  ['history',    /\b(history|historical|war|revolution|century|empire)\b/i],
  ['technology', /\b(computer|coding|programming|tech|app|software|internet|digital)\b/i],
  ['youtube',    /\b(youtube|youtuber|channel|creator|mr\.?\s*beast|pewdiepie)\b/i],
  ['gaming',     /\b(game|gaming|play|minecraft|fortnite|roblox|console)\b/i],
  ['sports',     /\b(sport|football|basketball|swimming|running|gym|training)\b/i],
  ['music',      /\b(music|song|sing|band|playlist|concert|lyrics)\b/i],
  ['films',      /\b(movie|film|series|netflix|cinema|episode|watch)\b/i],
]

export function detectEmotionalSignal(text: string): EmotionalSignal {
  if (UNCERTAINTY_RE.test(text))  return 'unsure'
  if (FRUSTRATION_RE.test(text))  return 'frustrated'
  if (CURIOSITY_RE.test(text))    return 'curious'
  if (CONFIDENCE_RE.test(text))   return 'confident'
  return 'neutral'
}

// Returns true only when the answer is short AND primarily an uncertainty expression.
// Long answers that contain "I don't know" as a clause are NOT intercepted.
export function detectUncertainty(text: string): boolean {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  if (wordCount > 8) return false  // enough content — don't intercept
  return UNCERTAINTY_RE.test(text)
}

function detectTopics(text: string): string[] {
  const found: string[] = []
  for (const [label, re] of TOPIC_DETECTORS) {
    if (re.test(text)) found.push(label)
    if (found.length >= 2) break
  }
  return found
}

// ── State update ──────────────────────────────────────────────────────────────

export function updateContinuityFromStudentInput(
  state:      ConversationContinuityState,
  text:       string,
  move:       TeacherMove,
  sessionId?: string,
): void {
  try {
    state.emotionalSignal = detectEmotionalSignal(text)

    const topics = detectTopics(text)
    for (const t of topics) {
      if (!state.recentTopics.includes(t)) state.recentTopics.unshift(t)
    }
    if (state.recentTopics.length > 3) state.recentTopics = state.recentTopics.slice(0, 3)

    state.lastTeacherMove = move
    state.turnCount++

    if (process.env.ENABLE_RUNTIME_TRACE === '1' && sessionId) {
      recordTraceEvent({
        sessionId,
        eventType:      'conversation_continuity_updated',
        payloadSummary: `signal=${state.emotionalSignal} topics=${state.recentTopics.join(',')} turn=${state.turnCount}`,
        severity:       'debug',
      })
    }
  } catch {
    // never propagate into lesson runtime
  }
}

// ── Response phrase selection ─────────────────────────────────────────────────

// Varied uncertainty support — "I don't know" should feel heard, not judged
const UNCERTAINTY_SUPPORTS = [
  "That's okay — it doesn't need to be perfect. Just the first thing that comes to mind.",
  "No problem — even a rough idea works. Try: 'I think...' and keep going.",
  "Fair enough — a short attempt tells me more than nothing. One sentence is plenty.",
  "That's fine — most people pause here. Try starting with 'I like...' or 'I usually...'",
]

export function chooseSupportResponse(
  state:      ConversationContinuityState,
  sessionId?: string,
): string {
  const idx = state.correctionCount % UNCERTAINTY_SUPPORTS.length
  const response = UNCERTAINTY_SUPPORTS[idx]!
  state.correctionCount++

  if (process.env.ENABLE_RUNTIME_TRACE === '1' && sessionId) {
    recordTraceEvent({
      sessionId,
      eventType:      'conversation_softened_for_uncertainty',
      payloadSummary: `signal=unsure responseIdx=${idx}`,
      severity:       'debug',
    })
  }

  return response
}

// Short bridge acknowledgements — varied to avoid repeating "Yeah — that makes sense."
const TRANSITION_ACKS_CLOSE = [
  "Right — I've got what I need.",
  "Yeah — that tracks.",
  "Good — I can work with that.",
  "Okay — that's enough.",
  "Fair enough — let's keep going.",
]

export function chooseTransitionAck(
  state:      ConversationContinuityState,
  sessionId?: string,
): string {
  const idx = state.turnCount % TRANSITION_ACKS_CLOSE.length
  const phrase = TRANSITION_ACKS_CLOSE[idx]!

  if (process.env.ENABLE_RUNTIME_TRACE === '1' && sessionId) {
    recordTraceEvent({
      sessionId,
      eventType:      'conversation_phrase_rotated',
      payloadSummary: `type=transition_ack idx=${idx}`,
      severity:       'debug',
    })
  }

  return phrase
}

// Phrase deduplication — returns fallback if candidate phrase was already used
export function avoidRepeatedPhrase(
  state:     ConversationContinuityState,
  candidate: string,
  fallback:  string,
): string {
  if (state.avoidedPhrases.includes(candidate)) return fallback
  if (state.avoidedPhrases.length >= 5) state.avoidedPhrases.shift()
  state.avoidedPhrases.push(candidate)
  return candidate
}
