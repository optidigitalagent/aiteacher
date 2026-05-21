// ── Session Memory — Redis-backed per-lesson counters ─────────────────────────
// Short-lived: TTL matches lesson TTL (4 hours).
// Used for in-session adaptation only — not persisted long-term.

import redis from '../db/redis.js'
import type { SessionMemory, AdaptiveSignal, HintDepthSignal } from './types.js'

// Phase 3C: Adaptive context block params
export interface AdaptiveContextParams {
  sessionMemory:                 SessionMemory
  exerciseType:                  string
  skillTag:                      string
  correctionTurn:                'A' | 'B' | 'C' | 'D' | null
  answerShapeIssueAlreadyHinted: boolean
  outcome:                       'correct' | 'wrong' | 'revealed' | 'skipped'
}

const SESSION_MEMORY_TTL = 14_400 // 4 hours, same as lesson state

// Caps defined by Phase 3B spec
const MAX_WRONG_STREAK  = 10
const MAX_SHAPE_ISSUES  = 10
const MAX_SKILL_KEYS    = 20

function sessionMemoryKey(lessonId: string): string {
  return `memory:session:${lessonId}`
}

function traceAdaptive(event: string, payloadSummary: string): void {
  if (process.env.ENABLE_RUNTIME_TRACE !== '1') return
  try {
    process.stderr.write(
      JSON.stringify({ RUNTIME_TRACE: { event, payloadSummary, timestamp: new Date().toISOString() } }) + '\n',
    )
  } catch { /* never propagate */ }
}

export async function getSessionMemory(lessonId: string, userId: string): Promise<SessionMemory> {
  try {
    const raw = await redis.get(sessionMemoryKey(lessonId))
    if (raw) return JSON.parse(raw) as SessionMemory
  } catch {
    // fall through to default
  }
  return {
    lessonId,
    userId,
    mistakeStreak: 0,
    hintsUsed: 0,
    voiceAttempts: 0,
    correctionTypes: [],
    recentTopics: [],
    wrongStreakBySkill: {},
    correctStreak: 0,
    answerShapeIssues: {},
    lastCorrectionTurnByType: {},
    hintDepthSignal: 'normal',
  }
}

export async function updateSessionMemoryOnValidation(
  lessonId: string,
  userId: string,
  isCorrect: boolean,
  exerciseType: string,
  topic?: string,
): Promise<void> {
  try {
    const mem = await getSessionMemory(lessonId, userId)

    mem.mistakeStreak = isCorrect ? 0 : mem.mistakeStreak + 1
    mem.correctionTypes = isCorrect
      ? mem.correctionTypes
      : [...mem.correctionTypes.slice(-9), exerciseType]

    if (topic && !mem.recentTopics.includes(topic)) {
      mem.recentTopics = [...mem.recentTopics.slice(-4), topic]
    }

    await redis.set(sessionMemoryKey(lessonId), JSON.stringify(mem), 'EX', SESSION_MEMORY_TTL)
  } catch (err) {
    console.error('[session-memory] update error (ignored):', err)
  }
}

export async function incrementVoiceAttempt(lessonId: string, userId: string): Promise<void> {
  try {
    const mem = await getSessionMemory(lessonId, userId)
    mem.voiceAttempts++
    await redis.set(sessionMemoryKey(lessonId), JSON.stringify(mem), 'EX', SESSION_MEMORY_TTL)
  } catch (err) {
    console.error('[session-memory] voice increment error (ignored):', err)
  }
}

export async function incrementHintsUsed(lessonId: string, userId: string): Promise<void> {
  try {
    const mem = await getSessionMemory(lessonId, userId)
    mem.hintsUsed++
    await redis.set(sessionMemoryKey(lessonId), JSON.stringify(mem), 'EX', SESSION_MEMORY_TTL)
  } catch (err) {
    console.error('[session-memory] hints increment error (ignored):', err)
  }
}

// Phase 3B: Update adaptive signal fields in session memory.
// Fail-soft: logs warning and returns without throwing on any Redis or parse error.
// Never blocks lesson progression — callers should fire-and-forget (.catch(() => {})).
export async function updateAdaptiveSignal(
  lessonId: string,
  userId: string,
  signal: AdaptiveSignal,
): Promise<void> {
  try {
    const mem = await getSessionMemory(lessonId, userId)

    // Initialize adaptive fields if absent (backward compat with old Redis sessions)
    if (!mem.wrongStreakBySkill) mem.wrongStreakBySkill = {}
    if (mem.correctStreak === undefined) mem.correctStreak = 0
    if (!mem.answerShapeIssues) mem.answerShapeIssues = {}
    if (!mem.lastCorrectionTurnByType) mem.lastCorrectionTurnByType = {}

    const skillTag = signal.skillTag

    // Update correctStreak and wrongStreakBySkill based on outcome
    if (signal.outcome === 'correct') {
      mem.correctStreak = (mem.correctStreak ?? 0) + 1
      mem.wrongStreakBySkill[skillTag] = 0
    } else {
      mem.correctStreak = 0
      if (signal.outcome === 'wrong') {
        const prev = mem.wrongStreakBySkill[skillTag] ?? 0
        mem.wrongStreakBySkill[skillTag] = Math.min(prev + 1, MAX_WRONG_STREAK)
      } else {
        // revealed or skipped: reset wrong streak for this skill
        mem.wrongStreakBySkill[skillTag] = 0
      }
    }

    // Cap skill keys to avoid unbounded growth
    const skillKeys = Object.keys(mem.wrongStreakBySkill)
    if (skillKeys.length > MAX_SKILL_KEYS) {
      for (const k of skillKeys) {
        if ((mem.wrongStreakBySkill[k] ?? 0) === 0) {
          delete mem.wrongStreakBySkill[k]
          if (Object.keys(mem.wrongStreakBySkill).length <= MAX_SKILL_KEYS) break
        }
      }
    }

    // Track answer shape issues per exercise type
    if (signal.answerShapeIssue) {
      const prev = mem.answerShapeIssues[signal.exerciseType] ?? 0
      mem.answerShapeIssues[signal.exerciseType] = Math.min(prev + 1, MAX_SHAPE_ISSUES)
    }

    // Track latest correction turn per exercise type
    if (signal.correctionTurn) {
      mem.lastCorrectionTurnByType[signal.exerciseType] = signal.correctionTurn
    }

    // Derive hint depth signal deterministically
    const wrongStreak = mem.wrongStreakBySkill[skillTag] ?? 0
    const hintDepth: HintDepthSignal =
      wrongStreak >= 3     ? 'increased' :
      (mem.correctStreak ?? 0) >= 5 ? 'reduced'   :
      'normal'
    mem.hintDepthSignal = hintDepth

    await redis.set(sessionMemoryKey(lessonId), JSON.stringify(mem), 'EX', SESSION_MEMORY_TTL)

    traceAdaptive(
      'adaptive_session_state_updated',
      `hintDepth=${hintDepth} skill=${skillTag} wrongStreak=${wrongStreak} correctStreak=${mem.correctStreak ?? 0}`,
    )
  } catch (err) {
    console.warn('[session-memory] adaptive signal update failed (ignored):', err instanceof Error ? err.message : err)
  }
}

// Phase 3C: Build advisory adaptive context block for the paid lesson teacher context.
// Pure function — takes an already-resolved SessionMemory; no I/O.
// Returns '' when all signals are within normal range (nothing adaptive to add).
// Token budget target: 40–90 tokens when non-empty.
// RULES:
//   A+E — wrongStreakBySkill[skillTag] >= 3  → increased hint depth on correction turns
//   B   — correctStreak >= 5                 → reduced verbosity on correct answers
//   C   — answerShapeIssues[exerciseType] >= 2 (and not already hinted) → format reminder
//   D   — correctionTurn C or D              → simplify language on late correction turns
export function buildAdaptiveLearningContextBlock(params: AdaptiveContextParams): string {
  const { sessionMemory, exerciseType, skillTag, correctionTurn, answerShapeIssueAlreadyHinted, outcome } = params
  const lines: string[] = []

  const wrongStreak   = sessionMemory.wrongStreakBySkill?.[skillTag] ?? 0
  const correctStreak = sessionMemory.correctStreak ?? 0
  const shapeIssues   = sessionMemory.answerShapeIssues?.[exerciseType] ?? 0

  // Rule A+E: Repeated skill failure → give a clearer rule hint on this correction turn
  if (outcome !== 'correct' && wrongStreak >= 3) {
    lines.push(
      `Hint depth: INCREASED — student has failed "${skillTag}" ${wrongStreak}× this session.`,
      `Give one clearer rule hint. Do not reveal the answer unless the engine is at TURN D.`,
    )
  }

  // Rule B: Strong correct streak → keep confirmation very brief
  if (outcome === 'correct' && correctStreak >= 5) {
    lines.push(
      `Verbosity: REDUCED — student has ${correctStreak} correct answers in a row.`,
      `One-word confirmation only. Skip rule restatement unless it adds new insight.`,
    )
  }

  // Rule C: Repeated format mistakes → remind expected answer shape (only if not already in this turn)
  if (outcome !== 'correct' && !answerShapeIssueAlreadyHinted && shapeIssues >= 2) {
    lines.push(
      `Format reminder: student gave wrong answer shape ${shapeIssues}× for ${exerciseType}.`,
      `Remind expected format early — e.g. "Give just the missing word, not the full sentence."`,
    )
  }

  // Rule D: Late correction turn → plain language, one concrete clue
  if (outcome !== 'correct' && (correctionTurn === 'C' || correctionTurn === 'D')) {
    lines.push(
      `Late turn (${correctionTurn}): use plain language, avoid grammar jargon, one concrete clue only.`,
    )
  }

  if (lines.length === 0) return ''

  return (
    `[ADAPTIVE LEARNING SIGNAL — advisory only]\n` +
    lines.join('\n') + '\n' +
    `Rule: Phrasing and hint depth only. Do NOT change correctness, progression, or cursor state.\n` +
    `[END ADAPTIVE SIGNAL]`
  )
}
