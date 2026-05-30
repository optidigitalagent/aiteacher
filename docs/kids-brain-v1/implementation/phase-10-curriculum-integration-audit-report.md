# Phase 10 — Curriculum Integration Audit Report

**Date:** 2026-05-30
**Status:** COMPLETE — Audit/Design Only
**TypeScript errors:** 0
**Kids-brain tests:** 363 / 363 passing
**Code modified:** NONE

---

## 1. Executive Summary

Kids Brain v1 is operationally functional: target persistence works, placeholder bug is fixed,
TTS and Redis/Postgres are working, and the runtime pipeline is stable at 363/363 tests.

The system is blocked on a single architectural gap: it has no curriculum layer. Every session
uses the same six hardcoded animal words (`KIDS_PROTOTYPE_TARGET_WORDS` in `lesson-ws.ts:112`)
with no lesson plan, no story hook, no chant, no phase-aware activity sequence, and no
connection to the lesson format defined in `docs/kids-brain-v1/research/pack3/lesson-format-spec.md`.

This audit defines the minimum bridge between curriculum content and the Kids Brain v1 runtime.
No code is written here. This document is the design specification for Phase 10A–10H.

---

## 2. Recommended Curriculum Architecture

### Principle

Curriculum content is static, backend-owned, and Git-versioned as TypeScript constant files.

The backend is the sole authority on which lesson a child receives. The frontend never selects
curriculum. The LLM never generates curriculum content. All curriculum decisions are deterministic.

### Storage Strategy

| Content type | Storage | Rationale |
|---|---|---|
| Lesson plans, unit structure, item definitions | TypeScript const files in `backend/src/kids-brain/curriculum/` | Type-safe, testable, Git-versioned, zero DB cost |
| Child mastery records | Postgres (`kids_brain_mastery_records`) | Already defined in Patch 3 |
| Active session state including current lesson | Redis (`kids-brain:session:{sessionId}`) | Already defined in Patch 1 |
| Which lesson to load next | Postgres child profile + progression state | Backend-computed at session start |

### What NEVER lives in code

- Copyrighted textbook text (story scripts, song lyrics from any publisher)
- Audio recordings from commercial sources
- Character artwork or illustration reproductions

### What IS versioned in Git

- All curriculum schemas (TypeScript interfaces)
- Prototype lesson files (original Mentium-authored content)
- Unit topic sequence and vocabulary lists
- Sentence pattern templates
- Chant lines (original, not copied from textbook)
- Story hook scripts (original, not copied from textbook)
- Visual asset manifest (references to asset files, not the files themselves)

### For v1

Use TypeScript constant files only. No YAML, no JSON, no database-backed curriculum.
A `CurriculumLoader` module converts file exports to runtime `LessonPlan` objects.
Database-backed curriculum is a v2 concern (required only when content is authored by
non-engineers or when a CMS is needed).

---

## 3. Minimum Curriculum Schema

These are TypeScript interfaces only. No content is defined here.

```typescript
// backend/src/kids-brain/curriculum/curriculum-types.ts

/** Unique identifier for a curriculum item (vocabulary word). */
type ItemId = string;  // e.g. 'SMS-U4-N001'

/** Unique identifier for a lesson plan. */
type LessonId = string;  // e.g. 'KB-U1-L1'

/** Unique identifier for a unit. */
type UnitId = string;  // e.g. 'KB-U1'

/** Unique identifier for a course. */
type CourseId = string;  // e.g. 'KB-STARTER'

// ─── Course ──────────────────────────────────────────────────────────────────

interface Course {
  courseId: CourseId;
  name: string;                    // "Kids Box Starter"
  cefrLevel: string;               // "Pre-A1"
  ageBand: '6-7' | '8-9';
  unitIds: UnitId[];               // ordered
}

// ─── Unit ────────────────────────────────────────────────────────────────────

interface CourseUnit {
  unitId: UnitId;
  courseId: CourseId;
  topic: string;                   // "Animals"
  corePattern: string;             // "It's a ___."
  lessonIds: LessonId[];           // ordered
  reviewWordIds: ItemId[];         // from previous units; shown in warm-up
}

// ─── Lesson ──────────────────────────────────────────────────────────────────

type LessonType = 'opener' | 'consolidation' | 'review';

interface LessonPlan {
  lessonId: LessonId;
  unitId: UnitId;
  lessonType: LessonType;

  targetWordIds: ItemId[];         // 4–6 items; ordered (teach in this order)
  reviewWordIds: ItemId[];         // 2–4 items from prior units

  storyHookText: string;           // Phase 1 — original scripted narrative (≤ 5 sentences)
  storyCharacter: string;          // e.g. "Mia the monkey"
  storyProblem: string;            // one sentence: what does the child help solve?

  chantLines: string[];            // Phase 4 — one line per target word; original Mentium chant
  openLoopHint: string;            // Phase 9 — the tease for the next lesson (1 sentence)

  lessonType_age6Adjustments?: {
    targetWordIds: ItemId[];       // may be a subset (max 4) for age 6
  };
}

// ─── Vocabulary Item ─────────────────────────────────────────────────────────

interface CurriculumItem {
  itemId: ItemId;
  word: string;
  article?: 'a' | 'an';           // null for uncountable/proper
  forms: string[];                 // all accepted surface forms: ["a cat", "cat", "cats"]
  difficulty: 1 | 2 | 3;          // 1 = simplest phonology; 3 = complex

  // Audio / sensory cues
  soundCueId?: string;             // reference to audio asset (e.g. "sfx_meow") — may be null
  firstPhoneme: string;            // e.g. "c-c-c" for scaffold prompt

  // Visual (optional — UI may not exist yet)
  visualAsset?: VisualAssetRef;

  // TPR (Total Physical Response)
  tprGesture?: string;             // e.g. "mime_stroking_cat"

  // Semantic grouping
  semanticCluster: ItemId[];       // items in the same semantic category

  // L1 translations (for comprehension bridge — NOT for production)
  l1Translations: Record<string, string>;  // e.g. { uk: 'кіт', ru: 'кот' }

  // Accepted answers for STT matching
  acceptedForms: string[];         // canonical + phonetic variants
  phoneticPattern?: string;        // for near-correct matching

  // Scaffold scripts (pre-written, no LLM)
  rescueLadder: {
    level1: string;  // recognition-only prompt
    level2: string;  // forced-choice prompt
    level3: string;  // model + re-invite prompt
  };
}

// ─── Visual Asset Reference ───────────────────────────────────────────────────

interface VisualAssetRef {
  assetId: string;
  assetType: 'image' | 'animation';
  available: boolean;              // false = UI does not yet support this; block visual prompts
  url?: string;                    // populated only when asset file exists in repo/CDN
}

// ─── Activity Definition ─────────────────────────────────────────────────────

interface ActivityDefinition {
  activityType: ActivityType;      // matches existing ActivityType enum
  itemId: ItemId;
  distractorItemIds?: ItemId[];    // for forced_choice activities
  visualRequired: boolean;         // if true: blocked when UI has no image support
  promptTemplateId: string;        // pointer to template in response-template-bank
}

// ─── Teacher Prompt Template ─────────────────────────────────────────────────

interface TeacherPromptTemplate {
  templateId: string;
  activityType: ActivityType;
  text: string;                    // with {word}, {optA}, {optB}, {character} placeholders
  visualRequired: boolean;         // if true: blocked when visualsAvailable === false
  ageBand?: '6-7' | '8-9';        // null = all ages
}

// ─── Distractor Set ──────────────────────────────────────────────────────────

interface DistractorSpec {
  itemId: ItemId;
  distractorItemIds: ItemId[];     // ordered by semantic distance (close first)
  semanticDistance: 'close' | 'far';
}
```

---

## 4. Backend Module Map

### New files required (Phase 10A–10C):

```
backend/src/kids-brain/
├── curriculum/
│   ├── curriculum-types.ts          # All interfaces above (no content)
│   ├── curriculum-loader.ts         # loadLesson(lessonId): LessonPlan
│   │                                # loadItem(itemId): CurriculumItem
│   │                                # loadUnit(unitId): CourseUnit
│   ├── curriculum-registry.ts       # Map<LessonId, LessonPlan> — static registry
│   ├── prototype-lesson.ts          # ONE complete prototype lesson (Phase 10B)
│   └── __tests__/
│       └── curriculum-loader.test.ts
```

### Files requiring update (Phase 10D):

```
backend/src/kids-brain/runtime/runtime-types.ts
  → KidsBrainSessionStartInput: add lessonPlan: LessonPlan (replaces lessonTargetWords: string[])
  → KidsBrainTurnInput: add lessonItems: CurriculumItem[] (replaces lessonTargetWords: string[])

backend/src/kids-brain/runtime/session-bootstrap.ts
  → buildInitialSessionMemory: seed currentTargetItemId from lessonPlan.targetWordIds[0]
  → store lessonPlan reference in sessionMemory (or derive at turn time from lessonId)

backend/src/kids-brain/contracts/session-memory.ts
  → add lessonId: LessonId
  → replace lessonTargetWords: string[] with targetWordIds: ItemId[]

backend/src/ws/lesson-ws.ts
  → remove KIDS_PROTOTYPE_TARGET_WORDS constant
  → call CurriculumLoader.loadLesson(lessonId) at session start
  → pass LessonPlan to startKidsBrainSession()

backend/src/kids-brain/teacher-response/activity-prompt-builder.ts
  → add visualRequired guard: if template.visualRequired && !ui.visualsAvailable → select safe fallback

backend/src/kids-runtime/recovery-manager.ts
  → replace 3 high-risk EASIEST_WIN_SCRIPTS with audio-safe variants (identified in Phase 8.10)
```

---

## 5. Runtime Integration Plan

### How startKidsBrainSession receives curriculum

```
lesson-ws.ts (session start handler)
  → determine lessonId from child profile + progression state (backend only)
  → CurriculumLoader.loadLesson(lessonId) → LessonPlan
  → CurriculumLoader.loadItems(lessonPlan.targetWordIds) → CurriculumItem[]
  → startKidsBrainSession({ ...existing, lessonPlan, lessonItems })
```

The lesson plan is loaded once at session start and passed through. No DB calls during turns.

### How processKidsBrainTurn knows current item

Already working (post Phase 8.11):
- `sessionMemory.currentTargetItemId` is the source of truth
- `turn-processor.ts` now correctly persists `learningDecision.nextTargetItemId`

What changes: `currentTargetItemId` becomes an `ItemId` pointing to a `CurriculumItem`,
not a bare word string. The turn processor calls
`CurriculumLoader.loadItem(currentTargetItemId)` to get the full item object.

### Where current item is selected

Session start: `LessonPlan.targetWordIds[0]`

During session: Learning Engine `progression-engine.ts` via `selectNextItem()` —
currently missing for normal (non-recovery) progression (R22 gap). Needs implementation.

### Where next item is selected

Normal advancement: new function `selectNextItemFromPlan(plan, itemsAttempted, mastery)` in
`progression-engine.ts`. Priority order:
1. Review-due items (already in `review-scheduler.ts`)
2. Next unintroduced item in `lessonPlan.targetWordIds` sequence
3. Easiest-win item (recovery path — already implemented)

### Where lesson phase is selected

`learning-engine/lesson-flow-engine.ts` already exists. The phase advancement logic should be
connected to the lesson plan phases (WARM_UP → INTRODUCTION → PRACTICE → CONSOLIDATION → CLOSE)
in Phase 10D.

### Module ownership:

| Module | Owns |
|---|---|
| Learning Engine | Mastery evaluation, progression rules, item advancement, phase advancement signal |
| Activity Engine | Activity type selection from demand ladder, variety guard, easiest-win protocol |
| Teacher Response | Teacher utterance generation, template selection, placeholder resolution, vocabulary guard |
| Curriculum Loader | Lesson plan loading, item loading — read-only, no state |

---

## 6. Activity / UI Compatibility Matrix

### Current UI capability: audio-only (no image cards)

| Activity Type | Visual Required? | Audio-only safe? | Current status |
|---|---|---|---|
| `listen_and_point` | YES (image to point at) | NO | Already redirected to `repeat_after_me` (Phase 8.10) |
| `repeat_after_me` | NO | YES | Safe — default |
| `forced_choice_2` | Depends on template | YES if audio-variant used | Audio-safe variant: "Is it a cat or a dog?" |
| `forced_choice_4` | YES (4 image cards) | NO | Block until UI exists |
| `supported_production` | NO | YES | Safe |
| `sentence_frame_production` | NO | YES | Safe |
| `sentence_production` | NO | YES | Safe |
| `review_production` | NO | YES | Safe |
| `chant_repeat` | NO | YES | Safe — no images needed |
| `easiest_win` (POINT scripts) | YES | NO | NOT YET FIXED (Phase 8.10 deferred) |

### Visual-safe subset for v1 (before child UI exists):

```
repeat_after_me
forced_choice_2 (audio-only templates only)
yes_no_comprehension
chant_repeat
supported_production
sentence_frame_production
sentence_production
review_production
```

### Blocked until child UI exists:

```
listen_and_point (raw — already rerouted but guard should be explicit)
forced_choice_4
"Can you point to the {word}?" templates
"Where is the {word}?" templates
"Find the {word}!" templates
```

### Immediate action required (from Phase 8.10 deferred list):

Replace 3 high-risk visual prompts in `backend/src/kids-runtime/recovery-manager.ts`
`EASIEST_WIN_SCRIPTS` array:

| Current (visual, broken) | Replacement (audio-safe) |
|---|---|
| "That's okay! Can you point to the {target}? Show me!" | "That's okay! Just say it with me — {target}! Say: {target}!" |
| "No worries! Look — can you find the {target}?" | "No worries! Listen — {target}! Can you say {target}?" |
| "It's okay! Just point to the {target} for me!" | "It's okay! Say it with me — {target}! {target}! Your turn!" |

---

## 7. Teacher Prompt Contract

### Templates must receive from the lesson plan:

| Placeholder | Source | Example |
|---|---|---|
| `{word}` | `CurriculumItem.word` | "cat" |
| `{optA}` | `distractors[0].word` | "cat" |
| `{optB}` | `distractors[1].word` | "dog" |
| `{character}` | `LessonPlan.storyCharacter` | "Mia the monkey" |
| `{chant}` | `LessonPlan.chantLines[currentIndex]` | "Cat cat it's a cat!" |
| `{article}` | `CurriculumItem.article` | "a" |
| `{phoneme}` | `CurriculumItem.firstPhoneme` | "c-c-c" |

### Template-level curriculum awareness:

```typescript
interface TeacherPromptTemplate {
  templateId: string;
  activityType: ActivityType;
  text: string;               // e.g. "Is it a {optA} or a {optB}?"
  visualRequired: boolean;    // if true: BLOCKED when visualsAvailable === false
  ageBand?: '6-7' | '8-9';
}
```

The `activity-prompt-builder.ts` renders templates by:
1. Resolving all `{placeholder}` tokens from the lesson context
2. Checking `visualRequired` flag against session `ui.visualsAvailable` (backend-side flag)
3. If `visualRequired && !visualsAvailable`: fall back to the nearest audio-safe template for the same `activityType`

### How to prevent placeholder leaks:

`placeholder-guard.ts` already catches unresolved `{...}` patterns. Extend to require that
ALL placeholders in a template are resolved before delivery. No partial resolution allowed.

Contract: `renderTemplate(template, context)` throws `PLACEHOLDER_UNRESOLVED` if any
`{token}` remains after substitution. This is a HARD_STOP — the turn falls back to a
scripted safe response, not to LLM.

### How to prevent prompts requiring unavailable UI:

Add `ui.visualsAvailable: boolean` to `KidsBrainTurnInput`. Defaulting to `false` in v1.
`ActivityEngine.selectActivity()` filters out `visualRequired: true` activities when
`!visualsAvailable`. This is enforced at the activity selection layer, not at the template
layer (defense in depth — both layers check).

---

## 8. Data Flow

```
Curriculum file
  backend/src/kids-brain/curriculum/prototype-lesson.ts (static TS const)
         ↓
Curriculum Loader
  backend/src/kids-brain/curriculum/curriculum-loader.ts
  loadLesson(lessonId: LessonId): LessonPlan
  loadItems(itemIds: ItemId[]): CurriculumItem[]
         ↓
Lesson Plan
  { targetWordIds, reviewWordIds, storyHookText, chantLines, openLoopHint }
  passed into startKidsBrainSession({ lessonPlan })
         ↓
Runtime Session Memory (Redis)
  { lessonId, currentTargetItemId, targetWordIds, reviewWordIds, lessonPhase }
         ↓
Learning Engine
  runLearningEngine({ input: includes availableItems from lessonPlan.targetWordIds })
  → LearningDecision { nextTargetItemId, nextActivityType, progressionDecision }
         ↓
Activity Engine (inside Learning Engine)
  selectNextActivity(progressionDecision, childState, activityHistory, visualsAvailable)
  → ActivityType + ItemId + DistractorIds
         ↓
Teacher Response Module
  selectTemplate(activityType, itemId) → TeacherPromptTemplate
  renderTemplate(template, { word, optA, optB, character, chant })
  vocabularyGuard(rendered) → approved utterance
         ↓
WS Action Packet
  {
    action: TeacherActionCode,
    teacher_text: string,          // vocabulary-guard-approved
    feedback_tone: FeedbackTone,
    wait_ms: number,
    next_prompt: string | null,
    // NEW fields for child UI:
    activity_type: ActivityType,   // informs frontend render mode
    current_word: string,          // for display
    choice_a?: string,             // for forced_choice
    choice_b?: string,             // for forced_choice
    visual_asset_id?: string,      // null until visual UI exists
  }
         ↓
Frontend Rendering
  Renders based on activity_type field (no pedagogical logic)
  audio-only: text + TTS only
  future image cards: renders visual_asset_id when present
```

---

## 9. Security / Cost Constraints

All constraints from the architecture spec are already satisfied by the existing design.
This section confirms compliance:

| Constraint | Status | Evidence |
|---|---|---|
| No unauthenticated curriculum access | SATISFIED | WS requires auth; curriculum loader runs server-side only |
| No frontend-authoritative progression | SATISFIED | Spec §2.3: backend owns all state; frontend renders only |
| No user-provided curriculum injection | SATISFIED | `lessonId` comes from backend-computed child profile, never from client message |
| No LLM-generated curriculum at runtime | SATISFIED | Spec §2.4: LLM cannot generate vocabulary items or content outside active lesson's word list |
| Backend owns curriculum selection | SATISFIED | `CurriculumLoader` runs in `lesson-ws.ts` at session start; result not echoed to client |
| No extra LLM calls for curriculum progression | SATISFIED | Learning Engine is fully deterministic; CurriculumLoader makes zero LLM calls |

No new constraints are introduced. No changes to the security model are needed.

---

## 10. Migration Plan

### Phase 10A — Curriculum Schema (estimate: 1 session)

**Goal:** Define all TypeScript interfaces. No content.

Deliverables:
- `backend/src/kids-brain/curriculum/curriculum-types.ts` — all interfaces from Section 3
- `backend/src/kids-brain/curriculum/curriculum-loader.ts` — stub with typed signatures
- Unit tests: types compile, loader signatures match

Acceptance: 0 TS errors. No real content. No runtime wiring.

---

### Phase 10B — Static Prototype Lesson File (estimate: 1 session)

**Goal:** Replace `KIDS_PROTOTYPE_TARGET_WORDS` and `animals-curriculum.ts` with a proper
`LessonPlan` object.

Deliverables:
- `backend/src/kids-brain/curriculum/prototype-lesson.ts`
  - 1 lesson: Unit 1, Animals, Lesson 1 (Opener)
  - 6 items: cat, dog, elephant, tiger, monkey, lion
  - Each item as `CurriculumItem` (migrated from `kids-runtime/animals-curriculum.ts`)
  - Story hook text (original, ≤ 5 sentences)
  - 6 chant lines (one per target word)
  - Open loop hint (1 sentence)
  - Distractor pairs for `forced_choice_2`
- `backend/src/kids-brain/curriculum/curriculum-loader.ts` — implements `loadLesson()`, `loadItem()`
- Unit tests: loader returns correct items; items have no visual required except when flagged

Acceptance: lesson loads correctly; all 6 items have complete schemas; 0 TS errors.

---

### Phase 10C — Curriculum Loader (estimate: 0.5 sessions)

**Goal:** Loader is production-ready.

Deliverables:
- `CurriculumLoader.loadLesson(lessonId)` — throws `LESSON_NOT_FOUND` for unknown IDs
- `CurriculumLoader.loadItems(itemIds)` — returns all or throws `ITEM_NOT_FOUND`
- `CurriculumLoader.getDistractors(itemId, n)` — returns n distractors for forced_choice
- Curriculum registry: `Map<LessonId, LessonPlan>`
- Tests: all error paths covered; registry completeness verified

Acceptance: all tests pass; bad lessonId throws correctly; 0 TS errors.

---

### Phase 10D — Runtime Integration (estimate: 1–2 sessions)

**Goal:** Wire LessonPlan into session start and turn processing. Remove hardcoded word list.

Deliverables:
- `KidsBrainSessionStartInput` updated: `lessonPlan: LessonPlan` replaces `lessonTargetWords: string[]`
- `SessionMemory` updated: `lessonId: LessonId`, `targetWordIds: ItemId[]`
- `session-bootstrap.ts`: seeds `currentTargetItemId` from `lessonPlan.targetWordIds[0]`
- `turn-processor.ts`: passes `lessonItems: CurriculumItem[]` to learning and teacher modules
- `progression-engine.ts`: adds `selectNextItemFromPlan()` for normal sequential advancement (fixes R22 gap)
- `lesson-ws.ts`: removes `KIDS_PROTOTYPE_TARGET_WORDS`; calls `CurriculumLoader.loadLesson()` at session start
- All existing tests updated to use `LessonPlan` input format

Acceptance: 363+ tests passing; prototype lesson runs end-to-end with full item sequence; 0 TS errors.

---

### Phase 10E — Activity / UI Contract (estimate: 0.5 sessions)

**Goal:** ActionPacket carries enough information for child UI to render correctly.

Deliverables:
- `ActionPacket` updated: add `activityType`, `currentWord`, `choiceA?`, `choiceB?`, `visualAssetId?`
- `ui.visualsAvailable: boolean` added to `KidsBrainTurnInput` (default: false)
- Tests: ActionPacket contains correct activity fields for each activity type

Acceptance: frontend can render audio-only session and forced-choice session from ActionPacket alone.

---

### Phase 10F — Visual-Safe Activity Subset (estimate: 0.5 sessions)

**Goal:** Block visual-dependent prompts at the activity selection layer.

Deliverables:
- `visualRequired: boolean` field added to all templates in `response-template-bank.ts`
- `activity-prompt-builder.ts`: `visualRequired && !visualsAvailable` → fallback to audio-safe template
- `recovery-manager.ts`: replace 3 high-risk `EASIEST_WIN_SCRIPTS` with audio-safe variants (see Section 6)
- `easiest_win` template `'Can you point to the {word}?'` → `'Say it with me — {word}!'`
- Tests: no visual prompt is delivered when `visualsAvailable === false`

Acceptance: all visual prompts produce audio-safe fallbacks; no pointing/finding prompts in test output.

---

### Phase 10G — Replace Hardcoded Animal List (estimate: 0.5 sessions)

**Goal:** `KIDS_PROTOTYPE_TARGET_WORDS` removed from all production files.

Deliverables:
- `lesson-ws.ts`: `KIDS_PROTOTYPE_TARGET_WORDS` constant removed
- All production turn calls use `sessionMemory.lessonId` + `CurriculumLoader`
- Test files: update to import from prototype-lesson.ts, not inline word arrays

Acceptance: `grep -r KIDS_PROTOTYPE_TARGET_WORDS backend/src` returns 0 matches in non-test files.

---

### Phase 10H — QA (estimate: 1 session)

**Goal:** End-to-end simulation with curriculum-driven session.

Deliverables:
- Simulation test: full session (WARM_UP → CLOSE) driven by prototype lesson
- Tests verify: all 6 items are taught in sequence, no item skipped, no item looped
- Tests verify: forced_choice uses correct distractors from curriculum
- Tests verify: placeholder guard catches any unresolved `{word}` tokens
- Tests verify: no visual prompts when `visualsAvailable === false`
- Tests verify: story hook text appears in session opening action packets
- Tests verify: chant lines appear in CHANT phase action packets
- Tests verify: open loop hint appears in session close

Acceptance: simulation tests pass; 0 placeholder leaks; 0 visual prompts on audio-only; 0 TS errors.

---

## 11. Blockers

### Blocker 1 — R22 Item Advancement Gap (Known, Phase 8.11)

**File:** `backend/src/kids-brain/learning-engine/progression-engine.ts`
**Issue:** Rule R22 (SENTENCE_PRODUCTION mastery → advance item) sets `shouldAdvanceItem: true` but
leaves `nextTargetItemId: undefined`. The caller in `turn-processor.ts` does not select the next item.
**Impact:** Under normal (non-recovery) progression, items do not advance sequentially after mastery.
**Required fix:** `selectNextItemFromPlan()` in Phase 10D.

### Blocker 2 — Visual Prompts Not Patched (Phase 8.10 deferred)

**File:** `backend/src/kids-runtime/recovery-manager.ts`
**Issue:** 3 `EASIEST_WIN_SCRIPTS` entries require visual pointing interaction that doesn't exist.
**Impact:** Recovery paths at level 3 deliver unanswerable prompts to child.
**Required fix:** Phase 10F audio-safe replacements.

### Blocker 3 — No Lesson Phase Connection to Lesson Format

**Issue:** The 10-phase lesson format (`lesson-format-spec.md`) is defined but not connected to
`LessonPhase` enum or `lesson-flow-engine.ts`. The runtime has 5 phases; the spec has 10.
**Impact:** Story hook (Phase 1), chant (Phase 4), open loop (Phase 9) never fire.
**Required fix:** Phase 10D runtime integration must map spec phases to action packet sequences.

### Non-blocker — `kids-runtime/` and `kids-brain/` dual runtime

Two separate runtime stacks exist:
- `backend/src/kids-runtime/` — old prototype (session-engine, dialogue-manager, etc.)
- `backend/src/kids-brain/` — new Phase 1–8 pipeline (production)

`kids-runtime/` is only used for fallback in `lesson-ws.ts` when `USE_KIDS_BRAIN_V1` flag is
false, and for `recovery-manager.ts` (some paths). The `animals-curriculum.ts` in `kids-runtime/`
is the reference for `CurriculumItem` schema migration. This dual-stack is not a blocker for
Phase 10 but should be resolved before v1 GA.

---

## 12. Recommended Next Phase

**Phase 10A → 10B → 10C in one sprint (design + prototype content).**

These three phases are pure design/schema work — no runtime changes, no WS changes, no frontend
changes. They can be done safely in parallel with any other work.

**Then Phase 10D (runtime wiring) — this is the first phase that touches production paths.**

Phase 10D requires:
- A full prototype lesson file (output of 10B)
- The R22 advancement fix (Blocker 1 above)
- Updated session start and turn processor inputs

**Do not skip to 10D before 10A–10C are complete.** The schema must be stable before wiring.

**Phase 10E–10F can overlap** — both are small, non-breaking additions.

**Phase 10G (remove hardcoded list) is the final gate** — only do this after 10D is QA-passing.

---

## 13. Final Verdict

```
READY TO DESIGN CURRICULUM SCHEMA
```

**Rationale:**

The Kids Brain v1 runtime is stable and fully tested (363/363 passing, 0 TS errors).
The architecture (spec v1.0 + Patch 1.1) is complete and implementation-ready.
The curriculum backbone research (`curriculum-backbone-recommendation.md`) and lesson format
(`lesson-format-spec.md`) are thorough and actionable.

The gap is well-defined: one curriculum types file, one prototype lesson file, one loader module,
and four wiring changes. There are no architectural unknowns. There are no unresolved design
questions. The blockers are known and have documented fixes.

Phase 10A (schema definition) can begin immediately with zero risk.

**What is NOT ready:**
- Real textbook content (requires visual assets + child UI)
- `forced_choice_4` (requires 4-image card UI)
- `listen_and_point` in its original form (requires image display)
- Cambridge Kid's Box vocabulary import (requires Phase 10A–10G to be complete first)

**Confidence:** HIGH. The path from current state to curriculum-driven sessions is 8 discrete
phases, each ≤ 2 sessions, with no architectural uncertainty.
