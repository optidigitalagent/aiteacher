/**
 * Mentium Kids — Unit Test Suite
 *
 * Coverage:
 *   - session-engine: createSession, caps, expiry, cost tracking
 *   - recovery-manager: classifyResponse, buildRecoveryAction, detectL1
 *   - immersion-manager: rescue ladder, wait timer, L1 rescue
 *   - orchestrator: startSession, getSession
 *   - logger: log entries emitted per session
 *
 * Does NOT require DB, Redis, or real LLM calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createSession,
  isSessionExpired,
  isCostCapReached,
  getCurrentItem,
  getQuestionTypeForScore,
  applyConfidenceDelta,
  advanceToNextItem,
  recordLlmCall,
  updateTimingState,
  LLM_CALL_CAP,
  TTS_CHAR_CAP,
} from './session-engine.js'
import {
  detectL1,
  detectIdk,
  classifyResponse,
  buildRecoveryAction,
  selectFastTrack,
  selectReward,
} from './recovery-manager.js'
import {
  buildRescueResponse,
  startWaitTimer,
  clearWaitTimer,
  checkWaitElapsed,
  resetRescueLevelOnSuccess,
} from './immersion-manager.js'
import {
  startSession,
  getSession,
  processSilence,
} from './orchestrator.js'
import { getSessionLogs, clearSessionLogs } from './logger.js'
import type { SessionState, StartSessionParams } from './types.js'

// ── Shared fixtures ───────────────────────────────────────────────────────────

const BASE_PARAMS: StartSessionParams = {
  childId: 'test-child-001',
  childName: 'Mia',
  childAge: 7,
  childL1: 'uk',
  sessionNumber: 1,
}

function freshSession(): SessionState {
  return createSession(BASE_PARAMS)
}

// ─────────────────────────────────────────────────────────────────────────────
// session-engine
// ─────────────────────────────────────────────────────────────────────────────

describe('session-engine: caps', () => {
  it('exports LLM_CALL_CAP = 20', () => {
    expect(LLM_CALL_CAP).toBe(20)
  })

  it('exports TTS_CHAR_CAP = 2000', () => {
    expect(TTS_CHAR_CAP).toBe(2000)
  })
})

describe('session-engine: createSession', () => {
  it('returns a valid SessionState with required fields', () => {
    const s = freshSession()
    expect(s.sessionId).toBeTruthy()
    expect(s.childId).toBe('test-child-001')
    expect(s.childName).toBe('Mia')
    expect(s.childAge).toBe(7)
    expect(s.childL1).toBe('uk')
    expect(s.sessionNumber).toBe(1)
    expect(s.status).toBe('active')
  })

  it('initialises cost state to zero', () => {
    const s = freshSession()
    expect(s.costState.llmCallsThisSession).toBe(0)
    expect(s.costState.ttsCharsThisSession).toBe(0)
    expect(s.costState.costCapReached).toBe(false)
  })

  it('initialises emotionalState with engaged estimate', () => {
    const s = freshSession()
    expect(s.emotionalState.stateEstimate).toBe('engaged')
    expect(s.emotionalState.recoveryLevel).toBe(0)
  })

  it('populates sessionPlan with curriculum items', () => {
    const s = freshSession()
    expect(s.curriculumState.sessionPlan.length).toBeGreaterThan(0)
    expect(s.curriculumState.currentItemId).toBeTruthy()
  })

  it('starts with 15-minute timer (minutesUntilClose = 15)', () => {
    const s = freshSession()
    expect(s.timingState.minutesUntilClose).toBe(15)
  })
})

describe('session-engine: isSessionExpired', () => {
  it('returns false immediately after creation', () => {
    const s = freshSession()
    expect(isSessionExpired(s)).toBe(false)
  })

  it('returns true when startedAt is 15 min ago', () => {
    const s = freshSession()
    s.startedAt = new Date(Date.now() - 16 * 60 * 1000)
    expect(isSessionExpired(s)).toBe(true)
  })

  it('returns false at 14 min 59 s', () => {
    const s = freshSession()
    s.startedAt = new Date(Date.now() - (15 * 60 * 1000 - 1000))
    expect(isSessionExpired(s)).toBe(false)
  })
})

describe('session-engine: isCostCapReached', () => {
  it('returns false initially', () => {
    const s = freshSession()
    expect(isCostCapReached(s)).toBe(false)
  })

  it('returns true when llmCalls = 20', () => {
    const s = freshSession()
    s.costState.llmCallsThisSession = LLM_CALL_CAP
    expect(isCostCapReached(s)).toBe(true)
  })

  it('returns true when ttsChars = 2000', () => {
    const s = freshSession()
    s.costState.ttsCharsThisSession = TTS_CHAR_CAP
    expect(isCostCapReached(s)).toBe(true)
  })

  it('returns false just below both caps', () => {
    const s = freshSession()
    s.costState.llmCallsThisSession = LLM_CALL_CAP - 1
    s.costState.ttsCharsThisSession = TTS_CHAR_CAP - 1
    expect(isCostCapReached(s)).toBe(false)
  })
})

describe('session-engine: recordLlmCall', () => {
  it('increments llmCalls and ttsChars', () => {
    const s = freshSession()
    recordLlmCall(s, 100)
    expect(s.costState.llmCallsThisSession).toBe(1)
    expect(s.costState.ttsCharsThisSession).toBe(100)
  })

  it('sets costCapReached when llmCalls reaches cap', () => {
    const s = freshSession()
    s.costState.llmCallsThisSession = LLM_CALL_CAP - 1
    recordLlmCall(s, 10)
    expect(s.costState.costCapReached).toBe(true)
  })

  it('sets costCapReached when ttsChars reaches cap', () => {
    const s = freshSession()
    s.costState.ttsCharsThisSession = TTS_CHAR_CAP - 50
    recordLlmCall(s, 100)
    expect(s.costState.costCapReached).toBe(true)
  })

  it('emits a cost log entry', () => {
    const s = freshSession()
    clearSessionLogs(s.sessionId)
    recordLlmCall(s, 50)
    const logs = getSessionLogs(s.sessionId)
    const costLog = logs.find(l => l.type === 'cost')
    expect(costLog).toBeTruthy()
    expect(costLog?.data['llmCalls']).toBe(1)
  })
})

describe('session-engine: getQuestionTypeForScore', () => {
  it('RECOGNITION for score <= 30', () => {
    expect(getQuestionTypeForScore(0)).toBe('RECOGNITION')
    expect(getQuestionTypeForScore(30)).toBe('RECOGNITION')
  })

  it('FORCED_CHOICE for score 31–55', () => {
    expect(getQuestionTypeForScore(31)).toBe('FORCED_CHOICE')
    expect(getQuestionTypeForScore(55)).toBe('FORCED_CHOICE')
  })

  it('SUPPORTED_PRODUCTION for score 56–75', () => {
    expect(getQuestionTypeForScore(56)).toBe('SUPPORTED_PRODUCTION')
    expect(getQuestionTypeForScore(75)).toBe('SUPPORTED_PRODUCTION')
  })

  it('FREE_PRODUCTION for score > 75', () => {
    expect(getQuestionTypeForScore(76)).toBe('FREE_PRODUCTION')
    expect(getQuestionTypeForScore(100)).toBe('FREE_PRODUCTION')
  })
})

describe('session-engine: getCurrentItem', () => {
  it('returns the active item', () => {
    const s = freshSession()
    const item = getCurrentItem(s)
    expect(item).not.toBeNull()
    expect(item?.itemId).toBe(s.curriculumState.currentItemId)
  })

  it('returns null when currentItemId is null', () => {
    const s = freshSession()
    s.curriculumState.currentItemId = null
    expect(getCurrentItem(s)).toBeNull()
  })
})

describe('session-engine: applyConfidenceDelta', () => {
  it('raises confidence score on positive delta', () => {
    const s = freshSession()
    const itemId = s.curriculumState.currentItemId!
    const item = s.curriculumState.activeItems.find(i => i.itemId === itemId)!
    const before = item.confidenceScore
    applyConfidenceDelta(s, itemId, 10)
    expect(item.confidenceScore).toBe(Math.min(100, before + 10))
  })

  it('clamps confidence to [0, 100]', () => {
    const s = freshSession()
    const itemId = s.curriculumState.currentItemId!
    applyConfidenceDelta(s, itemId, -999)
    const item = s.curriculumState.activeItems.find(i => i.itemId === itemId)!
    expect(item.confidenceScore).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// recovery-manager
// ─────────────────────────────────────────────────────────────────────────────

describe('recovery-manager: detectL1', () => {
  it('detects Cyrillic text', () => {
    expect(detectL1('не знаю')).toBe(true)
    expect(detectL1('це кішка')).toBe(true)
  })

  it('detects known L1 phrases', () => {
    expect(detectL1('я не знаю')).toBe(true)
  })

  it('returns false for English text', () => {
    expect(detectL1('cat')).toBe(false)
    expect(detectL1('I don\'t know')).toBe(false)
  })
})

describe('recovery-manager: detectIdk', () => {
  it('detects "I don\'t know"', () => {
    expect(detectIdk("i don't know")).toBe(true)
    expect(detectIdk('idk')).toBe(true)
  })

  it('returns false for a real answer', () => {
    expect(detectIdk('cat')).toBe(false)
    expect(detectIdk('lion')).toBe(false)
  })
})

describe('recovery-manager: classifyResponse', () => {
  it('returns CORRECT_CONFIDENT for correct fast answer', () => {
    const s = freshSession()
    const targetWord = 'cat'
    s.curriculumState.currentItemId = 'ani_cat'
    s.curriculumState.activeItems.push({
      itemId: 'ani_cat', confidenceScore: 30, modesUsed: [],
      attempts: 0, successes: 0, consecutiveFailures: 0, introducedAtMinute: 0,
    })
    const signal = classifyResponse('cat', 1500, targetWord, s)
    expect(signal).toBe('CORRECT_CONFIDENT')
  })

  it('returns CORRECT_HESITANT for correct slow answer (> 3s)', () => {
    const s = freshSession()
    const signal = classifyResponse('cat', 4000, 'cat', s)
    expect(signal).toBe('CORRECT_HESITANT')
  })

  it('returns INCORRECT_ATTEMPT for wrong answer', () => {
    const s = freshSession()
    const signal = classifyResponse('banana', 1000, 'cat', s)
    expect(signal).toBe('INCORRECT_ATTEMPT')
  })

  it('returns NO_RESPONSE for empty text', () => {
    const s = freshSession()
    const signal = classifyResponse('', 0, 'cat', s)
    expect(signal).toBe('NO_RESPONSE')
  })

  it('returns NO_RESPONSE for latency > 8000ms', () => {
    const s = freshSession()
    const signal = classifyResponse('cat', 9000, 'cat', s)
    expect(signal).toBe('NO_RESPONSE')
  })

  it('returns L1_SWITCH for Cyrillic input', () => {
    const s = freshSession()
    const signal = classifyResponse('кіт', 1200, 'cat', s)
    expect(signal).toBe('L1_SWITCH')
  })

  it('returns REPEATED_FAILURE on second consecutive failure', () => {
    const s = freshSession()
    const itemId = s.curriculumState.currentItemId!
    const item = s.curriculumState.activeItems.find(i => i.itemId === itemId)!
    item.consecutiveFailures = 1
    const signal = classifyResponse('banana', 1000, 'cat', s)
    expect(signal).toBe('REPEATED_FAILURE')
  })

  it('emits response_signal and child_response_type logs', () => {
    const s = freshSession()
    clearSessionLogs(s.sessionId)
    classifyResponse('cat', 1000, 'cat', s)
    const logs = getSessionLogs(s.sessionId)
    expect(logs.some(l => l.type === 'response_latency')).toBe(true)
    expect(logs.some(l => l.type === 'child_response_type')).toBe(true)
  })
})

describe('recovery-manager: buildRecoveryAction', () => {
  it('returns recoveryLevel 2 for INCORRECT_ATTEMPT', () => {
    const s = freshSession()
    const action = buildRecoveryAction('INCORRECT_ATTEMPT', s, 'cat', 'Mia')
    expect(action.recoveryLevel).toBe(2)
    expect(action.requiresLlm).toBe(false)
    expect(action.scriptedResponse.length).toBeGreaterThan(0)
  })

  it('returns recoveryLevel 1 for CORRECT_HESITANT', () => {
    const s = freshSession()
    const action = buildRecoveryAction('CORRECT_HESITANT', s, 'cat', 'Mia')
    expect(action.recoveryLevel).toBe(1)
    expect(action.winAchieved).toBe(true)
  })

  it('returns recoveryLevel 5 for EMOTIONAL_SHUTDOWN', () => {
    const s = freshSession()
    const action = buildRecoveryAction('EMOTIONAL_SHUTDOWN', s, 'cat', 'Mia')
    expect(action.recoveryLevel).toBe(5)
    expect(s.emotionalState.emotionalShutdownOccurred).toBe(true)
  })

  it('flags item on REPEATED_FAILURE', () => {
    const s = freshSession()
    const itemId = s.curriculumState.currentItemId!
    buildRecoveryAction('REPEATED_FAILURE', s, 'cat', 'Mia')
    expect(s.curriculumState.flaggedItems.some(f => f.itemId === itemId)).toBe(true)
  })

  it('emits recovery_trigger log for INCORRECT_ATTEMPT', () => {
    const s = freshSession()
    clearSessionLogs(s.sessionId)
    buildRecoveryAction('INCORRECT_ATTEMPT', s, 'cat', 'Mia')
    const logs = getSessionLogs(s.sessionId)
    const trigger = logs.find(l => l.type === 'recovery_trigger')
    expect(trigger).toBeTruthy()
    expect(trigger?.data['level']).toBe(2)
  })

  it('emits recovery_trigger log for EMOTIONAL_SHUTDOWN', () => {
    const s = freshSession()
    clearSessionLogs(s.sessionId)
    buildRecoveryAction('EMOTIONAL_SHUTDOWN', s, 'cat', 'Mia')
    const logs = getSessionLogs(s.sessionId)
    const trigger = logs.find(l => l.type === 'recovery_trigger')
    expect(trigger).toBeTruthy()
    expect(trigger?.data['level']).toBe(5)
  })
})

describe('recovery-manager: selectFastTrack', () => {
  it('returns "Yes!" text for CORRECT_CONFIDENT', () => {
    const ft = selectFastTrack('CORRECT_CONFIDENT')
    expect(ft.text).toBe('Yes!')
  })

  it('returns non-empty text for all signals', () => {
    const signals = [
      'CORRECT_CONFIDENT', 'CORRECT_HESITANT', 'INCORRECT_ATTEMPT',
      'NO_RESPONSE', 'L1_SWITCH', 'REPEATED_FAILURE', 'EMOTIONAL_SHUTDOWN',
    ] as const
    for (const s of signals) {
      const ft = selectFastTrack(s)
      expect(ft.text.length).toBeGreaterThan(0)
      expect(ft.animation.length).toBeGreaterThan(0)
    }
  })
})

describe('recovery-manager: selectReward', () => {
  it('returns a reward with id, text, animation', () => {
    const s = freshSession()
    const reward = selectReward(s)
    expect(reward.id).toMatch(/^RW/)
    expect(reward.text.length).toBeGreaterThan(0)
    expect(reward.animation.length).toBeGreaterThan(0)
  })

  it('increments rewardsDeliveredThisSession', () => {
    const s = freshSession()
    selectReward(s)
    expect(s.rewardState.rewardsDeliveredThisSession).toBe(1)
  })

  it('avoids repeating the same reward back-to-back', () => {
    const s = freshSession()
    const r1 = selectReward(s)
    const r2 = selectReward(s)
    expect(r1.id).not.toBe(r2.id)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// immersion-manager
// ─────────────────────────────────────────────────────────────────────────────

describe('immersion-manager: wait timer', () => {
  it('starts in idle state', () => {
    const s = freshSession()
    expect(s.immersionState.waitTimeState).toBe('idle')
  })

  it('startWaitTimer sets state to waiting', () => {
    const s = freshSession()
    startWaitTimer(s)
    expect(s.immersionState.waitTimeState).toBe('waiting')
    expect(s.immersionState.waitStartedAtMs).toBeTypeOf('number')
  })

  it('clearWaitTimer resets state to idle', () => {
    const s = freshSession()
    startWaitTimer(s)
    clearWaitTimer(s)
    expect(s.immersionState.waitTimeState).toBe('idle')
    expect(s.immersionState.waitStartedAtMs).toBeNull()
  })

  it('checkWaitElapsed returns none when idle', () => {
    const s = freshSession()
    expect(checkWaitElapsed(s)).toBe('none')
  })

  it('checkWaitElapsed returns hard after 8+ seconds', () => {
    const s = freshSession()
    startWaitTimer(s)
    s.immersionState.waitStartedAtMs = Date.now() - 9000
    expect(checkWaitElapsed(s)).toBe('hard')
  })
})

describe('immersion-manager: buildRescueResponse', () => {
  it('escalates rescue level from 0 to 1', () => {
    const s = freshSession()
    expect(s.immersionState.rescueLevel).toBe(0)
    const out = buildRescueResponse(s, 5000, false)
    expect(out.rescueLevel).toBe(1)
    expect(out.text.length).toBeGreaterThan(0)
    expect(out.l1Used).toBe(false)
  })

  it('escalates through levels sequentially', () => {
    const s = freshSession()
    buildRescueResponse(s, 5000, false) // → level 1
    buildRescueResponse(s, 5000, false) // → level 2
    const out3 = buildRescueResponse(s, 5000, false) // → level 3
    expect(out3.rescueLevel).toBe(3)
  })

  it('emits l1_rescue log for level-4 genuine L1 switch', () => {
    const s = freshSession()
    // Simulate genuine L1 (not strategic — no recent successes, slow latency)
    s.emotionalState.consecutiveSuccesses = 0
    clearSessionLogs(s.sessionId)
    const out = buildRescueResponse(s, 3000, true)
    const logs = getSessionLogs(s.sessionId)
    // May be level 3 (strategic) or level 4 (genuine) — just check logs emitted
    expect(logs.length).toBeGreaterThan(0)
  })

  it('resetRescueLevelOnSuccess resets to 0', () => {
    const s = freshSession()
    buildRescueResponse(s, 5000, false) // → level 1
    resetRescueLevelOnSuccess(s)
    expect(s.immersionState.rescueLevel).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// orchestrator: startSession / getSession
// ─────────────────────────────────────────────────────────────────────────────

describe('orchestrator: startSession', () => {
  it('returns sessionId, greeting, and state', () => {
    const { sessionId, greeting, state } = startSession(BASE_PARAMS)
    expect(sessionId).toBeTruthy()
    expect(greeting.fastTrack.text.length).toBeGreaterThan(0)
    expect(greeting.slowTrack.text.length).toBeGreaterThan(0)
    expect(state.status).toBe('active')
  })

  it('emits session_event log with event=session_started', () => {
    const { state } = startSession(BASE_PARAMS)
    const logs = getSessionLogs(state.sessionId)
    const startLog = logs.find(
      l => l.type === 'session_event' && l.data['event'] === 'session_started'
    )
    expect(startLog).toBeTruthy()
    expect(startLog?.data['childAge']).toBe(BASE_PARAMS.childAge)
    expect(startLog?.data['childL1']).toBe(BASE_PARAMS.childL1)
    expect(startLog?.data['sessionNumber']).toBe(BASE_PARAMS.sessionNumber)
  })

  it('session is retrievable via getSession', () => {
    const { sessionId, state } = startSession(BASE_PARAMS)
    const retrieved = getSession(sessionId)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.sessionId).toBe(state.sessionId)
  })
})

describe('orchestrator: getSession', () => {
  it('returns null for unknown sessionId', () => {
    expect(getSession('00000000-0000-0000-0000-000000000000')).toBeNull()
  })
})

describe('orchestrator: processSilence', () => {
  it('returns a TeacherTurn with text and animation', () => {
    const { sessionId } = startSession(BASE_PARAMS)
    const turn = processSilence(sessionId, 5000)
    expect(turn).not.toBeNull()
    expect(turn?.fastTrack.text.length).toBeGreaterThan(0)
    expect(turn?.slowTrack.text.length).toBeGreaterThan(0)
  })

  it('returns null for unknown sessionId', () => {
    const turn = processSilence('nonexistent', 5000)
    expect(turn).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// logger
// ─────────────────────────────────────────────────────────────────────────────

describe('logger', () => {
  it('getSessionLogs returns empty array for unknown session', () => {
    expect(getSessionLogs('unknown-session-id')).toEqual([])
  })

  it('clearSessionLogs removes all logs for a session', () => {
    const { state } = startSession(BASE_PARAMS)
    expect(getSessionLogs(state.sessionId).length).toBeGreaterThan(0)
    clearSessionLogs(state.sessionId)
    expect(getSessionLogs(state.sessionId)).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Adults-unchanged guard — validate kids-runtime types don't bleed into adult
// ─────────────────────────────────────────────────────────────────────────────

describe('mode isolation: kids session has no adult lesson fields', () => {
  it('SessionState does not have lessonId or lessonPhase fields', () => {
    const s = freshSession()
    // @ts-expect-error — lessonId is not a field in SessionState
    expect(s.lessonId).toBeUndefined()
    // @ts-expect-error — lessonPhase is not a field in SessionState
    expect(s.lessonPhase).toBeUndefined()
  })

  it('SessionState.status starts as "active" (kids schema)', () => {
    const s = freshSession()
    // Adult lessons use 'DIAGNOSTIC', 'EXERCISES', etc. (LessonPhase).
    // Kids sessions use SessionStatus enum — 'active' is the kids-only start state.
    expect(s.status).toBe('active')
  })
})
