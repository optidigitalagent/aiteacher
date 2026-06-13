/**
 * PersonalizationEngine — Kids Personalization V2, Phase 1 (Warmups).
 *
 * Pure module: no state mutation, no async calls, no side effects.
 * All errors are caught internally; callers receive null on any failure.
 *
 * Feature flags (must be 'true' string to enable):
 *   KIDS_PERSONALIZATION_V2    — master toggle
 *   KIDS_WARMUP_ENABLED        — Phase 1 warmup turns
 *   KIDS_INTEREST_EXAMPLES_V2  — Phase 2 example context during teacher model
 *   KIDS_INTEREST_PRAISE       — Phase 3 interest praise after CORRECT_* labels
 *   KIDS_INTEREST_RECOVERY_V2  — Phase 4 interest recovery at ENCOURAGEMENT tier
 *   KIDS_MICRO_DIALOGUE_ENABLED — Phase 5 one-turn dialogue between exercises
 *   KIDS_TEACHER_PERSONA_V2    — Phase 6 persona greeting/closing speech
 *
 * SAFETY CONTRACT (immutable):
 *   - This module receives targetWord READ-ONLY and never modifies it.
 *   - It never touches: acceptedAnswers, completionRule, escalationLadder,
 *     exerciseCorrectCount, exerciseAttemptCount, or currentExerciseId.
 *   - All templates are static strings — no LLM generation of interest content.
 *   - Personalization result is a text string only, never a control signal.
 */

import type { KidsSessionPersonalizationState } from '../contracts/session-memory.js'
import { getTeacherPersona } from './teacher-personas.js'

export type PersonalizationTier =
  | 'WARMUP'
  | 'EXAMPLE'
  | 'PRAISE'
  | 'RECOVERY'
  | 'MICRO_DIALOGUE'

export interface PersonalizationResult {
  tier: PersonalizationTier
  text: string
  interestUsed: string
  shouldContinue?: boolean
}

// ── Feature flags ─────────────────────────────────────────────────────────────

export function isPersonalizationV2Enabled(): boolean {
  return process.env.KIDS_PERSONALIZATION_V2 === 'true'
}

export function isWarmupEnabled(): boolean {
  return process.env.KIDS_WARMUP_ENABLED === 'true'
}

export function isInterestExamplesEnabled(): boolean {
  return process.env.KIDS_INTEREST_EXAMPLES_V2 === 'true'
}

export function isInterestPraiseEnabled(): boolean {
  return process.env.KIDS_INTEREST_PRAISE === 'true'
}

export function isInterestRecoveryEnabled(): boolean {
  return process.env.KIDS_INTEREST_RECOVERY_V2 === 'true'
}

export function isMicroDialogueEnabled(): boolean {
  return process.env.KIDS_MICRO_DIALOGUE_ENABLED === 'true'
}

export function isTeacherPersonaEnabled(): boolean {
  return process.env.KIDS_TEACHER_PERSONA_V2 === 'true'
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TEXT_WORDS = 15
export const WARMUP_TIMEOUT_MS = 15_000
export const WARMUP_MAX_TURNS = 2
export const MICRO_DIALOGUE_COOLDOWN_EXERCISES = 3
// Engine-local cap mirroring the profile API limit (kids-profile-routes), so
// the spoken-text guarantee does not depend on every write path validating.
export const MAX_CHILD_NAME_CHARS = 100

// ── Warmup templates ─────────────────────────────────────────────────────────

interface WarmupTemplate {
  question: () => string
  returnPhrase: () => string
}

const WARMUP_TEMPLATES: Readonly<Record<string, WarmupTemplate>> = {
  roblox:      { question: () => 'Do you still play Roblox?',               returnPhrase: () => "Great! Let's learn some English words for your game!" },
  brawl_stars: { question: () => 'Did you play Brawl Stars this week?',      returnPhrase: () => "Excellent! Now let's learn some English!" },
  minecraft:   { question: () => 'What are you building in Minecraft?',      returnPhrase: () => "Cool! English will help you read more!" },
  pokemon:     { question: () => 'Do you have a favourite Pokémon?',         returnPhrase: () => "Wonderful! Let's learn English together!" },
  football:    { question: () => 'Did you play football recently?',          returnPhrase: () => "Amazing! Let's learn some English words!" },
  animals:     { question: () => 'What is your favourite animal today?',     returnPhrase: () => "Great! Now let's learn some English!" },
  space:       { question: () => 'Do you know any planets?',                 returnPhrase: () => "Brilliant! Let's explore English words!" },
  dinosaurs:   { question: () => 'Do you remember your favourite dinosaur?', returnPhrase: () => "Fantastic! Now let's learn English!" },
  drawing:     { question: () => 'What did you draw last time?',             returnPhrase: () => "Wonderful! Now let's learn some words!" },
  superheroes: { question: () => 'Who is your favourite superhero?',         returnPhrase: () => "Cool! Let's learn English now!" },
  princesses:  { question: () => 'Do you have a favourite princess?',        returnPhrase: () => "Lovely! Now let's learn some English!" },
  cars:        { question: () => 'Do you like fast cars or big cars?',       returnPhrase: () => "Great! Let's learn some English words!" },
}

// ── Example templates ─────────────────────────────────────────────────────────
// Illustrate the target word with interest context during the teacher model.
// targetWord is interpolated READ-ONLY — templates never alter it.

type ExampleTemplateFn = (word: string) => string

const EXAMPLE_TEMPLATES: Readonly<Record<string, ExampleTemplateFn>> = {
  roblox:      (w) => `In Roblox, can you find something ${w}?`,
  brawl_stars: (w) => `Some Brawl Stars characters are ${w}!`,
  minecraft:   (w) => `Imagine a ${w} Minecraft block!`,
  pokemon:     (w) => `Some Pokémon are ${w}!`,
  football:    (w) => `Football shirts can be ${w}!`,
  animals:     (w) => `Some animals are ${w}!`,
  space:       (w) => `Stars in space can be ${w}!`,
  dinosaurs:   (w) => `Some dinosaurs were ${w}!`,
  drawing:     (w) => `Can you draw something ${w}?`,
  superheroes: (w) => `Some superheroes wear ${w}!`,
  princesses:  (w) => `Princesses love the colour ${w}!`,
  cars:        (w) => `Some cars are ${w}!`,
}

// ── Recovery templates ────────────────────────────────────────────────────────
// Used at the ENCOURAGEMENT escalation tier only (R1). Interest context
// re-invites without revealing the answer; every template ends with the
// target word invitation "Say ${w}!" (R2).

const RECOVERY_TEMPLATES: Readonly<Record<string, (word: string) => string>> = {
  roblox:      (w) => `Let's try again! Imagine your Roblox world. Say ${w}!`,
  brawl_stars: (w) => `Try again! Like a Brawl Stars champion! Say ${w}!`,
  minecraft:   (w) => `Let's try again! Think about Minecraft. Say ${w}!`,
  pokemon:     (w) => `One more time! Like a Pokémon trainer. Say ${w}!`,
  football:    (w) => `Try again! Like a football player! Say ${w}!`,
  animals:     (w) => `One more try! Think about your favourite animal. Say ${w}!`,
  space:       (w) => `Try again! Like an astronaut! Say ${w}!`,
  dinosaurs:   (w) => `Let's try again! Brave as a dinosaur! Say ${w}!`,
  drawing:     (w) => `Try again! An artist can do it! Say ${w}!`,
  superheroes: (w) => `One more time! Superheroes never give up. Say ${w}!`,
  princesses:  (w) => `Try again! You can do it! Say ${w}!`,
  cars:        (w) => `Rev up! Let's try again! Say ${w}!`,
}

// ── Micro-dialogue templates ──────────────────────────────────────────────────
// One brief question between exercises (≥3 exercise cooldown). The child's
// reply is accepted as any-response (TEACHER_CONTROLLED) and never scored;
// the teacher returns to curriculum immediately after (M3, M4, M5).

const MICRO_DIALOGUE_TEMPLATES: Readonly<Record<string, () => string>> = {
  roblox:      () => 'By the way — do you like any Roblox games right now?',
  brawl_stars: () => 'Quick question — do you have a favourite Brawl Stars character?',
  minecraft:   () => "Hey — what's the coolest thing in Minecraft?",
  pokemon:     () => 'Tell me — do you have a favourite Pokémon?',
  football:    () => "Quick — what's your favourite football team?",
  animals:     () => 'What animal do you think is the fastest?',
  space:       () => 'Quick question — do you know any planet names?',
  dinosaurs:   () => 'What dinosaur is your favourite?',
  drawing:     () => 'What do you like to draw most?',
  superheroes: () => 'If you had a superpower, what would it be?',
  princesses:  () => 'What is your favourite story?',
  cars:        () => 'Do you prefer fast cars or big trucks?',
}

// ── Praise templates ──────────────────────────────────────────────────────────
// Two variants per interest: [0] EXCLAMATORY (Lucy/default), [1] WARM_STEADY (Tom).
// Praise ADDS to standard Kids Brain praise — it never replaces it.

type PraiseTemplatePair = readonly [() => string, () => string]

const PRAISE_TEMPLATES: Readonly<Record<string, PraiseTemplatePair>> = {
  roblox:      [() => 'You got it! A Roblox champion!',             () => 'Well done! Strong as a Roblox player!'],
  brawl_stars: [() => 'Awesome! Brawl Stars level!',                () => 'Great work! Like a Brawl Stars winner!'],
  minecraft:   [() => 'Perfect! You built that word!',              () => 'Great job! Minecraft builders would be proud!'],
  pokemon:     [() => 'Yes! You caught that word!',                 () => 'Well done! Like a Pokémon trainer!'],
  football:    [() => 'Goal! You did it!',                          () => 'Great! A football champion!'],
  animals:     [() => 'Roar! You got it!',                          () => 'Well done! Like a brave animal!'],
  space:       [() => 'Blast off! Correct!',                        () => 'Great work! Like an astronaut!'],
  dinosaurs:   [() => "ROAR! That's right!",                        () => 'Excellent! As strong as a dinosaur!'],
  drawing:     [() => 'Beautiful! You drew that word perfectly!',   () => "Great work! An artist's answer!"],
  superheroes: [() => 'Super! Superhero answer!',                   () => 'Well done! Like a true superhero!'],
  princesses:  [() => 'Wonderful! A princess answer!',              () => 'Beautiful! Fit for a princess!'],
  cars:        [() => 'Vroom! You got it!',                         () => "Full speed! That's correct!"],
}

/** Classification labels that qualify for interest praise (P1/P4). */
export const PRAISE_ELIGIBLE_LABELS: ReadonlySet<string> = new Set([
  'correct_confident',
  'correct_hesitant',
  'near_correct',
])

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncateAtWordBudget(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ')
}

// ── Interest selection ────────────────────────────────────────────────────────

/**
 * Pick the next interest to use, avoiding repeating the same one twice in a row.
 * Pure function — no side effects.
 */
export function selectInterest(
  interests: string[],
  lastUsed: string | null,
  rotationIndex: number,
): string | null {
  if (!interests || interests.length === 0) return null
  const pool =
    interests.length > 1 ? interests.filter(i => i !== lastUsed) : interests
  const idx = rotationIndex % pool.length
  return pool[idx] ?? null
}

// ── Session state factory ─────────────────────────────────────────────────────

/**
 * Create the initial personalization state for a new session.
 * microDialogueCooldown counts exercises completed since the last
 * micro-dialogue (count-up). It starts at 0 so the first micro-dialogue is
 * eligible only after MICRO_DIALOGUE_COOLDOWN_EXERCISES (3) exercises have
 * been completed (M1); lesson-ws.ts increments it on each exercise advance
 * and resets it to 0 when a dialogue fires (M2).
 */
export function createInitialPersonalizationState(): KidsSessionPersonalizationState {
  return {
    warmupUsed: false,
    warmupTurnsUsed: 0,
    warmupStartTime: null,
    microDialogueCooldown: 0,
    interestRotationIndex: 0,
    lastInterestUsed: null,
    microDialogueInProgress: false,
  }
}

// ── Warmup functions ──────────────────────────────────────────────────────────

/**
 * Build the first warmup turn (question to the child).
 *
 * Returns null when:
 *   - Feature flags disabled
 *   - No interests set
 *   - Warmup already used this session
 *   - Budget exhausted
 *   - Any error occurs (caught internally)
 *
 * PURE — caller updates state in lesson-ws.ts after receiving the result.
 */
export function buildWarmupTurn(
  interests: string[],
  state: KidsSessionPersonalizationState,
): PersonalizationResult | null {
  try {
    if (!isPersonalizationV2Enabled()) return null
    if (!isWarmupEnabled()) return null
    if (!interests || interests.length === 0) return null
    if (state.warmupUsed) return null
    if (state.warmupTurnsUsed >= WARMUP_MAX_TURNS) return null

    const interest = selectInterest(
      interests,
      state.lastInterestUsed,
      state.interestRotationIndex,
    )
    if (!interest) return null

    const template = WARMUP_TEMPLATES[interest]
    if (!template) return null

    const text = truncateAtWordBudget(template.question(), MAX_TEXT_WORDS)

    return {
      tier: 'WARMUP',
      text,
      interestUsed: interest,
      shouldContinue: true,
    }
  } catch (err) {
    console.error(
      '[personalization-engine] buildWarmupTurn error (non-fatal):',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

/**
 * Build the curriculum return phrase (second warmup turn).
 * Called after the child has responded to the warmup question.
 *
 * Returns null when interest has no template or any error occurs.
 * PURE — no state mutation.
 */
export function buildWarmupReturnPhrase(interestUsed: string): string | null {
  try {
    const template = WARMUP_TEMPLATES[interestUsed]
    if (!template) return null
    return truncateAtWordBudget(template.returnPhrase(), MAX_TEXT_WORDS)
  } catch (err) {
    console.error(
      '[personalization-engine] buildWarmupReturnPhrase error (non-fatal):',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

// ── Recovery functions (Phase 4) ─────────────────────────────────────────────

/**
 * Build an interest-aware recovery re-invitation for the ENCOURAGEMENT tier.
 * Caller (turn-processor Step 6C) gates on tier === ENCOURAGEMENT, so other
 * escalation rungs always use standard text (R3, R4).
 *
 * Returns null when:
 *   - Feature flags disabled (master or KIDS_INTEREST_RECOVERY_V2)
 *   - No interests set or no targetWord
 *   - Selected interest has no template
 *   - Any error occurs (caught internally)
 *
 * READ-ONLY — does not rotate interest state (recovery may repeat the same
 * interest across attempts of the same word; rotation advances only on
 * example/praise in lesson-ws.ts).
 */
export function buildInterestRecovery(
  interests: string[],
  targetWord: string,
  state: KidsSessionPersonalizationState,
): PersonalizationResult | null {
  try {
    if (!isPersonalizationV2Enabled()) return null
    if (!isInterestRecoveryEnabled()) return null
    if (!interests || interests.length === 0) return null
    if (!targetWord || targetWord.trim().length === 0) return null

    const interest = selectInterest(
      interests,
      state.lastInterestUsed,
      state.interestRotationIndex,
    )
    if (!interest) return null

    const template = RECOVERY_TEMPLATES[interest]
    if (!template) return null

    const text = truncateAtWordBudget(template(targetWord), MAX_TEXT_WORDS)

    return {
      tier: 'RECOVERY',
      text,
      interestUsed: interest,
    }
  } catch (err) {
    console.error(
      '[personalization-engine] buildInterestRecovery error (non-fatal):',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

// ── Praise functions (Phase 3) ───────────────────────────────────────────────

/**
 * Build an interest-aware praise sentence after a correct answer.
 * Persona selects the variant: EXCLAMATORY → [0] (Lucy/default),
 * WARM_STEADY → [1] (Tom). (P2/P3)
 *
 * Returns null when:
 *   - Feature flags disabled (master or KIDS_INTEREST_PRAISE)
 *   - classificationLabel is not CORRECT_CONFIDENT / CORRECT_HESITANT /
 *     NEAR_CORRECT (P1, P4 — never on wrong answers or silence)
 *   - No interests set or selected interest has no template
 *   - Any error occurs (caught internally)
 *
 * PURE — never modifies inputs. Caller updates rotation state in lesson-ws.ts.
 */
export function buildInterestPraise(
  interests: string[],
  classificationLabel: string,
  teacherId: string,
  state: KidsSessionPersonalizationState,
): PersonalizationResult | null {
  try {
    if (!isPersonalizationV2Enabled()) return null
    if (!isInterestPraiseEnabled()) return null
    if (!PRAISE_ELIGIBLE_LABELS.has(classificationLabel)) return null
    if (!interests || interests.length === 0) return null

    const interest = selectInterest(
      interests,
      state.lastInterestUsed,
      state.interestRotationIndex,
    )
    if (!interest) return null

    const pair = PRAISE_TEMPLATES[interest]
    if (!pair) return null

    const persona = getTeacherPersona(teacherId ?? '')
    const variant = persona.praiseStyle === 'WARM_STEADY' ? pair[1] : pair[0]
    const text = truncateAtWordBudget(variant(), MAX_TEXT_WORDS)

    return {
      tier: 'PRAISE',
      text,
      interestUsed: interest,
    }
  } catch (err) {
    console.error(
      '[personalization-engine] buildInterestPraise error (non-fatal):',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

// ── Example functions (Phase 2) ───────────────────────────────────────────────

/**
 * Build an interest-aware example sentence for the current target word,
 * spoken before the teacher model instruction (E5).
 *
 * Returns null when:
 *   - Feature flags disabled (master or KIDS_INTEREST_EXAMPLES_V2)
 *   - No interests set or no targetWord
 *   - Selected interest has no template
 *   - Any error occurs (caught internally)
 *
 * PURE — never modifies targetWord, interests, or state (E4).
 * Caller updates rotation state in lesson-ws.ts after receiving the result.
 */
export function buildExampleContext(
  interests: string[],
  targetWord: string,
  state: KidsSessionPersonalizationState,
): PersonalizationResult | null {
  try {
    if (!isPersonalizationV2Enabled()) return null
    if (!isInterestExamplesEnabled()) return null
    if (!interests || interests.length === 0) return null
    if (!targetWord || targetWord.trim().length === 0) return null

    const interest = selectInterest(
      interests,
      state.lastInterestUsed,
      state.interestRotationIndex,
    )
    if (!interest) return null

    const template = EXAMPLE_TEMPLATES[interest]
    if (!template) return null

    const text = truncateAtWordBudget(template(targetWord), MAX_TEXT_WORDS)

    return {
      tier: 'EXAMPLE',
      text,
      interestUsed: interest,
    }
  } catch (err) {
    console.error(
      '[personalization-engine] buildExampleContext error (non-fatal):',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

// ── Micro-dialogue functions (Phase 5) ───────────────────────────────────────

/**
 * Build a one-turn micro-dialogue question fired between exercises.
 *
 * Returns null when:
 *   - Feature flags disabled (master or KIDS_MICRO_DIALOGUE_ENABLED)
 *   - No interests set
 *   - Cooldown not reached: fewer than MICRO_DIALOGUE_COOLDOWN_EXERCISES (3)
 *     exercises completed since the last dialogue (M1, M2)
 *   - A dialogue or warmup is already in progress
 *   - Selected interest has no template
 *   - Any error occurs (caught internally)
 *
 * PURE — caller (lesson-ws.ts) resets cooldown to 0, sets
 * microDialogueInProgress, and rotates interest state after firing.
 */
export function buildMicroDialogueTurn(
  interests: string[],
  state: KidsSessionPersonalizationState,
): PersonalizationResult | null {
  try {
    if (!isPersonalizationV2Enabled()) return null
    if (!isMicroDialogueEnabled()) return null
    if (!interests || interests.length === 0) return null
    if (state.microDialogueCooldown < MICRO_DIALOGUE_COOLDOWN_EXERCISES) return null
    if (state.microDialogueInProgress === true) return null
    if (isWarmupInProgress(state)) return null

    const interest = selectInterest(
      interests,
      state.lastInterestUsed,
      state.interestRotationIndex,
    )
    if (!interest) return null

    const template = MICRO_DIALOGUE_TEMPLATES[interest]
    if (!template) return null

    const text = truncateAtWordBudget(template(), MAX_TEXT_WORDS)

    return {
      tier: 'MICRO_DIALOGUE',
      text,
      interestUsed: interest,
      shouldContinue: true,
    }
  } catch (err) {
    console.error(
      '[personalization-engine] buildMicroDialogueTurn error (non-fatal):',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

/**
 * Build the curriculum return phrase spoken after the child replies to a
 * micro-dialogue question (M3 — immediate return, never an open chat).
 * Re-invites the current target word when one is active.
 *
 * Returns a non-null string in all non-throwing paths so the dialogue can
 * always be closed; falls back to a generic return line on error.
 */
export function buildMicroDialogueReturnPhrase(targetWord: string | null): string {
  const generic = "Nice! Back to our lesson!"
  try {
    if (!targetWord || targetWord.trim().length === 0) return generic
    return truncateAtWordBudget(
      `Nice! Back to our lesson — say ${targetWord}!`,
      MAX_TEXT_WORDS,
    )
  } catch (err) {
    console.error(
      '[personalization-engine] buildMicroDialogueReturnPhrase error (non-fatal):',
      err instanceof Error ? err.message : err,
    )
    return generic
  }
}

/**
 * Returns true when a micro-dialogue question has been asked and the child's
 * reply has not yet been received (undefined → false for pre-Phase-5 sessions).
 */
export function isMicroDialogueInProgress(state: KidsSessionPersonalizationState): boolean {
  return state.microDialogueInProgress === true
}

// ── Persona greeting/closing (Phase 6) ───────────────────────────────────────

/** Replace every [childName] placeholder; empty/missing name → "friend". */
export function substituteChildName(template: string, childName: string | null): string {
  // Whitespace (incl. newlines/tabs) collapsed and length capped so a single
  // unvalidated write path can never blow up the spoken greeting.
  const cleaned = childName
    ? childName.trim().replace(/\s+/g, ' ').slice(0, MAX_CHILD_NAME_CHARS)
    : ''
  const name = cleaned.length > 0 ? cleaned : 'friend'
  // Function replacer: the name is inserted as plain text — String.replace
  // must never interpret $-sequences ($&, $', $`, $$) from a profile name.
  return template.replace(/\[childName\]/g, () => name)
}

/**
 * Persona-specific session greeting (T1, T2). Replaces the scripted opening
 * ONLY when the persona flags are on; null keeps the standard greeting.
 * Personas affect text only — curriculum, exercises, and TTS voice are
 * untouched (T5; design Section 3.5).
 */
export function buildPersonaGreeting(
  teacherId: string,
  childName: string | null,
): string | null {
  try {
    if (!isPersonalizationV2Enabled()) return null
    if (!isTeacherPersonaEnabled()) return null
    const persona = getTeacherPersona(teacherId ?? '')
    return substituteChildName(persona.openingPhrase, childName)
  } catch (err) {
    console.error(
      '[personalization-engine] buildPersonaGreeting error (non-fatal):',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

/**
 * Persona-specific closing line spoken before lesson_end on natural session
 * close. Null (flags off / error) keeps the standard close flow unchanged.
 */
export function buildPersonaClosing(
  teacherId: string,
  childName: string | null,
): string | null {
  try {
    if (!isPersonalizationV2Enabled()) return null
    if (!isTeacherPersonaEnabled()) return null
    const persona = getTeacherPersona(teacherId ?? '')
    return substituteChildName(persona.closingPhrase, childName)
  } catch (err) {
    console.error(
      '[personalization-engine] buildPersonaClosing error (non-fatal):',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

/**
 * Returns true when the warmup time budget (15s) has been exceeded.
 * Used to force-complete a warmup that has stalled.
 */
export function isWarmupTimedOut(state: KidsSessionPersonalizationState): boolean {
  if (!state.warmupStartTime) return false
  return Date.now() - state.warmupStartTime > WARMUP_TIMEOUT_MS
}

/**
 * Returns true when warmup is currently in progress (question asked, awaiting child response).
 */
export function isWarmupInProgress(state: KidsSessionPersonalizationState): boolean {
  return !state.warmupUsed && state.warmupTurnsUsed === 1
}
