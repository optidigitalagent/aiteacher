import type { LessonPhase, LessonState } from './types.js'

export const PHASE_TIME_LIMITS_MIN: Partial<Record<LessonPhase, number>> = {
  DIAGNOSTIC:     5,
  CONTEXT_INPUT:  7,
  RULE_DISCOVERY: 10,
  EXERCISES:      20,
  VOCABULARY:     8,
  DEEP_THINKING:  8,
  WRAP_UP:        5,
}

const PHASE_ORDER: LessonPhase[] = [
  'DIAGNOSTIC', 'CONTEXT_INPUT', 'RULE_DISCOVERY',
  'EXERCISES', 'VOCABULARY', 'DEEP_THINKING', 'WRAP_UP', 'END',
]

export function nextPhase(phase: LessonPhase): LessonPhase | null {
  const idx = PHASE_ORDER.indexOf(phase)
  return idx >= 0 && idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null
}

function elapsedMin(state: LessonState): number {
  return (Date.now() - new Date(state.phaseStartedAt).getTime()) / 60_000
}

export function shouldTransition(state: LessonState): LessonPhase | null {
  const { phase } = state
  const elapsed = elapsedMin(state)
  const limit   = PHASE_TIME_LIMITS_MIN[phase]

  // Hard time cap — force advance to next phase
  if (limit && elapsed >= limit) return nextPhase(phase)

  switch (phase) {
    case 'DIAGNOSTIC':
      return state.exchangeCount >= 2 ? 'CONTEXT_INPUT' : null
    case 'CONTEXT_INPUT':
      return state.studentConfirmedReading ? 'RULE_DISCOVERY' : null
    case 'RULE_DISCOVERY':
      return state.ruleStatedCorrectly ? 'EXERCISES' : null
    case 'EXERCISES':
      return state.exerciseCount >= 6 || elapsed >= 15 ? 'VOCABULARY' : null
    case 'VOCABULARY':
      return state.vocabularyTaught.length >= 6 ? 'DEEP_THINKING' : null
    case 'DEEP_THINKING':
      return state.deepThinkingExchanges >= 3 ? 'WRAP_UP' : null
    case 'WRAP_UP':
      return state.summaryDelivered ? 'END' : null
    default:
      return null
  }
}

// Called with AI's next_action string — mutates state flags or returns target phase
export function applyAISignal(state: LessonState, nextAction: string): LessonPhase | null {
  if (nextAction.startsWith('transition_to:')) {
    const target = nextAction.slice('transition_to:'.length) as LessonPhase
    if (PHASE_ORDER.includes(target)) return target
  }
  // Flag setters — Claude uses these to signal readiness without forcing transition
  if (nextAction === 'student_confirmed_reading') state.studentConfirmedReading = true
  if (nextAction === 'rule_stated_correctly')     state.ruleStatedCorrectly = true
  if (nextAction === 'summary_delivered')         state.summaryDelivered = true
  return null
}
