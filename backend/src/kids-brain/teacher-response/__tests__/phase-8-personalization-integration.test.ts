/**
 * Phase 8 — Kids Personalization V2 integration tests.
 *
 * Closes test-coverage warnings:
 *   W-019 — interest recovery injection at the ENCOURAGEMENT rung, verified at
 *           RUNTIME through processKidsBrainTurn (turn-processor Step 6C).
 *   C1–C6 — flags-on vs flags-off curriculum equivalence: the same multi-turn
 *           scenario produces IDENTICAL curriculum outcomes; only teacher TEXT
 *           may differ.
 *   W-020 — micro-dialogue logic chain (engine + caller-state contract) plus
 *           static wiring asserts on lesson-ws.ts (interception order, cooldown
 *           reset).
 *   W-022/W-023 — persona greeting/closing wiring in lesson-ws.ts (STATIC
 *           source analysis — same pattern as phase-16b-runtime-safety).
 *   W-027 — max one interest sentence per teacher turn (STATIC assert on
 *           buildKidsTurnPersonalization).
 *
 * Conventions:
 * - Runtime tests use the public Kids Brain API only (startKidsBrainSession /
 *   processKidsBrainTurn) — same harness pattern as phase-19-mvp-scenarios.
 * - lesson-ws.ts wiring is verified by static source analysis (regex over the
 *   file) — no WebSocket mocks (pattern from phase-16b-runtime-safety).
 * - All feature-flag env vars are cleared in afterEach so other suites are
 *   unaffected.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  startKidsBrainSession,
  processKidsBrainTurn,
  RuntimeActionPacketType,
} from '../../runtime/index.js'
import type {
  KidsBrainSessionStartInput,
  KidsBrainTurnInput,
  RuntimeTurnResult,
} from '../../runtime/index.js'
import { AgeBand } from '../../shared/enums.js'
import { AGE_PROFILE_6_7 } from '../../shared/types.js'
import type { STTResult } from '../../contracts/stt-result.js'
import type { SessionMemory } from '../../contracts/session-memory.js'
import {
  buildMicroDialogueTurn,
  buildMicroDialogueReturnPhrase,
  createInitialPersonalizationState,
  isMicroDialogueInProgress,
  MICRO_DIALOGUE_COOLDOWN_EXERCISES,
} from '../personalization-engine.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const COLOUR_WORDS = ['blue', 'green', 'pink', 'purple', 'orange', 'red', 'yellow']
const SESSION_ID = 'qa-phase-8-personalization'
const TIMESTAMP = '2026-06-12T07:00:00.000Z'

const BLUE_EXERCISE_ID = 'kb1-u01-l02-ex-02-blue'
const GREEN_EXERCISE_ID = 'kb1-u01-l02-ex-03-green'

/** Standard ENCOURAGEMENT-rung text from exercise-runner buildEscalationTeacherText. */
const STANDARD_ENCOURAGEMENT_TEXT = 'You can do it! Try one more time — blue!'
/** Roblox interest recovery template (personalization-engine RECOVERY_TEMPLATES). */
const ROBLOX_RECOVERY_TEXT = "Let's try again! Imagine your Roblox world. Say blue!"

// ── Feature flag helpers (mirror personalization-engine.test.ts) ──────────────

const ALL_PERSONALIZATION_FLAGS = [
  'KIDS_PERSONALIZATION_V2',
  'KIDS_WARMUP_ENABLED',
  'KIDS_INTEREST_EXAMPLES_V2',
  'KIDS_INTEREST_PRAISE',
  'KIDS_INTEREST_RECOVERY_V2',
  'KIDS_MICRO_DIALOGUE_ENABLED',
  'KIDS_TEACHER_PERSONA_V2',
] as const

function enableAllFlags(): void {
  for (const flag of ALL_PERSONALIZATION_FLAGS) process.env[flag] = 'true'
}

function withRecoveryFlags(): void {
  process.env.KIDS_PERSONALIZATION_V2 = 'true'
  process.env.KIDS_INTEREST_RECOVERY_V2 = 'true'
}

function withMicroDialogueFlags(): void {
  process.env.KIDS_PERSONALIZATION_V2 = 'true'
  process.env.KIDS_MICRO_DIALOGUE_ENABLED = 'true'
}

function clearFlags(): void {
  for (const flag of ALL_PERSONALIZATION_FLAGS) delete process.env[flag]
}

// ── Runtime harness (mirror phase-19-mvp-scenarios) ───────────────────────────

const BASE_START: KidsBrainSessionStartInput = {
  sessionId: SESSION_ID,
  userId: 'user-phase-8',
  childId: 'child-phase-8',
  childFirstName: 'Alex',
  ageBand: AgeBand.SIX_SEVEN,
  ageProfile: AGE_PROFILE_6_7,
  lessonTargetWords: [...COLOUR_WORDS],
  unitReviewWords: [],
  characterNames: ['milo'],
  timestamp: TIMESTAMP,
}

function makeStt(text: string, confidence = 0.90): STTResult {
  return {
    text,
    confidence,
    languageCode: 'en-US',
    alternatives: [],
    speechStartMs: 100,
    speechEndMs: 800,
    speechDurationMs: 700,
    audioEnergyLevel: 0.75,
    provider: 'google_chirp_v2',
    providerRequestId: 'req-phase-8',
    processingLatencyMs: 50,
  }
}

function makeSilentStt(): STTResult {
  return {
    text: null,
    confidence: null,
    languageCode: null,
    alternatives: [],
    speechStartMs: null,
    speechEndMs: null,
    speechDurationMs: null,
    audioEnergyLevel: null,
    provider: 'google_chirp_v2',
    providerRequestId: 'req-phase-8-silence',
    processingLatencyMs: 10,
  }
}

function makeTurn(
  mem: SessionMemory,
  text: string,
  overrides: Partial<KidsBrainTurnInput> = {},
): KidsBrainTurnInput {
  return {
    sessionMemory: mem,
    sttResult: makeStt(text),
    responseLatencyMs: 900,
    silenceDurationMs: 0,
    attemptCount: mem.currentItemAttemptCount,
    targetWord: mem.currentTargetItemId ?? COLOUR_WORDS[0] ?? null,
    childFirstName: 'Alex',
    lessonTargetWords: [...COLOUR_WORDS],
    unitReviewWords: [],
    characterNames: ['milo'],
    timestamp: TIMESTAMP,
    ...overrides,
  }
}

function makeSilentTurn(mem: SessionMemory): KidsBrainTurnInput {
  return makeTurn(mem, '', {
    sttResult: makeSilentStt(),
    responseLatencyMs: null,
    silenceDurationMs: 8000,
  })
}

/**
 * Start a session with the profile snapshot + V2 personalization state attached,
 * mirroring exactly what lesson-ws.ts does at session start (childName,
 * teacherId, interests, createInitialPersonalizationState).
 */
function startPersonalizedSession(interests: string[]): SessionMemory {
  const { sessionMemory } = startKidsBrainSession(BASE_START)
  sessionMemory.childName = 'Alex'
  sessionMemory.teacherId = 'lucy'
  sessionMemory.interests = interests
  sessionMemory.personalization = createInitialPersonalizationState()
  return sessionMemory
}

/**
 * Curriculum fingerprint of one turn result — every field personalization must
 * NEVER influence (C1–C6 / C4). Teacher text is deliberately excluded.
 */
function curriculumFingerprint(r: RuntimeTurnResult): Record<string, unknown> {
  const m = r.updatedSessionMemory
  return {
    classificationLabel: r.classificationResult.label,
    eligibleForProgression: r.classificationResult.eligibleForProgression,
    shouldCloseSession: r.shouldCloseSession,
    turnNumber: r.turnNumber,
    currentExerciseId: m.currentExerciseId ?? null,
    currentExerciseOrder: m.currentExerciseOrder ?? null,
    exerciseAttemptCount: m.exerciseAttemptCount ?? null,
    exerciseCorrectCount: m.exerciseCorrectCount ?? null,
    currentTargetItemId: m.currentTargetItemId ?? null,
    completedExerciseIds: m.completedExerciseIds ?? [],
    hasStartedFirstExercise: m.hasStartedFirstExercise === true,
  }
}

/**
 * Drive a fresh session to the ENCOURAGEMENT escalation rung of the first real
 * exercise (kb1-u01-l02-ex-02-blue, ladder: REPEAT_PROMPT → MODEL_ANSWER →
 * ENCOURAGEMENT → MOVE_ON):
 *   readiness "Yes" → wrong#1 (attempt 1, rung skipped — natural response)
 *   → wrong#2 (attempt 2, MODEL_ANSWER rung) → wrong#3 (attempt 3,
 *   ENCOURAGEMENT rung — recovery injection point).
 */
async function driveToEncouragementRung(interests: string[]): Promise<{
  ready: RuntimeTurnResult
  wrong1: RuntimeTurnResult
  wrong2: RuntimeTurnResult
  wrong3: RuntimeTurnResult
}> {
  const mem = startPersonalizedSession(interests)
  const ready = await processKidsBrainTurn(makeTurn(mem, 'Yes'))
  const wrong1 = await processKidsBrainTurn(
    makeTurn(ready.updatedSessionMemory, 'red', { targetWord: 'blue' }),
  )
  const wrong2 = await processKidsBrainTurn(
    makeTurn(wrong1.updatedSessionMemory, 'red', { targetWord: 'blue' }),
  )
  const wrong3 = await processKidsBrainTurn(
    makeTurn(wrong2.updatedSessionMemory, 'red', { targetWord: 'blue' }),
  )
  return { ready, wrong1, wrong2, wrong3 }
}

// ── Static source (lesson-ws.ts) — read once, analysed by regex only ──────────

const wsPath = resolve(__dirname, '../../../ws/lesson-ws.ts')
const wsContent = readFileSync(wsPath, 'utf-8')

function extractFunctionBody(name: string): string {
  const re = new RegExp(`(?:async )?function ${name}[\\s\\S]*?\\n\\}`)
  const match = wsContent.match(re)
  expect(match, `function ${name} not found in lesson-ws.ts`).not.toBeNull()
  return match![0]
}

// ═══════════════════════════════════════════════════════════════════════════════
// W-019 — interest recovery injection at the ENCOURAGEMENT rung (RUNTIME)
// ═══════════════════════════════════════════════════════════════════════════════

describe('W-019 — runtime recovery injection at ENCOURAGEMENT rung (turn-processor Step 6C)', () => {
  afterEach(clearFlags)

  it('flags on + interests: ENCOURAGEMENT-rung teacher text is the interest recovery ending with "Say blue!"', async () => {
    withRecoveryFlags()
    const { wrong3 } = await driveToEncouragementRung(['roblox'])

    // attempt 3 just made → attemptJustMade=2 → ladder[2] = ENCOURAGEMENT
    expect(wrong3.updatedSessionMemory.exerciseAttemptCount).toBe(3)
    expect(wrong3.updatedSessionMemory.currentExerciseId).toBe(BLUE_EXERCISE_ID)
    expect(wrong3.teacherResponsePlan.mainText).toBe(ROBLOX_RECOVERY_TEXT)
    expect(wrong3.teacherResponsePlan.mainText).toMatch(/Say blue!$/)
  })

  it('flags on: the TEACHER_TEXT action packet carries the same recovery text', async () => {
    withRecoveryFlags()
    const { wrong3 } = await driveToEncouragementRung(['roblox'])
    const teacherPacket = wrong3.actionPackets.find(
      p => p.packetType === RuntimeActionPacketType.TEACHER_TEXT,
    )
    expect(teacherPacket).toBeDefined()
    expect(teacherPacket!.teacherText).toBe(ROBLOX_RECOVERY_TEXT)
  })

  it('flags off (same inputs incl. interests): ENCOURAGEMENT rung uses the standard escalation text', async () => {
    clearFlags()
    const { wrong3 } = await driveToEncouragementRung(['roblox'])
    expect(wrong3.teacherResponsePlan.mainText).toBe(STANDARD_ENCOURAGEMENT_TEXT)
  })

  it('flags on but no interests: standard escalation text is kept (engine returns null)', async () => {
    withRecoveryFlags()
    const { wrong3 } = await driveToEncouragementRung([])
    expect(wrong3.teacherResponsePlan.mainText).toBe(STANDARD_ENCOURAGEMENT_TEXT)
  })

  it('R3: recovery replaces ONLY the ENCOURAGEMENT rung — MODEL_ANSWER rung text is identical flags-on vs flags-off', async () => {
    withRecoveryFlags()
    const onRun = await driveToEncouragementRung(['roblox'])
    clearFlags()
    const offRun = await driveToEncouragementRung(['roblox'])
    expect(onRun.wrong2.teacherResponsePlan.mainText).toBe(offRun.wrong2.teacherResponsePlan.mainText)
  })

  it('C4 (critical): ladder position, exerciseCorrectCount, exerciseAttemptCount, currentExerciseId identical flags-on vs flags-off', async () => {
    withRecoveryFlags()
    const onRun = await driveToEncouragementRung(['roblox'])
    clearFlags()
    const offRun = await driveToEncouragementRung(['roblox'])

    const on = onRun.wrong3.updatedSessionMemory
    const off = offRun.wrong3.updatedSessionMemory

    // Ladder rung is derived from exerciseAttemptCount (attemptJustMade = count - 1).
    expect(on.exerciseAttemptCount).toBe(off.exerciseAttemptCount)
    expect((on.exerciseAttemptCount ?? 0) - 1).toBe((off.exerciseAttemptCount ?? 0) - 1)
    expect(on.exerciseCorrectCount).toBe(off.exerciseCorrectCount)
    expect(on.currentExerciseId).toBe(off.currentExerciseId)
    // And the full curriculum fingerprint of every turn matches.
    expect(curriculumFingerprint(onRun.wrong3)).toEqual(curriculumFingerprint(offRun.wrong3))
    expect(curriculumFingerprint(onRun.wrong2)).toEqual(curriculumFingerprint(offRun.wrong2))
    expect(curriculumFingerprint(onRun.wrong1)).toEqual(curriculumFingerprint(offRun.wrong1))
  })

  it('recovery text never modifies the target word — exercise still expects "blue" after injection', async () => {
    withRecoveryFlags()
    const { wrong3 } = await driveToEncouragementRung(['roblox'])
    expect(wrong3.updatedSessionMemory.currentTargetItemId).toBe('blue')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// C1–C6 — flags-on vs flags-off curriculum equivalence (RUNTIME, multi-turn)
// ═══════════════════════════════════════════════════════════════════════════════

describe('C1–C6 — full-scenario curriculum equivalence: all flags on vs all off', () => {
  afterEach(clearFlags)

  /**
   * Scenario: readiness → correct "blue" (1/2) → wrong "red" → silence (8s,
   * no transcript) → correct "blue" (2/2 → exercise advances to green).
   */
  async function runScenario(): Promise<RuntimeTurnResult[]> {
    const mem = startPersonalizedSession(['roblox', 'space'])
    const results: RuntimeTurnResult[] = []

    const ready = await processKidsBrainTurn(makeTurn(mem, 'Yes'))
    results.push(ready)

    const correct1 = await processKidsBrainTurn(
      makeTurn(ready.updatedSessionMemory, 'Blue.', {
        targetWord: 'blue',
        sttResult: makeStt('Blue.', 0.92),
      }),
    )
    results.push(correct1)

    const wrong = await processKidsBrainTurn(
      makeTurn(correct1.updatedSessionMemory, 'red', { targetWord: 'blue' }),
    )
    results.push(wrong)

    const silence = await processKidsBrainTurn(makeSilentTurn(wrong.updatedSessionMemory))
    results.push(silence)

    const correct2 = await processKidsBrainTurn(
      makeTurn(silence.updatedSessionMemory, 'Blue.', {
        targetWord: 'blue',
        sttResult: makeStt('Blue.', 0.92),
      }),
    )
    results.push(correct2)

    return results
  }

  it('curriculum outcomes are IDENTICAL turn-by-turn (exercise progression, counters, labels, shouldCloseSession)', async () => {
    enableAllFlags()
    const flagsOn = await runScenario()
    clearFlags()
    const flagsOff = await runScenario()

    expect(flagsOn.length).toBe(flagsOff.length)
    for (let i = 0; i < flagsOn.length; i++) {
      expect(
        curriculumFingerprint(flagsOn[i]!),
        `turn ${i + 1} curriculum fingerprint diverged between flags-on and flags-off`,
      ).toEqual(curriculumFingerprint(flagsOff[i]!))
    }
  })

  it('both runs end with the same exercise progression: blue exercise completed, green active, counters reset', async () => {
    enableAllFlags()
    const flagsOn = await runScenario()
    clearFlags()
    const flagsOff = await runScenario()

    for (const run of [flagsOn, flagsOff]) {
      const finalMem = run[run.length - 1]!.updatedSessionMemory
      expect(finalMem.currentExerciseId).toBe(GREEN_EXERCISE_ID)
      expect(finalMem.completedExerciseIds).toContain(BLUE_EXERCISE_ID)
      expect(finalMem.exerciseAttemptCount).toBe(0)
      expect(finalMem.exerciseCorrectCount).toBe(0)
      expect(finalMem.currentTargetItemId).toBe('green')
      expect(run[run.length - 1]!.shouldCloseSession).toBe(false)
    }
  })

  it('classification labels are identical across runs (personalization never reaches the classifier)', async () => {
    enableAllFlags()
    const flagsOn = await runScenario()
    clearFlags()
    const flagsOff = await runScenario()
    expect(flagsOn.map(r => r.classificationResult.label)).toEqual(
      flagsOff.map(r => r.classificationResult.label),
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// W-020 — micro-dialogue logic chain (engine + caller state contract)
// ═══════════════════════════════════════════════════════════════════════════════

describe('W-020 — micro-dialogue full logic chain (engine + lesson-ws caller contract)', () => {
  afterEach(clearFlags)

  it('cooldown=3 fire → in-progress → return phrase → clear → eligible again only after 3 increments', () => {
    withMicroDialogueFlags()
    const state = createInitialPersonalizationState()
    const interests = ['roblox']

    // 1. cooldown reaches 3 → buildMicroDialogueTurn fires
    state.microDialogueCooldown = MICRO_DIALOGUE_COOLDOWN_EXERCISES
    const dialogue = buildMicroDialogueTurn(interests, state)
    expect(dialogue).not.toBeNull()
    expect(dialogue!.tier).toBe('MICRO_DIALOGUE')
    expect(dialogue!.shouldContinue).toBe(true)

    // 2. caller (maybeFireKidsMicroDialogue) sets inProgress=true, cooldown=0
    state.microDialogueCooldown = 0
    state.microDialogueInProgress = true
    state.lastInterestUsed = dialogue!.interestUsed
    state.interestRotationIndex++

    // 3. in-progress detection — lesson-ws intercepts the next child turn
    expect(isMicroDialogueInProgress(state)).toBe(true)

    // 3b. no second dialogue can fire while one is in progress
    state.microDialogueCooldown = MICRO_DIALOGUE_COOLDOWN_EXERCISES
    expect(buildMicroDialogueTurn(interests, state)).toBeNull()
    state.microDialogueCooldown = 0

    // 4. reply handling — return phrase re-invites the current target word
    const returnPhrase = buildMicroDialogueReturnPhrase('blue')
    expect(returnPhrase).toContain('blue')
    expect(returnPhrase.toLowerCase()).toContain('lesson')

    // 5. caller (handleKidsMicroDialogueReply) clears inProgress
    state.microDialogueInProgress = false
    expect(isMicroDialogueInProgress(state)).toBe(false)

    // 6. eligible again ONLY after 3 more exercise-advance increments
    for (let i = 1; i <= MICRO_DIALOGUE_COOLDOWN_EXERCISES; i++) {
      state.microDialogueCooldown++
      const next = buildMicroDialogueTurn(interests, state)
      if (i < MICRO_DIALOGUE_COOLDOWN_EXERCISES) {
        expect(next, `must NOT fire at cooldown=${i}`).toBeNull()
      } else {
        expect(next, `must fire again at cooldown=${i}`).not.toBeNull()
      }
    }
  })

  it('return phrase falls back to a generic close-out when no target word is active', () => {
    expect(buildMicroDialogueReturnPhrase(null)).toBe('Nice! Back to our lesson!')
  })

  // ── Static wiring asserts on lesson-ws.ts ───────────────────────────────────

  it('static: micro-dialogue interception appears BEFORE the processKidsBrainTurn call inside processKidsBrainV1Turn', () => {
    const fnBody = extractFunctionBody('processKidsBrainV1Turn')
    const interceptIdx = fnBody.indexOf('isMicroDialogueInProgress(personState)')
    const replyIdx = fnBody.indexOf('handleKidsMicroDialogueReply')
    const brainTurnIdx = fnBody.indexOf('await processKidsBrainTurn(')
    expect(interceptIdx).toBeGreaterThan(0)
    expect(replyIdx).toBeGreaterThan(0)
    expect(brainTurnIdx).toBeGreaterThan(interceptIdx)
    expect(brainTurnIdx).toBeGreaterThan(replyIdx)
  })

  it('static: the interception block returns before Kids Brain scoring (reply is never scored)', () => {
    const fnBody = extractFunctionBody('processKidsBrainV1Turn')
    const interceptIdx = fnBody.indexOf('isMicroDialogueInProgress(personState)')
    const brainTurnIdx = fnBody.indexOf('await processKidsBrainTurn(')
    const interceptBlock = fnBody.slice(interceptIdx, brainTurnIdx)
    expect(interceptBlock).toContain('handleKidsMicroDialogueReply')
    expect(interceptBlock).toContain('return')
  })

  it('static: maybeFireKidsMicroDialogue resets cooldown to 0 after the dialogue fires', () => {
    const fnBody = extractFunctionBody('maybeFireKidsMicroDialogue')
    expect(fnBody).toContain('v2State.microDialogueCooldown = 0')
    // Reset happens AFTER the engine fired (post buildMicroDialogueTurn call)
    const buildIdx = fnBody.indexOf('buildMicroDialogueTurn(')
    const resetIdx = fnBody.indexOf('v2State.microDialogueCooldown = 0')
    expect(buildIdx).toBeGreaterThan(0)
    expect(resetIdx).toBeGreaterThan(buildIdx)
    // And the in-progress latch is set so the next child turn is intercepted
    expect(fnBody).toContain('v2State.microDialogueInProgress = true')
  })

  it('static: cooldown increments on each exercise advance before eligibility is evaluated', () => {
    const fnBody = extractFunctionBody('maybeFireKidsMicroDialogue')
    const incrementIdx = fnBody.indexOf('v2State.microDialogueCooldown = (v2State.microDialogueCooldown ?? 0) + 1')
    const buildIdx = fnBody.indexOf('buildMicroDialogueTurn(')
    expect(incrementIdx).toBeGreaterThan(0)
    expect(buildIdx).toBeGreaterThan(incrementIdx)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// W-022 / W-023 — persona greeting and closing wiring (STATIC source analysis)
// ═══════════════════════════════════════════════════════════════════════════════

describe('W-022 — persona greeting wiring in lesson-ws.ts (static)', () => {
  it('buildPersonaGreeting is called in the session-start path (after startKidsBrainSession)', () => {
    const fnBody = extractFunctionBody('handleKidsBrainV1LessonStart')
    const startIdx = fnBody.indexOf('startKidsBrainSession(')
    const greetingIdx = fnBody.indexOf('buildPersonaGreeting(')
    expect(startIdx).toBeGreaterThan(0)
    expect(greetingIdx).toBeGreaterThan(startIdx)
  })

  it('the greeting result only ever assigns to .teacherText (text-only replacement)', () => {
    const assignments = wsContent.match(/[\w$]+(?:\.[\w$]+)*\s*=\s*personaGreeting\b/g) ?? []
    expect(assignments.length).toBeGreaterThan(0)
    for (const assignment of assignments) {
      expect(
        assignment,
        `personaGreeting must only be assigned to .teacherText, found: "${assignment}"`,
      ).toMatch(/\.teacherText\s*=\s*personaGreeting$/)
    }
  })

  it('the greeting replacement is guarded (null keeps the standard scripted greeting)', () => {
    const fnBody = extractFunctionBody('handleKidsBrainV1LessonStart')
    expect(fnBody).toContain('if (personaGreeting)')
  })
})

describe('W-023 — persona closing wiring in lesson-ws.ts (static)', () => {
  /** Natural-close branch: from the close log line to the final ws.close. */
  function naturalCloseBlock(): string {
    const start = wsContent.indexOf('session_closed_naturally')
    const end = wsContent.indexOf("ws.close(1000, 'Session complete')", start)
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
    return wsContent.slice(start, end)
  }

  it('maybeSpeakKidsPersonaClosing is called inside the natural-close branch', () => {
    expect(naturalCloseBlock()).toContain('maybeSpeakKidsPersonaClosing')
  })

  it('the closing is spoken BEFORE analytics finalization (persistKidsBrainAnalytics)', () => {
    const block = naturalCloseBlock()
    const closingIdx = block.indexOf('maybeSpeakKidsPersonaClosing')
    const analyticsIdx = block.indexOf('persistKidsBrainAnalytics')
    expect(closingIdx).toBeGreaterThanOrEqual(0)
    expect(analyticsIdx).toBeGreaterThan(closingIdx)
  })

  it('the closing is spoken BEFORE the lesson_end send in that block', () => {
    const block = naturalCloseBlock()
    const closingIdx = block.indexOf('maybeSpeakKidsPersonaClosing')
    const lessonEndIdx = block.indexOf("type: 'lesson_end'")
    expect(closingIdx).toBeGreaterThanOrEqual(0)
    expect(lessonEndIdx).toBeGreaterThan(closingIdx)
  })

  it('maybeSpeakKidsPersonaClosing early-returns when buildPersonaClosing yields null', () => {
    const fnBody = extractFunctionBody('maybeSpeakKidsPersonaClosing')
    const buildIdx = fnBody.indexOf('buildPersonaClosing(')
    const guardIdx = fnBody.indexOf('if (!closing) return')
    const sendIdx = fnBody.indexOf('send(')
    expect(buildIdx).toBeGreaterThan(0)
    expect(guardIdx).toBeGreaterThan(buildIdx)
    expect(sendIdx).toBeGreaterThan(guardIdx)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// W-027 — at most ONE interest sentence per teacher turn (STATIC)
// ═══════════════════════════════════════════════════════════════════════════════

describe('W-027 — single interest sentence per turn (static, buildKidsTurnPersonalization)', () => {
  it('leadText is forced to null whenever a micro-dialogue fires on the same turn', () => {
    const fnBody = extractFunctionBody('buildKidsTurnPersonalization')
    // The ternary: micro-dialogue takes the turn's single interest-sentence
    // budget; the example/praise lead-in is suppressed.
    expect(fnBody).toMatch(
      /const leadText = microDialogueText\s*\?\s*null\s*:\s*buildKidsPersonalizationLeadIn\(/,
    )
  })

  it('the function returns exactly the two text slots (no third interest channel)', () => {
    const fnBody = extractFunctionBody('buildKidsTurnPersonalization')
    expect(fnBody).toContain('return { leadText, microDialogueText }')
  })
})
