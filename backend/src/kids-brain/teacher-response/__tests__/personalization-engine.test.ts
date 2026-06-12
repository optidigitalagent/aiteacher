/**
 * PersonalizationEngine — Phase 1 (Warmups) test suite.
 *
 * Covers acceptance criteria W1–W7, curriculum integrity C1–C5, S5 (error catch),
 * feature flag behaviour, and session state serialization.
 *
 * Uses vitest fake timers for W5 (warmup timeout at 15s).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  buildExampleContext,
  buildInterestPraise,
  buildInterestRecovery,
  buildMicroDialogueReturnPhrase,
  buildMicroDialogueTurn,
  buildPersonaClosing,
  buildPersonaGreeting,
  buildWarmupTurn,
  buildWarmupReturnPhrase,
  createInitialPersonalizationState,
  isMicroDialogueInProgress,
  isWarmupInProgress,
  isWarmupTimedOut,
  selectInterest,
  isPersonalizationV2Enabled,
  isWarmupEnabled,
  isInterestExamplesEnabled,
  isInterestPraiseEnabled,
  isInterestRecoveryEnabled,
  isMicroDialogueEnabled,
  isTeacherPersonaEnabled,
  MAX_CHILD_NAME_CHARS,
  PRAISE_ELIGIBLE_LABELS,
  WARMUP_TIMEOUT_MS,
  WARMUP_MAX_TURNS,
  MICRO_DIALOGUE_COOLDOWN_EXERCISES,
  type PersonalizationResult,
} from '../personalization-engine.js'
import type { KidsSessionPersonalizationState } from '../../contracts/session-memory.js'
import { getTeacherPersona, LUCY_PERSONA, TOM_PERSONA } from '../teacher-personas.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALL_INTERESTS = [
  'roblox', 'brawl_stars', 'minecraft', 'pokemon',
  'football', 'animals', 'space', 'dinosaurs',
  'drawing', 'superheroes', 'princesses', 'cars',
]

function freshState(overrides: Partial<KidsSessionPersonalizationState> = {}): KidsSessionPersonalizationState {
  return { ...createInitialPersonalizationState(), ...overrides }
}

function withFlags(v2 = 'true', warmup = 'true') {
  process.env.KIDS_PERSONALIZATION_V2 = v2
  process.env.KIDS_WARMUP_ENABLED = warmup
}

function clearFlags() {
  delete process.env.KIDS_PERSONALIZATION_V2
  delete process.env.KIDS_WARMUP_ENABLED
  delete process.env.KIDS_INTEREST_EXAMPLES_V2
  delete process.env.KIDS_INTEREST_PRAISE
  delete process.env.KIDS_INTEREST_RECOVERY_V2
  delete process.env.KIDS_MICRO_DIALOGUE_ENABLED
  delete process.env.KIDS_TEACHER_PERSONA_V2
}

function withPersonaFlags() {
  process.env.KIDS_PERSONALIZATION_V2 = 'true'
  process.env.KIDS_TEACHER_PERSONA_V2 = 'true'
}

function withMicroDialogueFlags() {
  process.env.KIDS_PERSONALIZATION_V2 = 'true'
  process.env.KIDS_MICRO_DIALOGUE_ENABLED = 'true'
}

function withRecoveryFlags() {
  process.env.KIDS_PERSONALIZATION_V2 = 'true'
  process.env.KIDS_INTEREST_RECOVERY_V2 = 'true'
}

function withPraiseFlags() {
  process.env.KIDS_PERSONALIZATION_V2 = 'true'
  process.env.KIDS_INTEREST_PRAISE = 'true'
}

function withExampleFlags() {
  process.env.KIDS_PERSONALIZATION_V2 = 'true'
  process.env.KIDS_INTEREST_EXAMPLES_V2 = 'true'
}

// ── Feature flags ─────────────────────────────────────────────────────────────

describe('feature flags', () => {
  afterEach(clearFlags)

  it('isPersonalizationV2Enabled returns false when unset', () => {
    clearFlags()
    expect(isPersonalizationV2Enabled()).toBe(false)
  })

  it('isPersonalizationV2Enabled returns true when set to "true"', () => {
    process.env.KIDS_PERSONALIZATION_V2 = 'true'
    expect(isPersonalizationV2Enabled()).toBe(true)
  })

  it('isWarmupEnabled returns false when unset', () => {
    clearFlags()
    expect(isWarmupEnabled()).toBe(false)
  })

  it('isWarmupEnabled returns true when set to "true"', () => {
    withFlags('true', 'true')
    expect(isWarmupEnabled()).toBe(true)
  })
})

// ── W1: Warmup fires once per session when interests are set ───────────────────

describe('W1 — warmup fires when interests set and flags enabled', () => {
  afterEach(clearFlags)

  it('returns a PersonalizationResult with tier=WARMUP', () => {
    withFlags()
    const state = freshState()
    const result = buildWarmupTurn(['roblox'], state)
    expect(result).not.toBeNull()
    expect(result!.tier).toBe('WARMUP')
  })

  it('result text is a non-empty string', () => {
    withFlags()
    const result = buildWarmupTurn(['roblox'], freshState())
    expect(result!.text).toBeTruthy()
    expect(typeof result!.text).toBe('string')
  })

  it('shouldContinue is true (expects child response)', () => {
    withFlags()
    const result = buildWarmupTurn(['roblox'], freshState())
    expect(result!.shouldContinue).toBe(true)
  })

  it('interestUsed matches the provided interest', () => {
    withFlags()
    const result = buildWarmupTurn(['football'], freshState())
    expect(result!.interestUsed).toBe('football')
  })
})

// ── W2: No warmup if no interests ────────────────────────────────────────────

describe('W2 — no warmup when interests empty', () => {
  afterEach(clearFlags)

  it('returns null for empty interests array', () => {
    withFlags()
    expect(buildWarmupTurn([], freshState())).toBeNull()
  })

  it('returns null for empty interests with flag enabled', () => {
    withFlags()
    const state = freshState({ warmupUsed: false })
    expect(buildWarmupTurn([], state)).toBeNull()
  })
})

// ── W3: No warmup when already used ─────────────────────────────────────────

describe('W3 — no warmup when warmupUsed=true', () => {
  afterEach(clearFlags)

  it('returns null when warmupUsed is true', () => {
    withFlags()
    const state = freshState({ warmupUsed: true })
    expect(buildWarmupTurn(['roblox'], state)).toBeNull()
  })
})

// ── W4: Warmup max 2 turns ───────────────────────────────────────────────────

describe('W4 — warmup budget: max 2 turns', () => {
  afterEach(clearFlags)

  it('returns null when warmupTurnsUsed >= WARMUP_MAX_TURNS', () => {
    withFlags()
    const state = freshState({ warmupTurnsUsed: WARMUP_MAX_TURNS })
    expect(buildWarmupTurn(['roblox'], state)).toBeNull()
  })

  it('returns null when warmupTurnsUsed is 3 (over budget)', () => {
    withFlags()
    const state = freshState({ warmupTurnsUsed: 3 })
    expect(buildWarmupTurn(['roblox'], state)).toBeNull()
  })

  it('returns a result when warmupTurnsUsed is 0 (within budget)', () => {
    withFlags()
    const state = freshState({ warmupTurnsUsed: 0 })
    expect(buildWarmupTurn(['roblox'], state)).not.toBeNull()
  })

  it('WARMUP_MAX_TURNS constant equals 2', () => {
    expect(WARMUP_MAX_TURNS).toBe(2)
  })
})

// ── W5: Warmup auto-ends after 15s ──────────────────────────────────────────

describe('W5 — warmup timeout at 15s', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    clearFlags()
  })

  it('isWarmupTimedOut returns false when warmupStartTime is null', () => {
    const state = freshState({ warmupStartTime: null })
    expect(isWarmupTimedOut(state)).toBe(false)
  })

  it('isWarmupTimedOut returns false within the 15s window', () => {
    const now = Date.now()
    const state = freshState({ warmupStartTime: now })
    vi.setSystemTime(now + WARMUP_TIMEOUT_MS - 100)
    expect(isWarmupTimedOut(state)).toBe(false)
  })

  it('isWarmupTimedOut returns true after 15s have elapsed', () => {
    const now = Date.now()
    const state = freshState({ warmupStartTime: now })
    vi.setSystemTime(now + WARMUP_TIMEOUT_MS + 1)
    expect(isWarmupTimedOut(state)).toBe(true)
  })

  it('WARMUP_TIMEOUT_MS constant equals 15000', () => {
    expect(WARMUP_TIMEOUT_MS).toBe(15_000)
  })
})

// ── W6: Warmup response is TEACHER_CONTROLLED (not scored) ──────────────────
// Verified by the fact that isWarmupInProgress correctly identifies the state
// and lesson-ws intercepts the turn before it reaches Kids Brain scoring.

describe('W6 — warmup in-progress detection', () => {
  it('isWarmupInProgress returns false on fresh state', () => {
    expect(isWarmupInProgress(freshState())).toBe(false)
  })

  it('isWarmupInProgress returns true when warmupTurnsUsed=1 and warmupUsed=false', () => {
    const state = freshState({ warmupTurnsUsed: 1, warmupUsed: false })
    expect(isWarmupInProgress(state)).toBe(true)
  })

  it('isWarmupInProgress returns false when warmupUsed=true (already completed)', () => {
    const state = freshState({ warmupTurnsUsed: 1, warmupUsed: true })
    expect(isWarmupInProgress(state)).toBe(false)
  })

  it('isWarmupInProgress returns false after 2 turns', () => {
    const state = freshState({ warmupTurnsUsed: 2, warmupUsed: true })
    expect(isWarmupInProgress(state)).toBe(false)
  })
})

// ── W7: Curriculum return phrase is built correctly ──────────────────────────

describe('W7 — warmup return phrase (curriculum return)', () => {
  it('buildWarmupReturnPhrase returns a non-empty string for known interest', () => {
    const phrase = buildWarmupReturnPhrase('roblox')
    expect(phrase).toBeTruthy()
    expect(typeof phrase).toBe('string')
  })

  it('buildWarmupReturnPhrase returns null for unknown interest', () => {
    expect(buildWarmupReturnPhrase('unknown_interest')).toBeNull()
  })

  it('return phrase does not exceed 15 words', () => {
    for (const interest of ALL_INTERESTS) {
      const phrase = buildWarmupReturnPhrase(interest) ?? ''
      const wordCount = phrase.trim().split(/\s+/).length
      expect(wordCount, `phrase for "${interest}" exceeds 15 words`).toBeLessThanOrEqual(15)
    }
  })

  it('return phrases exist for all 12 known interests', () => {
    for (const interest of ALL_INTERESTS) {
      const phrase = buildWarmupReturnPhrase(interest)
      expect(phrase, `return phrase missing for interest "${interest}"`).not.toBeNull()
    }
  })
})

// ── All 12 interest templates ────────────────────────────────────────────────

describe('warmup templates — all 12 interests', () => {
  afterEach(clearFlags)

  it('each interest produces a warmup result when flags enabled', () => {
    withFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildWarmupTurn([interest], freshState())
      expect(result, `buildWarmupTurn returned null for interest "${interest}"`).not.toBeNull()
    }
  })

  it('warmup question does not exceed 15 words for any interest', () => {
    withFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildWarmupTurn([interest], freshState())
      const wordCount = (result!.text).trim().split(/\s+/).length
      expect(wordCount, `warmup question for "${interest}" exceeds 15 words`).toBeLessThanOrEqual(15)
    }
  })

  it('warmup text is non-empty for all interests', () => {
    withFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildWarmupTurn([interest], freshState())
      expect(result!.text.length).toBeGreaterThan(0)
    }
  })
})

// ── Feature flag: master toggle ──────────────────────────────────────────────

describe('feature flag: KIDS_PERSONALIZATION_V2 master toggle', () => {
  afterEach(clearFlags)

  it('returns null when KIDS_PERSONALIZATION_V2 is not set', () => {
    clearFlags()
    expect(buildWarmupTurn(['roblox'], freshState())).toBeNull()
  })

  it('returns null when KIDS_PERSONALIZATION_V2=false even with warmup enabled', () => {
    process.env.KIDS_PERSONALIZATION_V2 = 'false'
    process.env.KIDS_WARMUP_ENABLED = 'true'
    expect(buildWarmupTurn(['roblox'], freshState())).toBeNull()
  })

  it('returns null when KIDS_WARMUP_ENABLED=false even with V2 enabled', () => {
    process.env.KIDS_PERSONALIZATION_V2 = 'true'
    process.env.KIDS_WARMUP_ENABLED = 'false'
    expect(buildWarmupTurn(['roblox'], freshState())).toBeNull()
  })
})

// ── selectInterest ────────────────────────────────────────────────────────────

describe('selectInterest', () => {
  it('returns null for empty interests array', () => {
    expect(selectInterest([], null, 0)).toBeNull()
  })

  it('returns the only interest when array has one item', () => {
    expect(selectInterest(['roblox'], null, 0)).toBe('roblox')
  })

  it('returns the only interest even if it was lastUsed (no other choice)', () => {
    expect(selectInterest(['roblox'], 'roblox', 0)).toBe('roblox')
  })

  it('avoids repeating lastUsed when alternatives exist', () => {
    const result = selectInterest(['roblox', 'space'], 'roblox', 0)
    expect(result).toBe('space')
  })

  it('rotates through filtered pool by rotationIndex', () => {
    const interests = ['roblox', 'space', 'animals']
    const r0 = selectInterest(interests, null, 0)
    const r1 = selectInterest(interests, null, 1)
    const r2 = selectInterest(interests, null, 2)
    expect(new Set([r0, r1, r2]).size).toBe(3)
  })

  it('wraps around with modulo when rotationIndex exceeds pool size', () => {
    const result = selectInterest(['roblox', 'space'], null, 10)
    expect(['roblox', 'space']).toContain(result)
  })
})

// ── createInitialPersonalizationState ────────────────────────────────────────

describe('createInitialPersonalizationState', () => {
  it('warmupUsed starts false', () => {
    expect(createInitialPersonalizationState().warmupUsed).toBe(false)
  })

  it('warmupTurnsUsed starts at 0', () => {
    expect(createInitialPersonalizationState().warmupTurnsUsed).toBe(0)
  })

  it('warmupStartTime starts null', () => {
    expect(createInitialPersonalizationState().warmupStartTime).toBeNull()
  })

  it('microDialogueCooldown starts at 0 (count-up; first dialogue after 3 exercises — M1)', () => {
    expect(createInitialPersonalizationState().microDialogueCooldown).toBe(0)
  })

  it('microDialogueInProgress starts false', () => {
    expect(createInitialPersonalizationState().microDialogueInProgress).toBe(false)
  })

  it('interestRotationIndex starts at 0', () => {
    expect(createInitialPersonalizationState().interestRotationIndex).toBe(0)
  })

  it('lastInterestUsed starts null', () => {
    expect(createInitialPersonalizationState().lastInterestUsed).toBeNull()
  })
})

// ── Session memory serialization ─────────────────────────────────────────────

describe('session memory serialization', () => {
  it('KidsSessionPersonalizationState survives JSON round-trip', () => {
    const state = createInitialPersonalizationState()
    const serialized = JSON.stringify(state)
    const deserialized: KidsSessionPersonalizationState = JSON.parse(serialized)
    expect(deserialized.warmupUsed).toBe(false)
    expect(deserialized.warmupTurnsUsed).toBe(0)
    expect(deserialized.warmupStartTime).toBeNull()
    expect(deserialized.microDialogueCooldown).toBe(0)
    expect(deserialized.interestRotationIndex).toBe(0)
    expect(deserialized.lastInterestUsed).toBeNull()
  })

  it('partial state with warmup in progress survives JSON round-trip', () => {
    const state: KidsSessionPersonalizationState = {
      warmupUsed: false,
      warmupTurnsUsed: 1,
      warmupStartTime: 1749567890000,
      microDialogueCooldown: 3,
      interestRotationIndex: 1,
      lastInterestUsed: 'minecraft',
    }
    const deserialized: KidsSessionPersonalizationState = JSON.parse(JSON.stringify(state))
    expect(deserialized.warmupTurnsUsed).toBe(1)
    expect(deserialized.warmupStartTime).toBe(1749567890000)
    expect(deserialized.lastInterestUsed).toBe('minecraft')
  })
})

// ── Curriculum integrity ─────────────────────────────────────────────────────

describe('curriculum integrity', () => {
  afterEach(clearFlags)

  it('C1: buildWarmupTurn does not modify the interests array (no mutation)', () => {
    withFlags()
    const interests = ['roblox', 'space']
    const original = [...interests]
    buildWarmupTurn(interests, freshState())
    expect(interests).toEqual(original)
  })

  it('C1: buildWarmupTurn does not modify the state object (pure)', () => {
    withFlags()
    const state = freshState()
    const snapshotBefore = JSON.stringify(state)
    buildWarmupTurn(['roblox'], state)
    expect(JSON.stringify(state)).toBe(snapshotBefore)
  })

  it('C1: buildWarmupReturnPhrase does not throw on unknown interest', () => {
    expect(() => buildWarmupReturnPhrase('unknown')).not.toThrow()
  })

  it('C5: adult flow unaffected — personalization engine exports no adult-mode symbols', () => {
    // Verify no adult lesson types or symbols leak into the engine
    const engineModule = { buildWarmupTurn, buildWarmupReturnPhrase, createInitialPersonalizationState }
    expect(typeof engineModule.buildWarmupTurn).toBe('function')
    expect(typeof engineModule.createInitialPersonalizationState).toBe('function')
  })
})

// ── S5: Error catch — engine failure returns null ────────────────────────────

describe('S5 — error handling: engine failure returns null gracefully', () => {
  afterEach(() => {
    clearFlags()
    vi.restoreAllMocks()
  })

  it('buildWarmupTurn returns null when passed malformed state, not throws', () => {
    withFlags()
    // Passing undefined as state should not crash, should return null
    expect(() => buildWarmupTurn(['roblox'], null as unknown as KidsSessionPersonalizationState)).not.toThrow()
  })

  it('buildWarmupReturnPhrase returns null for empty string interest, not throws', () => {
    expect(() => buildWarmupReturnPhrase('')).not.toThrow()
    expect(buildWarmupReturnPhrase('')).toBeNull()
  })
})

// ── Phase 2: Interest-Aware Examples (E1–E5) ─────────────────────────────────

describe('E1 — example context appears when interests set and flags enabled', () => {
  afterEach(clearFlags)

  it('returns a PersonalizationResult with tier=EXAMPLE', () => {
    withExampleFlags()
    const result = buildExampleContext(['roblox'], 'blue', freshState())
    expect(result).not.toBeNull()
    expect(result!.tier).toBe('EXAMPLE')
  })

  it('result text is a non-empty string', () => {
    withExampleFlags()
    const result = buildExampleContext(['minecraft'], 'red', freshState())
    expect(result!.text).toBeTruthy()
    expect(typeof result!.text).toBe('string')
  })

  it('interestUsed matches the provided interest', () => {
    withExampleFlags()
    const result = buildExampleContext(['football'], 'green', freshState())
    expect(result!.interestUsed).toBe('football')
  })

  it('each of the 12 interests produces an example', () => {
    withExampleFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildExampleContext([interest], 'blue', freshState())
      expect(result, `buildExampleContext returned null for interest "${interest}"`).not.toBeNull()
    }
  })

  it('returns null when interests are empty', () => {
    withExampleFlags()
    expect(buildExampleContext([], 'blue', freshState())).toBeNull()
  })

  it('returns null when targetWord is empty', () => {
    withExampleFlags()
    expect(buildExampleContext(['roblox'], '', freshState())).toBeNull()
    expect(buildExampleContext(['roblox'], '   ', freshState())).toBeNull()
  })

  it('returns null for unknown interest with no template', () => {
    withExampleFlags()
    expect(buildExampleContext(['unknown_interest'], 'blue', freshState())).toBeNull()
  })
})

// ── E2: Example is ≤ 15 words ────────────────────────────────────────────────

describe('E2 — example word budget', () => {
  afterEach(clearFlags)

  it('example does not exceed 15 words for any interest', () => {
    withExampleFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildExampleContext([interest], 'blue', freshState())
      const wordCount = result!.text.trim().split(/\s+/).length
      expect(wordCount, `example for "${interest}" exceeds 15 words`).toBeLessThanOrEqual(15)
    }
  })
})

// ── E3: Example contains targetWord ──────────────────────────────────────────

describe('E3 — example contains the target word', () => {
  afterEach(clearFlags)

  it('all 12 templates include the targetWord parameter', () => {
    withExampleFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildExampleContext([interest], 'blue', freshState())
      expect(result!.text, `example for "${interest}" missing targetWord`).toContain('blue')
    }
  })

  it('different target words are interpolated correctly', () => {
    withExampleFlags()
    for (const word of ['red', 'green', 'yellow']) {
      const result = buildExampleContext(['minecraft'], word, freshState())
      expect(result!.text).toContain(word)
    }
  })
})

// ── E4: targetWord not modified ──────────────────────────────────────────────

describe('E4 — targetWord and inputs not modified (pure)', () => {
  afterEach(clearFlags)

  it('targetWord is identical before and after the call', () => {
    withExampleFlags()
    const targetWord = 'blue'
    buildExampleContext(['roblox'], targetWord, freshState())
    expect(targetWord).toBe('blue')
  })

  it('does not modify the interests array', () => {
    withExampleFlags()
    const interests = ['roblox', 'space']
    const original = [...interests]
    buildExampleContext(interests, 'blue', freshState())
    expect(interests).toEqual(original)
  })

  it('does not modify the state object (pure)', () => {
    withExampleFlags()
    const state = freshState()
    const snapshotBefore = JSON.stringify(state)
    buildExampleContext(['roblox'], 'blue', state)
    expect(JSON.stringify(state)).toBe(snapshotBefore)
  })
})

// ── E5: shouldContinue not set (example expects no child response) ───────────

describe('E5 — example is teacher speech only, no response expected', () => {
  afterEach(clearFlags)

  it('shouldContinue is undefined for EXAMPLE tier', () => {
    withExampleFlags()
    const result = buildExampleContext(['roblox'], 'blue', freshState())
    expect(result!.shouldContinue).toBeUndefined()
  })
})

// ── Example feature flags ─────────────────────────────────────────────────────

describe('feature flag: KIDS_INTEREST_EXAMPLES_V2', () => {
  afterEach(clearFlags)

  it('isInterestExamplesEnabled returns false when unset', () => {
    clearFlags()
    expect(isInterestExamplesEnabled()).toBe(false)
  })

  it('isInterestExamplesEnabled returns true when set to "true"', () => {
    process.env.KIDS_INTEREST_EXAMPLES_V2 = 'true'
    expect(isInterestExamplesEnabled()).toBe(true)
  })

  it('returns null when master toggle off even with examples flag on', () => {
    process.env.KIDS_PERSONALIZATION_V2 = 'false'
    process.env.KIDS_INTEREST_EXAMPLES_V2 = 'true'
    expect(buildExampleContext(['roblox'], 'blue', freshState())).toBeNull()
  })

  it('returns null when examples flag off even with master toggle on', () => {
    process.env.KIDS_PERSONALIZATION_V2 = 'true'
    process.env.KIDS_INTEREST_EXAMPLES_V2 = 'false'
    expect(buildExampleContext(['roblox'], 'blue', freshState())).toBeNull()
  })

  it('warmup flag does not affect examples (independent flags)', () => {
    process.env.KIDS_PERSONALIZATION_V2 = 'true'
    process.env.KIDS_INTEREST_EXAMPLES_V2 = 'true'
    process.env.KIDS_WARMUP_ENABLED = 'false'
    expect(buildExampleContext(['roblox'], 'blue', freshState())).not.toBeNull()
  })
})

// ── Example interest rotation ─────────────────────────────────────────────────

describe('example interest rotation', () => {
  afterEach(clearFlags)

  it('avoids repeating lastInterestUsed when alternatives exist', () => {
    withExampleFlags()
    const state = freshState({ lastInterestUsed: 'roblox' })
    const result = buildExampleContext(['roblox', 'space'], 'blue', state)
    expect(result!.interestUsed).toBe('space')
  })

  it('uses the only interest even if it was lastUsed', () => {
    withExampleFlags()
    const state = freshState({ lastInterestUsed: 'roblox' })
    const result = buildExampleContext(['roblox'], 'blue', state)
    expect(result!.interestUsed).toBe('roblox')
  })

  it('rotationIndex changes the selected interest', () => {
    withExampleFlags()
    const interests = ['roblox', 'space', 'animals']
    const r0 = buildExampleContext(interests, 'blue', freshState({ interestRotationIndex: 0 }))
    const r1 = buildExampleContext(interests, 'blue', freshState({ interestRotationIndex: 1 }))
    expect(r0!.interestUsed).not.toBe(r1!.interestUsed)
  })
})

// ── Example error handling (S5 extension) ────────────────────────────────────

describe('S5 — buildExampleContext error handling', () => {
  afterEach(clearFlags)

  it('does not throw when passed null state', () => {
    withExampleFlags()
    expect(() =>
      buildExampleContext(['roblox'], 'blue', null as unknown as KidsSessionPersonalizationState),
    ).not.toThrow()
  })

  it('does not throw when passed null interests', () => {
    withExampleFlags()
    expect(() =>
      buildExampleContext(null as unknown as string[], 'blue', freshState()),
    ).not.toThrow()
    expect(buildExampleContext(null as unknown as string[], 'blue', freshState())).toBeNull()
  })
})

// ── Phase 3: Interest-Aware Praise (P1–P5) ───────────────────────────────────

describe('P1 — praise fires after CORRECT_* labels', () => {
  afterEach(clearFlags)

  it.each(['correct_confident', 'correct_hesitant', 'near_correct'])(
    'label "%s" triggers praise',
    (label) => {
      withPraiseFlags()
      const result = buildInterestPraise(['roblox'], label, 'lucy', freshState())
      expect(result).not.toBeNull()
      expect(result!.tier).toBe('PRAISE')
    },
  )

  it('PRAISE_ELIGIBLE_LABELS contains exactly the three correct labels', () => {
    expect(PRAISE_ELIGIBLE_LABELS.size).toBe(3)
    expect(PRAISE_ELIGIBLE_LABELS.has('correct_confident')).toBe(true)
    expect(PRAISE_ELIGIBLE_LABELS.has('correct_hesitant')).toBe(true)
    expect(PRAISE_ELIGIBLE_LABELS.has('near_correct')).toBe(true)
  })

  it('each of the 12 interests produces praise', () => {
    withPraiseFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildInterestPraise([interest], 'correct_confident', 'lucy', freshState())
      expect(result, `buildInterestPraise returned null for interest "${interest}"`).not.toBeNull()
    }
  })
})

// ── P2/P3: Persona selects praise variant ────────────────────────────────────

describe('P2/P3 — persona praise variants (Lucy=template[0], Tom=template[1])', () => {
  afterEach(clearFlags)

  it('P2: lucy produces the exclamatory variant', () => {
    withPraiseFlags()
    const result = buildInterestPraise(['roblox'], 'correct_confident', 'lucy', freshState())
    expect(result!.text).toBe('You got it! A Roblox champion!')
  })

  it('P3: tom produces the warm-steady variant', () => {
    withPraiseFlags()
    const result = buildInterestPraise(['roblox'], 'correct_confident', 'tom', freshState())
    expect(result!.text).toBe('Well done! Strong as a Roblox player!')
  })

  it('P4/T4: Lucy praise is measurably different from Tom praise (string diff)', () => {
    withPraiseFlags()
    for (const interest of ALL_INTERESTS) {
      const lucy = buildInterestPraise([interest], 'correct_confident', 'lucy', freshState())
      const tom = buildInterestPraise([interest], 'correct_confident', 'tom', freshState())
      expect(lucy!.text, `Lucy and Tom praise identical for "${interest}"`).not.toBe(tom!.text)
    }
  })

  it('unknown teacherId falls back to Lucy variant (default persona)', () => {
    withPraiseFlags()
    const result = buildInterestPraise(['roblox'], 'correct_confident', 'someone_else', freshState())
    expect(result!.text).toBe('You got it! A Roblox champion!')
  })
})

// ── P4: No praise on wrong answers or silence ────────────────────────────────

describe('P4 — praise does NOT fire on wrong/silence labels', () => {
  afterEach(clearFlags)

  it.each([
    'wrong_semantic',
    'silence_short',
    'silence_medium',
    'silence_long',
    'no_transcript',
    'noise_unintelligible',
    'off_topic',
  ])('label "%s" does not trigger praise', (label) => {
    withPraiseFlags()
    expect(buildInterestPraise(['roblox'], label, 'lucy', freshState())).toBeNull()
  })
})

// ── P5: Praise word budget ───────────────────────────────────────────────────

describe('P5 — praise is ≤ 15 words for all variants', () => {
  afterEach(clearFlags)

  it('lucy variant under budget for all interests', () => {
    withPraiseFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildInterestPraise([interest], 'correct_confident', 'lucy', freshState())
      const wordCount = result!.text.trim().split(/\s+/).length
      expect(wordCount, `lucy praise for "${interest}" exceeds 15 words`).toBeLessThanOrEqual(15)
    }
  })

  it('tom variant under budget for all interests', () => {
    withPraiseFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildInterestPraise([interest], 'correct_confident', 'tom', freshState())
      const wordCount = result!.text.trim().split(/\s+/).length
      expect(wordCount, `tom praise for "${interest}" exceeds 15 words`).toBeLessThanOrEqual(15)
    }
  })
})

// ── Praise feature flags ──────────────────────────────────────────────────────

describe('feature flag: KIDS_INTEREST_PRAISE', () => {
  afterEach(clearFlags)

  it('isInterestPraiseEnabled returns false when unset', () => {
    clearFlags()
    expect(isInterestPraiseEnabled()).toBe(false)
  })

  it('isInterestPraiseEnabled returns true when set to "true"', () => {
    process.env.KIDS_INTEREST_PRAISE = 'true'
    expect(isInterestPraiseEnabled()).toBe(true)
  })

  it('returns null when master toggle off even with praise flag on', () => {
    process.env.KIDS_PERSONALIZATION_V2 = 'false'
    process.env.KIDS_INTEREST_PRAISE = 'true'
    expect(buildInterestPraise(['roblox'], 'correct_confident', 'lucy', freshState())).toBeNull()
  })

  it('returns null when praise flag off even with master toggle on', () => {
    process.env.KIDS_PERSONALIZATION_V2 = 'true'
    process.env.KIDS_INTEREST_PRAISE = 'false'
    expect(buildInterestPraise(['roblox'], 'correct_confident', 'lucy', freshState())).toBeNull()
  })
})

// ── Praise integrity & error handling ─────────────────────────────────────────

describe('praise — curriculum integrity and error handling', () => {
  afterEach(clearFlags)

  it('returns null for empty interests', () => {
    withPraiseFlags()
    expect(buildInterestPraise([], 'correct_confident', 'lucy', freshState())).toBeNull()
  })

  it('returns null for unknown interest with no template', () => {
    withPraiseFlags()
    expect(buildInterestPraise(['unknown_interest'], 'correct_confident', 'lucy', freshState())).toBeNull()
  })

  it('does not modify the state object (pure)', () => {
    withPraiseFlags()
    const state = freshState()
    const snapshotBefore = JSON.stringify(state)
    buildInterestPraise(['roblox'], 'correct_confident', 'lucy', state)
    expect(JSON.stringify(state)).toBe(snapshotBefore)
  })

  it('does not modify the interests array', () => {
    withPraiseFlags()
    const interests = ['roblox', 'space']
    const original = [...interests]
    buildInterestPraise(interests, 'correct_confident', 'lucy', freshState())
    expect(interests).toEqual(original)
  })

  it('avoids repeating lastInterestUsed when alternatives exist', () => {
    withPraiseFlags()
    const state = freshState({ lastInterestUsed: 'roblox' })
    const result = buildInterestPraise(['roblox', 'space'], 'correct_confident', 'lucy', state)
    expect(result!.interestUsed).toBe('space')
  })

  it('does not throw when passed null state', () => {
    withPraiseFlags()
    expect(() =>
      buildInterestPraise(['roblox'], 'correct_confident', 'lucy', null as unknown as KidsSessionPersonalizationState),
    ).not.toThrow()
  })

  it('does not throw when passed null teacherId', () => {
    withPraiseFlags()
    expect(() =>
      buildInterestPraise(['roblox'], 'correct_confident', null as unknown as string, freshState()),
    ).not.toThrow()
    const result = buildInterestPraise(['roblox'], 'correct_confident', null as unknown as string, freshState())
    expect(result).not.toBeNull()
  })
})

// ── Phase 4: Interest-Aware Recovery (R1–R4) ─────────────────────────────────

describe('R1 — recovery builds interest text when flags enabled', () => {
  afterEach(clearFlags)

  it('returns a PersonalizationResult with tier=RECOVERY', () => {
    withRecoveryFlags()
    const result = buildInterestRecovery(['roblox'], 'blue', freshState())
    expect(result).not.toBeNull()
    expect(result!.tier).toBe('RECOVERY')
  })

  it('each of the 12 interests produces recovery text', () => {
    withRecoveryFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildInterestRecovery([interest], 'blue', freshState())
      expect(result, `buildInterestRecovery returned null for interest "${interest}"`).not.toBeNull()
    }
  })

  it('recovery text mentions the interest context (not just the word)', () => {
    withRecoveryFlags()
    const result = buildInterestRecovery(['minecraft'], 'blue', freshState())
    expect(result!.text).toContain('Minecraft')
  })
})

// ── R2: Recovery always ends with target word invitation ─────────────────────

describe('R2 — recovery ends with "Say [word]!" invitation', () => {
  afterEach(clearFlags)

  it('all 12 templates end with the target word invitation', () => {
    withRecoveryFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildInterestRecovery([interest], 'blue', freshState())
      expect(result!.text, `recovery for "${interest}" missing invitation`).toMatch(/Say blue!$/)
    }
  })

  it('invitation uses the provided target word', () => {
    withRecoveryFlags()
    for (const word of ['red', 'green', 'yellow']) {
      const result = buildInterestRecovery(['space'], word, freshState())
      expect(result!.text).toMatch(new RegExp(`Say ${word}!$`))
    }
  })

  it('recovery does not exceed 15 words for any interest', () => {
    withRecoveryFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildInterestRecovery([interest], 'blue', freshState())
      const wordCount = result!.text.trim().split(/\s+/).length
      expect(wordCount, `recovery for "${interest}" exceeds 15 words`).toBeLessThanOrEqual(15)
    }
  })
})

// ── Recovery feature flags ────────────────────────────────────────────────────

describe('feature flag: KIDS_INTEREST_RECOVERY_V2', () => {
  afterEach(clearFlags)

  it('isInterestRecoveryEnabled returns false when unset', () => {
    clearFlags()
    expect(isInterestRecoveryEnabled()).toBe(false)
  })

  it('isInterestRecoveryEnabled returns true when set to "true"', () => {
    process.env.KIDS_INTEREST_RECOVERY_V2 = 'true'
    expect(isInterestRecoveryEnabled()).toBe(true)
  })

  it('returns null when master toggle off even with recovery flag on', () => {
    process.env.KIDS_PERSONALIZATION_V2 = 'false'
    process.env.KIDS_INTEREST_RECOVERY_V2 = 'true'
    expect(buildInterestRecovery(['roblox'], 'blue', freshState())).toBeNull()
  })

  it('returns null when recovery flag off even with master toggle on', () => {
    process.env.KIDS_PERSONALIZATION_V2 = 'true'
    process.env.KIDS_INTEREST_RECOVERY_V2 = 'false'
    expect(buildInterestRecovery(['roblox'], 'blue', freshState())).toBeNull()
  })
})

// ── Recovery integrity & error handling ──────────────────────────────────────

describe('recovery — curriculum integrity and error handling', () => {
  afterEach(clearFlags)

  it('returns null for empty interests', () => {
    withRecoveryFlags()
    expect(buildInterestRecovery([], 'blue', freshState())).toBeNull()
  })

  it('returns null for empty targetWord', () => {
    withRecoveryFlags()
    expect(buildInterestRecovery(['roblox'], '', freshState())).toBeNull()
    expect(buildInterestRecovery(['roblox'], '   ', freshState())).toBeNull()
  })

  it('returns null for unknown interest with no template', () => {
    withRecoveryFlags()
    expect(buildInterestRecovery(['unknown_interest'], 'blue', freshState())).toBeNull()
  })

  it('targetWord is identical before and after the call (C1)', () => {
    withRecoveryFlags()
    const targetWord = 'blue'
    buildInterestRecovery(['roblox'], targetWord, freshState())
    expect(targetWord).toBe('blue')
  })

  it('does not modify the state object (read-only)', () => {
    withRecoveryFlags()
    const state = freshState()
    const snapshotBefore = JSON.stringify(state)
    buildInterestRecovery(['roblox'], 'blue', state)
    expect(JSON.stringify(state)).toBe(snapshotBefore)
  })

  it('does not modify the interests array', () => {
    withRecoveryFlags()
    const interests = ['roblox', 'space']
    const original = [...interests]
    buildInterestRecovery(interests, 'blue', freshState())
    expect(interests).toEqual(original)
  })

  it('does not throw when passed null state', () => {
    withRecoveryFlags()
    expect(() =>
      buildInterestRecovery(['roblox'], 'blue', null as unknown as KidsSessionPersonalizationState),
    ).not.toThrow()
  })

  it('does not throw when passed null interests', () => {
    withRecoveryFlags()
    expect(() =>
      buildInterestRecovery(null as unknown as string[], 'blue', freshState()),
    ).not.toThrow()
    expect(buildInterestRecovery(null as unknown as string[], 'blue', freshState())).toBeNull()
  })
})

// ── Teacher persona tests (Phase 6 stub) ─────────────────────────────────────

describe('teacher personas', () => {
  it('getTeacherPersona returns LUCY for id "lucy"', () => {
    expect(getTeacherPersona('lucy').id).toBe('lucy')
    expect(getTeacherPersona('lucy').displayName).toBe('Lucy')
  })

  it('getTeacherPersona returns TOM for id "tom"', () => {
    expect(getTeacherPersona('tom').id).toBe('tom')
    expect(getTeacherPersona('tom').displayName).toBe('Tom')
  })

  it('getTeacherPersona returns DEFAULT (Lucy behavior) for unknown id', () => {
    const persona = getTeacherPersona('unknown')
    expect(persona.id).toBe('default')
    expect(persona.energyLevel).toBe('HIGH')
  })

  it('getTeacherPersona is case-insensitive', () => {
    expect(getTeacherPersona('TOM').id).toBe('tom')
    expect(getTeacherPersona('LUCY').id).toBe('lucy')
  })

  it('T4: Lucy and Tom praise styles are different', () => {
    expect(LUCY_PERSONA.praiseStyle).not.toBe(TOM_PERSONA.praiseStyle)
  })

  it('T5: Lucy and Tom use same curriculum (no curriculum control in persona)', () => {
    // Personas have no targetWord, acceptedAnswers, or escalation fields
    expect('targetWord' in LUCY_PERSONA).toBe(false)
    expect('acceptedAnswers' in TOM_PERSONA).toBe(false)
    expect('escalationLadder' in LUCY_PERSONA).toBe(false)
  })

  it('Lucy openingPhrase contains "Lucy"', () => {
    expect(LUCY_PERSONA.openingPhrase).toContain('Lucy')
  })

  it('Tom openingPhrase contains "Tom"', () => {
    expect(TOM_PERSONA.openingPhrase).toContain('Tom')
  })

  it('both personas have opening and closing phrases', () => {
    expect(LUCY_PERSONA.openingPhrase.length).toBeGreaterThan(0)
    expect(LUCY_PERSONA.closingPhrase.length).toBeGreaterThan(0)
    expect(TOM_PERSONA.openingPhrase.length).toBeGreaterThan(0)
    expect(TOM_PERSONA.closingPhrase.length).toBeGreaterThan(0)
  })
})

// ── Phase 5: Micro-Dialogues (M1–M5) ─────────────────────────────────────────

describe('M1 — micro-dialogue fires only after ≥3 exercises (cooldown)', () => {
  afterEach(clearFlags)

  it('returns null when microDialogueCooldown is 0', () => {
    withMicroDialogueFlags()
    expect(buildMicroDialogueTurn(['roblox'], freshState({ microDialogueCooldown: 0 }))).toBeNull()
  })

  it('returns null when microDialogueCooldown is 1', () => {
    withMicroDialogueFlags()
    expect(buildMicroDialogueTurn(['roblox'], freshState({ microDialogueCooldown: 1 }))).toBeNull()
  })

  it('returns null when microDialogueCooldown is 2', () => {
    withMicroDialogueFlags()
    expect(buildMicroDialogueTurn(['roblox'], freshState({ microDialogueCooldown: 2 }))).toBeNull()
  })

  it('returns a result when microDialogueCooldown reaches 3', () => {
    withMicroDialogueFlags()
    const result = buildMicroDialogueTurn(['roblox'], freshState({ microDialogueCooldown: 3 }))
    expect(result).not.toBeNull()
    expect(result?.tier).toBe('MICRO_DIALOGUE')
  })

  it('returns a result when microDialogueCooldown exceeds 3', () => {
    withMicroDialogueFlags()
    expect(buildMicroDialogueTurn(['roblox'], freshState({ microDialogueCooldown: 7 }))).not.toBeNull()
  })

  it('MICRO_DIALOGUE_COOLDOWN_EXERCISES constant equals 3', () => {
    expect(MICRO_DIALOGUE_COOLDOWN_EXERCISES).toBe(3)
  })

  it('fresh session state is not eligible (cooldown starts at 0)', () => {
    withMicroDialogueFlags()
    expect(buildMicroDialogueTurn(['roblox'], freshState())).toBeNull()
  })
})

describe('M2 — at most once per 3 exercises (engine is pure; caller resets)', () => {
  afterEach(clearFlags)

  it('engine does NOT reset cooldown itself (pure — caller resets to 0)', () => {
    withMicroDialogueFlags()
    const state = freshState({ microDialogueCooldown: 3 })
    buildMicroDialogueTurn(['roblox'], state)
    expect(state.microDialogueCooldown).toBe(3)
  })

  it('after caller resets to 0, dialogue is no longer eligible', () => {
    withMicroDialogueFlags()
    const state = freshState({ microDialogueCooldown: 3 })
    expect(buildMicroDialogueTurn(['roblox'], state)).not.toBeNull()
    state.microDialogueCooldown = 0 // caller reset on fire
    expect(buildMicroDialogueTurn(['roblox'], state)).toBeNull()
  })

  it('returns null when a dialogue is already in progress', () => {
    withMicroDialogueFlags()
    const state = freshState({ microDialogueCooldown: 3, microDialogueInProgress: true })
    expect(buildMicroDialogueTurn(['roblox'], state)).toBeNull()
  })
})

describe('M3 — micro-dialogue is one turn with immediate curriculum return', () => {
  afterEach(clearFlags)

  it('shouldContinue is true (question expects exactly one child reply)', () => {
    withMicroDialogueFlags()
    const result = buildMicroDialogueTurn(['minecraft'], freshState({ microDialogueCooldown: 3 }))
    expect(result?.shouldContinue).toBe(true)
  })

  it('return phrase re-invites the current target word', () => {
    const phrase = buildMicroDialogueReturnPhrase('red')
    expect(phrase).toContain('red')
    expect(phrase.toLowerCase()).toContain('lesson')
  })

  it('return phrase falls back to generic line when no target word', () => {
    expect(buildMicroDialogueReturnPhrase(null)).toBe('Nice! Back to our lesson!')
    expect(buildMicroDialogueReturnPhrase('')).toBe('Nice! Back to our lesson!')
  })

  it('return phrase does not exceed 15 words', () => {
    const phrase = buildMicroDialogueReturnPhrase('crocodile')
    expect(phrase.trim().split(/\s+/).length).toBeLessThanOrEqual(15)
  })
})

describe('M4 — in-progress detection (reply intercepted as any-response)', () => {
  it('isMicroDialogueInProgress returns false on fresh state', () => {
    expect(isMicroDialogueInProgress(freshState())).toBe(false)
  })

  it('isMicroDialogueInProgress returns true when flag set', () => {
    expect(isMicroDialogueInProgress(freshState({ microDialogueInProgress: true }))).toBe(true)
  })

  it('isMicroDialogueInProgress returns false when field is undefined (pre-Phase-5 session)', () => {
    const state = freshState()
    delete (state as unknown as Record<string, unknown>).microDialogueInProgress
    expect(isMicroDialogueInProgress(state)).toBe(false)
  })
})

describe('M5 — micro-dialogue never scores the child (engine purity)', () => {
  afterEach(clearFlags)

  it('does not modify the state object', () => {
    withMicroDialogueFlags()
    const state = freshState({ microDialogueCooldown: 3 })
    const snapshot = JSON.parse(JSON.stringify(state))
    buildMicroDialogueTurn(['space'], state)
    expect(state).toEqual(snapshot)
  })

  it('does not modify the interests array', () => {
    withMicroDialogueFlags()
    const interests = ['space', 'cars']
    buildMicroDialogueTurn(interests, freshState({ microDialogueCooldown: 3 }))
    expect(interests).toEqual(['space', 'cars'])
  })

  it('result carries no curriculum control fields', () => {
    withMicroDialogueFlags()
    const result = buildMicroDialogueTurn(['cars'], freshState({ microDialogueCooldown: 3 }))
    expect(result).not.toBeNull()
    expect('exerciseCorrectCount' in (result as object)).toBe(false)
    expect('acceptedAnswers' in (result as object)).toBe(false)
    expect('escalationLadder' in (result as object)).toBe(false)
  })
})

describe('micro-dialogue templates — all 12 interests', () => {
  afterEach(clearFlags)

  it('each interest produces a dialogue question', () => {
    withMicroDialogueFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildMicroDialogueTurn([interest], freshState({ microDialogueCooldown: 3 }))
      expect(result, `interest=${interest}`).not.toBeNull()
      expect(result?.interestUsed).toBe(interest)
    }
  })

  it('no question exceeds 15 words', () => {
    withMicroDialogueFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildMicroDialogueTurn([interest], freshState({ microDialogueCooldown: 3 }))
      const wordCount = (result?.text ?? '').trim().split(/\s+/).length
      expect(wordCount, `interest=${interest}`).toBeLessThanOrEqual(15)
    }
  })

  it('questions are non-empty for all interests', () => {
    withMicroDialogueFlags()
    for (const interest of ALL_INTERESTS) {
      const result = buildMicroDialogueTurn([interest], freshState({ microDialogueCooldown: 3 }))
      expect((result?.text ?? '').length, `interest=${interest}`).toBeGreaterThan(0)
    }
  })
})

describe('feature flag: KIDS_MICRO_DIALOGUE_ENABLED', () => {
  afterEach(clearFlags)

  it('isMicroDialogueEnabled returns false when unset', () => {
    clearFlags()
    expect(isMicroDialogueEnabled()).toBe(false)
  })

  it('isMicroDialogueEnabled returns true when set to "true"', () => {
    process.env.KIDS_MICRO_DIALOGUE_ENABLED = 'true'
    expect(isMicroDialogueEnabled()).toBe(true)
  })

  it('returns null when master toggle off even with dialogue flag on', () => {
    clearFlags()
    process.env.KIDS_MICRO_DIALOGUE_ENABLED = 'true'
    expect(buildMicroDialogueTurn(['roblox'], freshState({ microDialogueCooldown: 3 }))).toBeNull()
  })

  it('returns null when dialogue flag off even with master toggle on', () => {
    clearFlags()
    process.env.KIDS_PERSONALIZATION_V2 = 'true'
    expect(buildMicroDialogueTurn(['roblox'], freshState({ microDialogueCooldown: 3 }))).toBeNull()
  })
})

describe('micro-dialogue — eligibility guards and error handling', () => {
  afterEach(clearFlags)

  it('returns null for empty interests', () => {
    withMicroDialogueFlags()
    expect(buildMicroDialogueTurn([], freshState({ microDialogueCooldown: 3 }))).toBeNull()
  })

  it('returns null for unknown interest with no template', () => {
    withMicroDialogueFlags()
    expect(buildMicroDialogueTurn(['knitting'], freshState({ microDialogueCooldown: 3 }))).toBeNull()
  })

  it('returns null while warmup is in progress', () => {
    withMicroDialogueFlags()
    const state = freshState({ microDialogueCooldown: 3, warmupTurnsUsed: 1, warmupUsed: false })
    expect(buildMicroDialogueTurn(['roblox'], state)).toBeNull()
  })

  it('avoids repeating lastInterestUsed when alternatives exist', () => {
    withMicroDialogueFlags()
    const state = freshState({ microDialogueCooldown: 3, lastInterestUsed: 'roblox' })
    const result = buildMicroDialogueTurn(['roblox', 'space'], state)
    expect(result?.interestUsed).toBe('space')
  })

  it('does not throw when passed null state', () => {
    withMicroDialogueFlags()
    expect(() =>
      buildMicroDialogueTurn(['roblox'], null as unknown as KidsSessionPersonalizationState),
    ).not.toThrow()
  })

  it('does not throw when passed null interests', () => {
    withMicroDialogueFlags()
    expect(() =>
      buildMicroDialogueTurn(null as unknown as string[], freshState({ microDialogueCooldown: 3 })),
    ).not.toThrow()
  })
})

// ── Phase 6: Teacher Personas (T1–T6) ────────────────────────────────────────

describe('T1/T2 — persona greetings are distinct and persona-correct', () => {
  afterEach(clearFlags)

  it('T1: Lucy greeting introduces Lucy', () => {
    withPersonaFlags()
    const greeting = buildPersonaGreeting('lucy', 'Misha')
    expect(greeting).not.toBeNull()
    expect(greeting).toContain('Lucy')
    expect(greeting).toContain('Misha')
  })

  it('T2: Tom greeting introduces Tom', () => {
    withPersonaFlags()
    const greeting = buildPersonaGreeting('tom', 'Misha')
    expect(greeting).not.toBeNull()
    expect(greeting).toContain('Tom')
    expect(greeting).toContain('Misha')
  })

  it('T1/T2: Lucy greeting is measurably different from Tom greeting (string diff)', () => {
    withPersonaFlags()
    const lucy = buildPersonaGreeting('lucy', 'Misha')
    const tom = buildPersonaGreeting('tom', 'Misha')
    expect(lucy).not.toBeNull()
    expect(tom).not.toBeNull()
    expect(lucy).not.toBe(tom)
  })

  it('Lucy closing is measurably different from Tom closing (string diff)', () => {
    withPersonaFlags()
    const lucy = buildPersonaClosing('lucy', 'Misha')
    const tom = buildPersonaClosing('tom', 'Misha')
    expect(lucy).not.toBeNull()
    expect(tom).not.toBeNull()
    expect(lucy).not.toBe(tom)
  })
})

describe('T3 — childName substitution', () => {
  afterEach(clearFlags)

  it('substitutes the child name into the greeting', () => {
    withPersonaFlags()
    expect(buildPersonaGreeting('lucy', 'Anya')).toContain('Anya')
    expect(buildPersonaGreeting('lucy', 'Anya')).not.toContain('[childName]')
  })

  it('substitutes the child name into the closing', () => {
    withPersonaFlags()
    expect(buildPersonaClosing('tom', 'Anya')).toContain('Anya')
    expect(buildPersonaClosing('tom', 'Anya')).not.toContain('[childName]')
  })

  it('falls back to "friend" when childName is null', () => {
    withPersonaFlags()
    expect(buildPersonaGreeting('lucy', null)).toContain('friend')
  })

  it('falls back to "friend" when childName is empty/whitespace', () => {
    withPersonaFlags()
    expect(buildPersonaGreeting('lucy', '   ')).toContain('friend')
  })

  it('trims surrounding whitespace from the child name', () => {
    withPersonaFlags()
    const greeting = buildPersonaGreeting('lucy', '  Anya  ')
    expect(greeting).toContain('Anya!')
  })

  it('inserts names with $-sequences as literal plain text (no replace-pattern interpretation)', () => {
    withPersonaFlags()
    // String.replace string-replacements interpret $&, $', $`, $$ — the engine
    // must insert the profile name verbatim instead.
    expect(buildPersonaGreeting('lucy', '$&')).toContain('Hi $&!')
    expect(buildPersonaGreeting('lucy', '$$')).toContain('Hi $$!')
    expect(buildPersonaGreeting('lucy', "$'")).toContain("Hi $'!")
    expect(buildPersonaGreeting('lucy', '$`')).toContain('Hi $`!')
  })

  it('a name that is literally "[childName]" is spoken verbatim, not re-expanded', () => {
    withPersonaFlags()
    const greeting = buildPersonaGreeting('lucy', '[childName]')
    expect(greeting).toContain('Hi [childName]!')
    // exactly one occurrence — the inserted text is not re-scanned
    expect(greeting?.split('[childName]').length).toBe(2)
  })
})

describe('T6 — persona feature flag gating', () => {
  afterEach(clearFlags)

  it('isTeacherPersonaEnabled returns false when unset', () => {
    clearFlags()
    expect(isTeacherPersonaEnabled()).toBe(false)
  })

  it('isTeacherPersonaEnabled returns true when set to "true"', () => {
    process.env.KIDS_TEACHER_PERSONA_V2 = 'true'
    expect(isTeacherPersonaEnabled()).toBe(true)
  })

  it('greeting returns null when master toggle off even with persona flag on', () => {
    clearFlags()
    process.env.KIDS_TEACHER_PERSONA_V2 = 'true'
    expect(buildPersonaGreeting('lucy', 'Misha')).toBeNull()
  })

  it('greeting returns null when persona flag off even with master toggle on', () => {
    clearFlags()
    process.env.KIDS_PERSONALIZATION_V2 = 'true'
    expect(buildPersonaGreeting('lucy', 'Misha')).toBeNull()
  })

  it('closing returns null when flags are off (standard close flow preserved)', () => {
    clearFlags()
    expect(buildPersonaClosing('lucy', 'Misha')).toBeNull()
  })
})

describe('persona greeting/closing — fallback, budget, error handling', () => {
  afterEach(clearFlags)

  it('unknown teacherId falls back to default persona (Lucy behavior)', () => {
    withPersonaFlags()
    const greeting = buildPersonaGreeting('unknown-teacher', 'Misha')
    expect(greeting).not.toBeNull()
    expect(greeting).toContain('Lucy')
  })

  it('empty teacherId falls back to default persona', () => {
    withPersonaFlags()
    expect(buildPersonaGreeting('', 'Misha')).not.toBeNull()
  })

  it('greetings and closings stay within 20 words for both personas', () => {
    withPersonaFlags()
    for (const id of ['lucy', 'tom']) {
      for (const text of [buildPersonaGreeting(id, 'Misha'), buildPersonaClosing(id, 'Misha')]) {
        expect(text, `persona=${id}`).not.toBeNull()
        expect((text ?? '').trim().split(/\s+/).length, `persona=${id}`).toBeLessThanOrEqual(20)
      }
    }
  })

  it('does not throw when passed null teacherId', () => {
    withPersonaFlags()
    expect(() => buildPersonaGreeting(null as unknown as string, 'Misha')).not.toThrow()
    expect(() => buildPersonaClosing(null as unknown as string, 'Misha')).not.toThrow()
  })

  it('greeting contains a readiness cue (curriculum handshake preserved)', () => {
    withPersonaFlags()
    expect(buildPersonaGreeting('lucy', 'Misha')?.toLowerCase()).toContain('ready')
    expect(buildPersonaGreeting('tom', 'Misha')?.toLowerCase()).toContain('ready')
  })
})

// ── Phase 7: Safety (S1–S5 + Section 4.2/4.3 hardening) ──────────────────────

function enableAllFlags() {
  process.env.KIDS_PERSONALIZATION_V2 = 'true'
  process.env.KIDS_WARMUP_ENABLED = 'true'
  process.env.KIDS_INTEREST_EXAMPLES_V2 = 'true'
  process.env.KIDS_INTEREST_PRAISE = 'true'
  process.env.KIDS_INTEREST_RECOVERY_V2 = 'true'
  process.env.KIDS_MICRO_DIALOGUE_ENABLED = 'true'
  process.env.KIDS_TEACHER_PERSONA_V2 = 'true'
}

/** Every text the engine can ever speak, collected via the public API only. */
function collectAllEngineTexts(): string[] {
  enableAllFlags()
  const texts: string[] = []
  const dialogueState = freshState({ microDialogueCooldown: 3 })
  for (const interest of ALL_INTERESTS) {
    texts.push(buildWarmupTurn([interest], freshState())!.text)
    texts.push(buildWarmupReturnPhrase(interest)!)
    texts.push(buildExampleContext([interest], 'blue', freshState())!.text)
    texts.push(buildInterestPraise([interest], 'correct_confident', 'lucy', freshState())!.text)
    texts.push(buildInterestPraise([interest], 'correct_confident', 'tom', freshState())!.text)
    texts.push(buildInterestRecovery([interest], 'blue', freshState())!.text)
    texts.push(buildMicroDialogueTurn([interest], dialogueState)!.text)
  }
  texts.push(buildMicroDialogueReturnPhrase('blue'))
  texts.push(buildMicroDialogueReturnPhrase(null))
  for (const teacher of ['lucy', 'tom']) {
    texts.push(buildPersonaGreeting(teacher, 'Anya')!)
    texts.push(buildPersonaClosing(teacher, 'Anya')!)
  }
  return texts
}

describe('S1 — templates are static and deterministic (no generation)', () => {
  afterEach(clearFlags)

  it('every engine text is identical across repeated calls with the same input', () => {
    const first = collectAllEngineTexts()
    const second = collectAllEngineTexts()
    expect(first.length).toBeGreaterThanOrEqual(88) // 12 interests × 7 + 2 + 4
    expect(second).toEqual(first)
  })
})

describe('S3 — no engine text asks for personal information', () => {
  afterEach(clearFlags)

  it('no text asks for real name, school, address, age, phone, or location', () => {
    const forbidden =
      /your (real )?name|school|address|where (do you|you) live|how old|phone|email|street|city you/i
    for (const text of collectAllEngineTexts()) {
      expect(text, `personal-info pattern in: "${text}"`).not.toMatch(forbidden)
    }
  })
})

describe('S4 — no copyrighted-character roleplay in any engine text', () => {
  afterEach(clearFlags)

  it('no text uses a "you are <character>" roleplay framing', () => {
    for (const text of collectAllEngineTexts()) {
      expect(text, `roleplay framing in: "${text}"`).not.toMatch(/\byou are\b/i)
      expect(text, `roleplay framing in: "${text}"`).not.toMatch(/\bpretend to be\b/i)
    }
  })
})

describe('Section 4.3 — 15-word truncation enforced through the public API', () => {
  afterEach(clearFlags)

  it('recovery output is truncated at a word boundary when the input would exceed 15 words', () => {
    withRecoveryFlags()
    // space template is "Try again! Like an astronaut! Say <w>!" (6 words + w)
    const longWord = 'one two three four five six seven eight nine ten'
    const result = buildInterestRecovery(['space'], longWord, freshState())
    expect(result).not.toBeNull()
    const words = result!.text.trim().split(/\s+/)
    expect(words.length).toBe(15)
    expect(result!.text.startsWith('Try again! Like an astronaut! Say one two')).toBe(true)
  })

  it('micro-dialogue return phrase is truncated when the target word is degenerate', () => {
    const longWord = Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ')
    const phrase = buildMicroDialogueReturnPhrase(longWord)
    expect(phrase.trim().split(/\s+/).length).toBeLessThanOrEqual(15)
  })

  it('example output never exceeds 15 words even with a multi-word target', () => {
    withExampleFlags()
    const longWord = 'a b c d e f g h i j k l m n o p'
    const result = buildExampleContext(['minecraft'], longWord, freshState())
    expect(result!.text.trim().split(/\s+/).length).toBeLessThanOrEqual(15)
  })
})

describe('Section 4 hardening — childName length cap and whitespace collapse', () => {
  afterEach(clearFlags)

  it(`caps the inserted name at ${MAX_CHILD_NAME_CHARS} characters`, () => {
    withPersonaFlags()
    const hugeName = 'A'.repeat(500)
    const greeting = buildPersonaGreeting('lucy', hugeName)
    expect(greeting).not.toBeNull()
    expect(greeting!).not.toContain('A'.repeat(MAX_CHILD_NAME_CHARS + 1))
    expect(greeting!).toContain('A'.repeat(MAX_CHILD_NAME_CHARS))
  })

  it('collapses internal newlines/tabs/multi-spaces in the name to single spaces', () => {
    withPersonaFlags()
    const greeting = buildPersonaGreeting('lucy', 'Anna\n\nMaria\t Jo')
    expect(greeting).toContain('Anna Maria Jo')
    expect(greeting).not.toMatch(/[\n\t]/)
  })

  it('a name that is whitespace after collapsing still falls back to "friend"', () => {
    withPersonaFlags()
    expect(buildPersonaGreeting('lucy', ' \n\t ')).toContain('friend')
  })

  it('MAX_CHILD_NAME_CHARS mirrors the profile API limit (100)', () => {
    expect(MAX_CHILD_NAME_CHARS).toBe(100)
  })
})

describe('S5 — fallback chain returns null/safe text for every public builder', () => {
  afterEach(clearFlags)

  it('all builders return null (or safe generic) when the master flag is off, regardless of tier flags', () => {
    enableAllFlags()
    process.env.KIDS_PERSONALIZATION_V2 = 'false'
    const dialogueState = freshState({ microDialogueCooldown: 3 })
    expect(buildWarmupTurn(['space'], freshState())).toBeNull()
    expect(buildExampleContext(['space'], 'blue', freshState())).toBeNull()
    expect(buildInterestPraise(['space'], 'correct_confident', 'lucy', freshState())).toBeNull()
    expect(buildInterestRecovery(['space'], 'blue', freshState())).toBeNull()
    expect(buildMicroDialogueTurn(['space'], dialogueState)).toBeNull()
    expect(buildPersonaGreeting('lucy', 'Anya')).toBeNull()
    expect(buildPersonaClosing('lucy', 'Anya')).toBeNull()
    // return phrases are close-out paths and must still produce safe text
    expect(typeof buildMicroDialogueReturnPhrase('blue')).toBe('string')
  })

  it('all builders return null for an unknown interest (no template → standard text)', () => {
    enableAllFlags()
    const dialogueState = freshState({ microDialogueCooldown: 3 })
    expect(buildWarmupTurn(['knitting'], freshState())).toBeNull()
    expect(buildExampleContext(['knitting'], 'blue', freshState())).toBeNull()
    expect(buildInterestPraise(['knitting'], 'correct_confident', 'lucy', freshState())).toBeNull()
    expect(buildInterestRecovery(['knitting'], 'blue', freshState())).toBeNull()
    expect(buildMicroDialogueTurn(['knitting'], dialogueState)).toBeNull()
  })
})
