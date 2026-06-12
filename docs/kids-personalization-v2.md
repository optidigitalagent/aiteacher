# Kids Personalization V2
## Technical Design Document — Phase 0

**Version:** 1.0
**Status:** APPROVED — all 6 reviewers PASS (2026-06-10)
**Prepared:** 2026-06-10
**Goal:** Make Kids lessons feel personally tailored to each child while keeping
Kid's Box curriculum fully authoritative.

**Reviewers required before implementation:**
- [x] planner — architecture sanity ✅ PASS
- [x] backend-reviewer — API, schema, session state ✅ PASS
- [x] frontend-reviewer — UX / teacher persona display ✅ PASS
- [x] curriculum-reviewer — personalization rules, curriculum safety ✅ PASS
- [x] kids-safety-monitor — content safety, auth enforcement ✅ PASS
- [x] qa-tester — test plan coverage ✅ PASS

---

## Core Principle

> **Curriculum controls everything that matters educationally.
> Interests control only how the teacher talks, not what the teacher teaches.**

This is the immutable constraint for every implementation decision in this document.

---

## 1. Personalization Architecture

### 1.1 What Changed Since V1

Kids Onboarding V1 introduced:
- `buildPersonalizedContext(interests, targetWord, tier)` — pure function
- Used only at ENCOURAGEMENT and RECOVERY tiers
- One template per interest per target word (simple string)
- No teacher persona differentiation

Kids Personalization V2 adds:
- **Warmup turn** — interest-based conversation before lesson content (new)
- **Interest-aware examples** — richer, tier-appropriate context phrases (extends V1)
- **Interest-aware praise** — distinct per teacher persona (new)
- **Richer recovery contexts** — more varied templates (extends V1)
- **Micro-dialogues** — one brief personalized turn between exercises (new)
- **Teacher persona differentiation** — Lucy vs Tom tone, style, energy (new)

### 1.2 Architecture Overview

```
┌────────────────────────────────────────────┐
│  PostgreSQL: kids_brain_child_profiles      │
│  { interests[], teacherId, childName }      │
└──────────────┬─────────────────────────────┘
               │ loaded at focus_lesson_start
               ▼
┌────────────────────────────────────────────┐
│  Redis: KidsSessionMemory                   │
│  { interests[], teacherId, childName,       │
│    personalization: { warmupUsed,           │
│    warmupTurnsUsed, warmupStartTime,        │
│    microDialogueCooldown,                   │
│    interestRotationIndex,                   │
│    lastInterestUsed } }                     │
└──────────────┬─────────────────────────────┘
               │ read per turn
               ▼
┌────────────────────────────────────────────┐
│  PersonalizationEngine (pure module)        │
│  buildWarmupTurn()                          │
│  buildExampleContext()                      │
│  buildPraiseText()                          │
│  buildRecoveryContext()                     │
│  buildMicroDialogueTurn()                   │
│  getTeacherPersona()                        │
└──────────────┬─────────────────────────────┘
               │ returns PersonalizationResult | null
               ▼
┌────────────────────────────────────────────┐
│  TeacherResponseRouter                      │
│  Injects personalization into teacher text  │
│  Returns final speech string                │
└──────────────┬─────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│  TTS → ElevenLabs → audio stream           │
└────────────────────────────────────────────┘

CRITICAL: Personalization engine has NO access to:
  - exerciseCorrectCount
  - exerciseAttemptCount
  - escalationLadder
  - completionRule
  - acceptedAnswers
  - currentExerciseId selection logic
  - mastery state
```

### 1.3 Personalization Tiers

| Tier | When it fires | Budget | Notes |
|------|--------------|--------|-------|
| WARMUP | Once per session, before first exercise | max 2 turns / 15s | Returns to curriculum on completion |
| EXAMPLE | During LISTEN_AND_REPEAT teacher model | per turn (optional) | Interest context for target word |
| PRAISE | After correct answer | per turn | Persona-appropriate praise variant |
| RECOVERY | During ENCOURAGEMENT tier | per occurrence | Interest-themed re-invitation |
| MICRO_DIALOGUE | Between exercises | max 1 per 3 exercises | One-turn brief personalized exchange |

### 1.4 PersonalizationResult Type

```typescript
interface PersonalizationResult {
  tier: 'WARMUP' | 'EXAMPLE' | 'PRAISE' | 'RECOVERY' | 'MICRO_DIALOGUE'
  text: string         // the personalized text fragment (≤ 15 words)
  interestUsed: string // which interest tag was used (for logging/rotation)
  shouldContinue?: boolean // for WARMUP/MICRO_DIALOGUE: is more expected?
}
```

### 1.5 Key Invariants (never violated)

1. All personalization functions are **pure** — no state mutation.
2. State updates happen in lesson-ws.ts **after** function returns.
3. Personalization receives `targetWord` READ-ONLY.
4. Personalization result is a **text string only** — never a control signal.
5. If personalization engine throws — catch, log, return null, continue lesson.
6. No async calls in personalization functions — all templates are synchronous.

---

## 2. Interest Taxonomy

### 2.1 Taxonomy (unchanged from V1)

| Tag | Display | Emoji | Category |
|-----|---------|-------|----------|
| `roblox` | Roblox | 🎮 | Video games |
| `brawl_stars` | Brawl Stars | ⚔️ | Video games |
| `minecraft` | Minecraft | 🧱 | Video games |
| `pokemon` | Pokémon | ⭐ | Video games |
| `football` | Football | ⚽ | Sports |
| `animals` | Animals | 🐾 | Nature |
| `space` | Space | 🚀 | Nature |
| `dinosaurs` | Dinosaurs | 🦕 | Nature |
| `drawing` | Drawing | 🎨 | Creative |
| `superheroes` | Superheroes | 🦸 | Stories |
| `princesses` | Princesses | 👑 | Stories |
| `cars` | Cars | 🚗 | Vehicles |

### 2.2 Template Sets Per Interest

Each interest needs templates for 5 tiers. All templates are pre-written strings.
No LLM generation of interest content is permitted in this phase.

**Template function signature:**
```typescript
type TemplateFn = (targetWord: string, childName: string | null) => string
```

#### 2.2.A WARMUP Templates

Used ONCE per session to open the lesson with a personal touch.
Warmup asks ONE question about the child's interest, then transitions to curriculum.

| Interest | Warmup question | Curriculum return phrase |
|---------|----------------|-------------------------|
| `roblox` | "Do you still play Roblox?" | "Great! Let's learn some English words for your game!" |
| `brawl_stars` | "Did you play Brawl Stars this week?" | "Excellent! Now let's learn some English!" |
| `minecraft` | "What are you building in Minecraft?" | "Cool! English will help you read more!" |
| `pokemon` | "Do you have a favourite Pokémon?" | "Wonderful! Let's learn English together!" |
| `football` | "Did you play football recently?" | "Amazing! Let's learn some English words!" |
| `animals` | "What is your favourite animal today?" | "Great! Now let's learn some English!" |
| `space` | "Do you know any planets?" | "Brilliant! Let's explore English words!" |
| `dinosaurs` | "Do you remember your favourite dinosaur?" | "Fantastic! Now let's learn English!" |
| `drawing` | "What did you draw last time?" | "Wonderful! Now let's learn some words!" |
| `superheroes` | "Who is your favourite superhero?" | "Cool! Let's learn English now!" |
| `princesses` | "Do you have a favourite princess?" | "Lovely! Now let's learn some English!" |
| `cars` | "Do you like fast cars or big cars?" | "Great! Let's learn some English words!" |

Warmup flow:
```
Teacher: "[warmup question]"
Child responds (any response accepted — REVIEW/TEACHER_CONTROLLED completion)
Teacher: "[curriculum return phrase] [lesson intro]"
→ proceed to first exercise
```

#### 2.2.B EXAMPLE Templates

Used during LISTEN_AND_REPEAT model to illustrate target word with interest context.
Max 1 sentence, always BEFORE the main instruction.

```typescript
const EXAMPLE_TEMPLATES: Record<string, TemplateFn> = {
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
```

#### 2.2.C PRAISE Templates

Used after CORRECT_CONFIDENT / CORRECT_HESITANT / NEAR_CORRECT.
Varies by teacher persona (see Section 3).

```typescript
const PRAISE_TEMPLATES: Record<string, TemplateFn[]> = {
  roblox:      [(w) => `You got it! A Roblox champion!`, (w) => `Well done! Strong as a Roblox player!`],
  brawl_stars: [(w) => `Awesome! Brawl Stars level!`, (w) => `Great work! Like a Brawl Stars winner!`],
  minecraft:   [(w) => `Perfect! You built that word!`, (w) => `Great job! Minecraft builders would be proud!`],
  pokemon:     [(w) => `Yes! You caught that word!`, (w) => `Well done! Like a Pokémon trainer!`],
  football:    [(w) => `Goal! You did it!`, (w) => `Great! A football champion!`],
  animals:     [(w) => `Roar! You got it!`, (w) => `Well done! Like a brave animal!`],
  space:       [(w) => `Blast off! Correct!`, (w) => `Great work! Like an astronaut!`],
  dinosaurs:   [(w) => `ROAR! That's right!`, (w) => `Excellent! As strong as a dinosaur!`],
  drawing:     [(w) => `Beautiful! You drew that word perfectly!`, (w) => `Great work! An artist's answer!`],
  superheroes: [(w) => `Super! Superhero answer!`, (w) => `Well done! Like a true superhero!`],
  princesses:  [(w) => `Wonderful! A princess answer!`, (w) => `Beautiful! Fit for a princess!`],
  cars:        [(w) => `Vroom! You got it!`, (w) => `Full speed! That's correct!`],
}
```

#### 2.2.D RECOVERY Templates

Used at ENCOURAGEMENT tier. Interest context re-invites without revealing answer.

```typescript
const RECOVERY_TEMPLATES: Record<string, TemplateFn> = {
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
```

#### 2.2.E MICRO_DIALOGUE Templates

Used between exercises (once per ≥3 exercises). One question, no expected correct answer.
Child's response is accepted as TEACHER_CONTROLLED regardless of content.

```typescript
const MICRO_DIALOGUE_TEMPLATES: Record<string, TemplateFn> = {
  roblox:      (_, name) => `By the way — do you like any Roblox games right now?`,
  brawl_stars: (_, name) => `Quick question — do you have a favourite Brawl Stars character?`,
  minecraft:   (_, name) => `Hey — what's the coolest thing in Minecraft?`,
  pokemon:     (_, name) => `Tell me — do you have a favourite Pokémon?`,
  football:    (_, name) => `Quick — what's your favourite football team?`,
  animals:     (_, name) => `What animal do you think is the fastest?`,
  space:       (_, name) => `Quick question — do you know any planet names?`,
  dinosaurs:   (_, name) => `What dinosaur is your favourite?`,
  drawing:     (_, name) => `What do you like to draw most?`,
  superheroes: (_, name) => `If you had a superpower, what would it be?`,
  princesses:  (_, name) => `What is your favourite story?`,
  cars:        (_, name) => `Do you prefer fast cars or big trucks?`,
}
```

### 2.3 Interest Selection Logic

```typescript
function selectInterest(
  interests: string[],
  lastUsed: string | null,
  rotationIndex: number
): string | null {
  if (!interests.length) return null
  // Avoid repeating the same interest twice in a row
  const filtered = interests.length > 1
    ? interests.filter(i => i !== lastUsed)
    : interests
  return filtered[rotationIndex % filtered.length]
}
```

---

## 3. Teacher Personality Behavior

### 3.1 Teacher Persona Definition

```typescript
interface TeacherPersona {
  id: 'lucy' | 'tom' | 'default'
  displayName: string
  energyLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  praiseStyle: 'EXCLAMATORY' | 'WARM_STEADY'
  warmupStyle: 'ENTHUSIASTIC' | 'CALM'
  recoveryStyle: 'ENERGETIC_CHEER' | 'GENTLE_ENCOURAGE'
  openingPhrase: string    // session start greeting
  closingPhrase: string    // session close phrase
}
```

### 3.2 Lucy — High Energy Persona

```typescript
const LUCY_PERSONA: TeacherPersona = {
  id: 'lucy',
  displayName: 'Lucy',
  energyLevel: 'HIGH',
  praiseStyle: 'EXCLAMATORY',
  warmupStyle: 'ENTHUSIASTIC',
  recoveryStyle: 'ENERGETIC_CHEER',
  openingPhrase: "Hi [childName]! I'm Lucy! Let's learn English — are you ready? Let's GO!",
  closingPhrase: "AMAZING work today, [childName]! You did SO well! See you next time!",
}
```

**Lucy praise modifier:** Uses praise template[0] (higher energy variant).
Example: "You got it! A Roblox champion!" → Lucy says: "WOW! You got it! A Roblox champion!"

**Lucy recovery modifier:** Adds energy opener.
Example: "Let's try again! Imagine your Roblox world." → Lucy says: "You can do it! Let's try again! Imagine your Roblox world. Say [word]!"

**Lucy warmup style:** "Oh WOW! Do you play Roblox? That's SO cool! Tell me more!"

### 3.3 Tom — Calm Steady Persona

```typescript
const TOM_PERSONA: TeacherPersona = {
  id: 'tom',
  displayName: 'Tom',
  energyLevel: 'MEDIUM',
  praiseStyle: 'WARM_STEADY',
  warmupStyle: 'CALM',
  recoveryStyle: 'GENTLE_ENCOURAGE',
  openingPhrase: "Hello [childName]! I'm Tom. We're going to learn English today. Ready? Let's start.",
  closingPhrase: "Great work today, [childName]. You should be proud. See you next time.",
}
```

**Tom praise modifier:** Uses praise template[1] (steady variant).
Example: "Well done! Minecraft builders would be proud!" → Tom says: "Well done. Minecraft builders would be proud of that."

**Tom recovery modifier:** Gentle framing.
Example: "Let's try again! Think about Minecraft. Say [word]!" → Tom says: "Take your time. Think about Minecraft. When you're ready — say [word]."

**Tom warmup style:** "Tell me — do you play Roblox? That's good. Let's start our lesson."

### 3.4 Default Persona

Same as Lucy. `id: 'default'` maps to Lucy behavior in all template lookups.

### 3.5 What Persona Controls vs Does Not Control

| Aspect | Persona controls | Notes |
|--------|-----------------|-------|
| Greeting text | YES | openingPhrase template |
| Praise text variant | YES | template[0] vs template[1] |
| Energy prefix on recovery | YES | "You can do it!" vs "Take your time." |
| Warmup opener style | YES | Enthusiastic vs calm |
| Micro-dialogue framing | YES | Minor word-choice variation |
| Closing text | YES | closingPhrase template |
| targetWord | **NO** | Same curriculum for all |
| Escalation ladder | **NO** | Same ladder for all |
| TTS voice | **NO** | Same ElevenLabs voice for all (Phase 6 limitation) |
| Correctness evaluation | **NO** | Same engine for all |
| Exercise selection | **NO** | Same curriculum for all |
| Mastery rules | **NO** | Same thresholds for all |

---

## 4. Safe Personalization Rules

### 4.1 The Boundary Contract

The following rules are NOT negotiable. Implementation must enforce all of them.
Any code review that finds a violation MUST reject the PR.

**ALLOWED — interests may influence:**

| What | Where | Constraint |
|------|-------|-----------|
| Warmup question text | Before first exercise | Max 2 turns, max 15s, must return to curriculum |
| Example context sentence | During teacher model | Max 1 sentence, ≤ 15 words, before main instruction |
| Praise text | After correct answer | Max 1 sentence, must not replace standard praise |
| Recovery re-invitation text | At ENCOURAGEMENT tier | Must always end with target word invitation |
| Micro-dialogue question | Between exercises | Max 1 turn, response accepted as any-response |
| Teacher greeting style | Session open | Template-based only |

**FORBIDDEN — interests must never influence:**

| What | Why |
|------|-----|
| `targetWord` | Curriculum property |
| `acceptedAnswers[]` | Curriculum property |
| `completionRule.type` | Curriculum property |
| `requiredCorrectCount` | Curriculum property |
| `exerciseCorrectCount` | Session state — scoring |
| `exerciseAttemptCount` | Session state — scoring |
| `escalationLadder[]` | Curriculum property |
| When MOVE_ON fires | Curriculum property |
| `currentExerciseId` or next | Curriculum property |
| `effectiveActivityType` | Curriculum property |
| STT classification labels | Engine property |
| ElevenLabs voice config | TTS property |
| Deepgram config | STT property |
| Billing gate | Auth/billing |
| Auth gate | Auth/billing |

### 4.2 Budget Constraints

| Budget rule | Value | Enforcement |
|------------|-------|-------------|
| Warmup turns max | 2 | `warmupTurnsUsed >= 2` → skip warmup return |
| Warmup time max | 15 seconds | `Date.now() - warmupStartTime > 15000` → force return |
| Micro-dialogue cooldown | 3 exercises | `microDialogueCooldown < 3` → skip |
| Micro-dialogue per session | 1 per 3 exercises max | cooldown resets after each micro-dialogue |
| Interest sentences per turn | 1 | Never two interest mentions in same teacher turn |
| Words per interest sentence | 15 | Template enforcement |
| Warmup per session | 1 | `warmupUsed === true` → skip |

### 4.3 Fallback Chain

When personalization is unavailable:

```
Interest available?
  NO → use standard teacher text (no personalization)

Template exists for this interest?
  NO → use standard teacher text

Template throws?
  → catch error, log (no PII), return null, use standard text

Budget exceeded?
  → skip personalization, use standard text

Result > 15 words?
  → truncate at word boundary, return truncated text
```

---

## 5. Curriculum Boundaries

### 5.1 Curriculum Controls These (immutable)

```
KidsBoxUnit → KidsLesson → KidsExercise

KidsExercise {
  exerciseId
  textbookActivityType      ← curriculum only
  targetWord                ← curriculum only
  targetItems[]             ← curriculum only
  acceptedAnswers[]         ← curriculum only
  completionRule            ← curriculum only
  escalationLadder[]        ← curriculum only
  maxAttempts               ← curriculum only
  requiresVisualUI          ← curriculum only
  nextExerciseId            ← curriculum only
}
```

None of these fields are passed to the personalization engine.

### 5.2 Personalization Receives (read-only)

```
PersonalizationInput {
  targetWord: string        ← READ ONLY — never modified
  tier: PersonalizationTier
  interests: string[]       ← read only
  teacherId: string         ← read only
  childName: string | null  ← read only
  sessionPersonalizationState: PersonalizationState  ← read only
}
```

### 5.3 Personalization Returns (text only)

```
PersonalizationResult | null

PersonalizationResult {
  text: string              ← text fragment only, never a control signal
  interestUsed: string      ← for state update in lesson-ws.ts
  shouldContinue?: boolean  ← WARMUP/MICRO_DIALOGUE only: expect child response?
}
```

`text` is concatenated with the standard teacher speech string.
It has NO effect on exercise evaluation, escalation, or completion.

---

## 6. Data Flow

### 6.1 Session Start (focus_lesson_start)

```
lesson-ws.ts: focus_lesson_start handler
  1. Validate JWT → userId
  2. Validate kids_session ownership
  3. Load child profile (existing V1 gate)
     └─ profile.interests → string[]
     └─ profile.teacherId → string
     └─ profile.childName → string | null
  4. Initialize PersonalizationState (NEW)
     └─ warmupUsed: false
     └─ warmupTurnsUsed: 0
     └─ warmupStartTime: null
     └─ microDialogueCooldown: 3 (start at max so warmup comes first)
     └─ interestRotationIndex: 0
     └─ lastInterestUsed: null
  5. Store all in Redis KidsSessionMemory (with 4h TTL)
  6. Kids Brain starts
  7. Warmup fires before first exercise (if interests set)
```

### 6.2 Per-Turn Flow (teacher response generation)

```
KidsBrainOrchestrator.processTurn()
  1. Determine turn type (exercise start, response evaluation, etc.)
  2. Call TeacherResponseRouter.route()
     └─ TeacherResponseRouter reads sessionMemory
     └─ Calls PersonalizationEngine.buildResult(input)
          └─ Returns PersonalizationResult | null
     └─ Injects result.text into teacher speech string
     └─ Returns final speech string
  3. lesson-ws.ts: update personalization state in Redis
     └─ lastInterestUsed = result.interestUsed
     └─ interestRotationIndex++
     └─ warmupTurnsUsed++ (if WARMUP tier)
     └─ warmupUsed = true (if WARMUP just completed)
     └─ microDialogueCooldown = 0 (if MICRO_DIALOGUE just fired)
     └─ microDialogueCooldown++ (after each exercise advance)
```

### 6.3 Warmup Sub-Flow

```
Lesson start
  └─ interests.length > 0 AND !warmupUsed
       └─ PersonalizationEngine.buildWarmupTurn(interest, childName)
            └─ Returns { text: "[warmup question]", shouldContinue: true }
       └─ TeacherResponseRouter: send WARMUP_TURN message
       └─ lesson-ws.ts: set warmupStartTime = Date.now()
       └─ lesson-ws.ts: set warmupTurnsUsed = 1
  └─ Child responds (any response → TEACHER_CONTROLLED, not scored)
  └─ warmupTurnsUsed < 2 AND (Date.now() - warmupStartTime) < 15000?
       └─ Second warmup turn (curriculum return): "[return phrase] [lesson intro]"
       └─ warmupUsed = true, warmupTurnsUsed = 2
  └─ First exercise begins
```

---

## 7. Storage Model

### 7.1 PostgreSQL (kids_brain_child_profiles)

No new columns required. Uses existing V1 fields:
- `high_engagement_topics TEXT[]` — interests (already used)
- `teacher_id VARCHAR(50)` — teacher persona (already used)
- `child_name TEXT` — for greeting (already used)
- `child_age_years INTEGER` — for age-appropriate language (already used)

### 7.2 Redis Session State (KidsSessionMemory)

**Existing fields** (V1, unchanged):
```typescript
{
  sessionId: string
  userId: string
  interests: string[]
  teacherId: string
  childName: string | null
  childAge: number | null
  currentExerciseId: string | null
  exerciseAttemptCount: number
  exerciseCorrectCount: number
  completedExerciseIds: string[]
  hasStartedFirstExercise: boolean
  // ... all existing Kids Brain V1 fields
}
```

**New fields** (V2 additions):
```typescript
{
  personalization: {
    warmupUsed: boolean              // default: false
    warmupTurnsUsed: number          // default: 0, max: 2
    warmupStartTime: number | null   // Unix ms timestamp, null if not started
    microDialogueCooldown: number    // default: 3 (so first dialogue can fire after 3 exercises)
    interestRotationIndex: number    // default: 0, increments per use
    lastInterestUsed: string | null  // default: null
  }
}
```

All state stored in Redis with existing 4h TTL (`EX 14400`).
State updates use existing MULTI/EXEC atomic pattern.

### 7.3 No New DB Migrations Required

V2 personalization is purely session-state and template-based.
No new PostgreSQL tables or columns needed.

---

## 8. Session Memory Model

### 8.1 KidsSessionMemory Extension

```typescript
// backend/src/kids-brain/types/session-memory.ts (add to existing interface)

interface KidsSessionPersonalizationState {
  warmupUsed: boolean
  warmupTurnsUsed: number          // 0 | 1 | 2
  warmupStartTime: number | null
  microDialogueCooldown: number    // exercises since last micro-dialogue
  interestRotationIndex: number
  lastInterestUsed: string | null
}

interface KidsSessionMemory {
  // ... all existing V1 fields ...
  personalization: KidsSessionPersonalizationState  // NEW
}
```

### 8.2 State Transition Rules

```
On session start:
  personalization.warmupUsed = false
  personalization.warmupTurnsUsed = 0
  personalization.warmupStartTime = null
  personalization.microDialogueCooldown = 3  // allow micro-dialogue after 3 exercises
  personalization.interestRotationIndex = 0
  personalization.lastInterestUsed = null

On warmup turn 1:
  warmupStartTime = Date.now()
  warmupTurnsUsed = 1

On warmup turn 2 (curriculum return):
  warmupUsed = true
  warmupTurnsUsed = 2
  warmupStartTime = null  // clear after done

On warmup timeout (> 15s without child response):
  warmupUsed = true  // mark done, skip remaining warmup
  → proceed to lesson

On interest use (any tier):
  lastInterestUsed = selectedInterest
  interestRotationIndex++

On micro-dialogue fire:
  microDialogueCooldown = 0

On exercise advance:
  microDialogueCooldown++  // tracks exercises since last micro-dialogue
```

---

## 9. Acceptance Criteria

All criteria must pass before Phase 9 deployment.

### 9.1 Warmup (Phase 1)

| # | Criterion | Test method |
|---|----------|-------------|
| W1 | Warmup fires once per session when interests are set | Unit test: startSession → warmupUsed=false → first turn type=WARMUP |
| W2 | Warmup does NOT fire if no interests set | Unit test: interests=[] → no WARMUP turn |
| W3 | Warmup does NOT fire on second session (same day) | Unit test: warmupUsed=true → no WARMUP |
| W4 | Warmup max 2 turns | Unit test: after 2 warmup turns, next turn is exercise |
| W5 | Warmup auto-ends after 15s regardless of turns used | Unit test: warmupStartTime + 16000ms → warmup ends |
| W6 | Warmup child response accepted as any-response (TEACHER_CONTROLLED) | Unit test: warmup turn does not score the child |
| W7 | Warmup returns to curriculum after completion | Integration test: post-warmup turn → exercise fires |

### 9.2 Interest-Aware Examples (Phase 2)

| # | Criterion | Test method |
|---|----------|-------------|
| E1 | Example context appears in teacher model when interests set | Unit test: buildExampleContext(interests, targetWord) → non-null string |
| E2 | Example is ≤ 15 words | Unit test: all 12 interest templates under word limit |
| E3 | Example contains targetWord | Unit test: all 12 templates include targetWord parameter |
| E4 | targetWord is not modified by example function | Unit test: targetWord before/after === equal |
| E5 | Example appears BEFORE main instruction | Integration test: "In Roblox... Say blue!" — context precedes instruction |

### 9.3 Interest-Aware Praise (Phase 3)

| # | Criterion | Test method |
|---|----------|-------------|
| P1 | Praise fires after CORRECT_CONFIDENT / CORRECT_HESITANT / NEAR_CORRECT | Unit test: each label triggers praise |
| P2 | Lucy praise uses template[0] (higher energy) | Unit test: lucy persona → template index 0 |
| P3 | Tom praise uses template[1] (steady variant) | Unit test: tom persona → template index 1 |
| P4 | Praise does NOT fire on WRONG_ANSWER or SILENCE | Unit test: wrong/silence → standard escalation, no interest praise |
| P5 | Praise is ≤ 15 words | Unit test: all templates under word limit |

### 9.4 Interest-Aware Recovery (Phase 4)

| # | Criterion | Test method |
|---|----------|-------------|
| R1 | Recovery fires at ENCOURAGEMENT tier | Unit test: escalationLadder[ENCOURAGEMENT] → recovery with interest |
| R2 | Recovery always ends with target word invitation | Unit test: all templates include `${targetWord}` suffix |
| R3 | Recovery does NOT reveal answer for WRONG_ANSWER before ENCOURAGEMENT | Unit test: WRONG_ANSWER at attempt 1 → REPEAT_PROMPT, no recovery |
| R4 | Recovery does NOT fire at MODEL_ANSWER or MOVE_ON tiers | Unit test: those tiers → standard text only |

### 9.5 Micro-Dialogues (Phase 5)

| # | Criterion | Test method |
|---|----------|-------------|
| M1 | Micro-dialogue fires after ≥3 exercises | Unit test: microDialogueCooldown < 3 → no dialogue |
| M2 | Micro-dialogue fires at most once per 3 exercises | Unit test: dialogue fired → cooldown reset to 0 |
| M3 | Micro-dialogue is 1 turn only | Unit test: dialogue answer → immediate return to curriculum |
| M4 | Micro-dialogue response is TEACHER_CONTROLLED (any response accepted) | Unit test: any STT output → advance |
| M5 | Micro-dialogue does NOT score the child | Unit test: exerciseCorrectCount unchanged after micro-dialogue |

### 9.6 Teacher Personas (Phase 6)

| # | Criterion | Test method |
|---|----------|-------------|
| T1 | Lucy greeting uses LUCY openingPhrase | Unit test: teacherId=lucy → openingPhrase contains "Lucy" |
| T2 | Tom greeting uses TOM openingPhrase | Unit test: teacherId=tom → openingPhrase contains "Tom" |
| T3 | default maps to Lucy behavior | Unit test: teacherId=default → same output as lucy |
| T4 | Lucy praise is measurably different from Tom praise | Unit test: same input, lucy vs tom → different strings |
| T5 | Both personas use same curriculum | Unit test: exercise data identical for lucy and tom sessions |
| T6 | Both personas use same TTS voice (Phase 6 limitation) | No test needed — config unchanged |

### 9.7 Curriculum Integrity (all phases)

| # | Criterion | Test method |
|---|----------|-------------|
| C1 | targetWord not modified by any V2 function | Unit test: all 5 builder functions return new string, input unchanged |
| C2 | acceptedAnswers not modified | Unit test: session state before/after personalization call — identical |
| C3 | exerciseCorrectCount not modified | Unit test: personalization call → count unchanged |
| C4 | escalationLadder not modified | Unit test: escalationLadder before/after personalization call — identical |
| C5 | Adult lesson flow unaffected (no Kids code on adult path) | Integration test: adult WS path → no personalization engine called |
| C6 | Kids Brain V1 28/28 criteria still pass | Run Kids Brain V1 test suite |

### 9.8 Safety (Phase 7)

| # | Criterion | Test method |
|---|----------|-------------|
| S1 | No open-ended LLM generation for interest content | Code review: all templates are static strings |
| S2 | Warmup never exceeds 2 turns | Unit test: W4 above |
| S3 | Interest content never asks for personal info (real name, school, address) | Template review: all warmup/micro-dialogue questions are generic |
| S4 | No copyrighted character roleplay in templates | Template review: "Imagine" framing used, no "You are Mario" patterns |
| S5 | Personalization engine failure is caught and lesson continues | Unit test: engine throw → null returned → standard text used |

### 9.9 QA (Phase 8)

| # | Criterion | Test |
|---|----------|------|
| Q1 | TypeScript build: npx tsc --noEmit → exit 0 | Automated |
| Q2 | npm test → all pass (no new failures) | Automated |
| Q3 | Kids Brain V1 Run 5 28/28 criteria unchanged | Automated |
| Q4 | Interest personalization test suite: ≥40 new tests green | Automated |

---

## 10. Rollback Plan

### 10.1 Feature Flags

```
KIDS_PERSONALIZATION_V2=true        (master toggle — disables all V2 if false)
KIDS_WARMUP_ENABLED=true            (Phase 1)
KIDS_INTEREST_EXAMPLES_V2=true      (Phase 2 — extends V1 examples)
KIDS_INTEREST_PRAISE=true           (Phase 3)
KIDS_INTEREST_RECOVERY_V2=true      (Phase 4 — extends V1 recovery)
KIDS_MICRO_DIALOGUE_ENABLED=true    (Phase 5)
KIDS_TEACHER_PERSONAS_V2=true       (Phase 6)
```

All flags default to `false` at deploy and enabled one phase at a time.

### 10.2 Rollback Procedure

| Issue | Action | Time to recovery |
|-------|--------|-----------------|
| Warmup turns don't end | Set KIDS_WARMUP_ENABLED=false | < 2 minutes |
| Micro-dialogue derails lesson | Set KIDS_MICRO_DIALOGUE_ENABLED=false | < 2 minutes |
| Persona text wrong | Set KIDS_TEACHER_PERSONAS_V2=false | < 2 minutes |
| Personalization engine throws in prod | KIDS_PERSONALIZATION_V2=false | < 2 minutes |
| Kids Brain V1 regression | Revert to commit before V2 | < 10 minutes |
| Adult flow regression | KIDS_PERSONALIZATION_V2=false (kids-only code path) | < 2 minutes |

### 10.3 V1 Compatibility

V1 interest-personalizer.ts remains functional when `KIDS_PERSONALIZATION_V2=false`.
V2 extends V1 without removing it.
No V1 functionality is removed in V2.

---

## 11. Implementation Files

| Phase | What | Files |
|-------|------|-------|
| 0 | Design document | `docs/kids-personalization-v2.md` |
| 1 | Warmup engine + session state extension | `backend/src/kids-brain/teacher-response/personalization-engine.ts` (new) |
| 1 | Session state extension | `backend/src/kids-brain/types/session-memory.ts` (extend) |
| 1 | lesson-ws.ts warmup integration | `backend/src/ws/lesson-ws.ts` (extend) |
| 2 | Example templates + V2 interest engine | `personalization-engine.ts` (extend) |
| 3 | Praise templates | `personalization-engine.ts` (extend) |
| 4 | Recovery templates | `personalization-engine.ts` (extend) |
| 5 | Micro-dialogue engine + session state | `personalization-engine.ts` (extend) + `lesson-ws.ts` |
| 6 | Teacher persona definitions + router | `backend/src/kids-brain/teacher-response/teacher-personas.ts` (new) |
| 7 | Safety tests + rate limit enforcement | `personalization-engine.ts` (guard functions) |
| 8 | Full test suite | `backend/src/kids-brain/teacher-response/__tests__/personalization-engine.test.ts` (new) |
| 9 | QA + deploy | Railway + acceptance audit |

---

## 12. Review Sign-Off

This document requires approval from all reviewers before Phase 1 implementation begins.

| Reviewer | Role | Status | Notes |
|----------|------|--------|-------|
| planner | Architecture | ✅ PASS | Pure module pattern correct; feature flags correct; no circular deps |
| backend-reviewer | Session state, data flow | ✅ PASS | Redis serialization noted (RISK-010); atomicity noted (RISK-011) |
| frontend-reviewer | Teacher persona display | ✅ PASS | Transparent to frontend; same TTS voice limitation documented |
| curriculum-reviewer | Personalization rules, boundaries | ✅ PASS | Boundaries explicit; template safety confirmed |
| kids-safety-monitor | Content safety, budget limits | ✅ PASS | All templates pre-written; no PII; no copyrighted roleplay |
| qa-tester | Test plan coverage | ✅ PASS | 40 ACs defined; W5 needs fake timers; persona tests need string diff |
