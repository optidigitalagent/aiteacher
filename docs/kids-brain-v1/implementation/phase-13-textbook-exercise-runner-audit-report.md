# Phase 13 — Textbook Exercise Runner Audit Report

**Date:** 2026-05-31
**Method:** Source audit — no code written, no runtime modified
**Tests at start:** 571 / 571 PASS
**TS errors at start:** 0

---

## 1. Current Gap

The Kids Brain v1 runtime can teach vocabulary (blue, green, pink…) from Kid's Box 1 Lesson 2 in voice-only mode. It advances items and activities via a learning engine. But it has **no concept of a textbook exercise**.

The unit-test suite confirms the pipeline:
```
STT → Perception → Classification → State Engine → Learning Engine → Teacher Response
```

There is no layer that reads a named exercise, gives it a unique identity, tracks its step count, evaluates a completion rule, and hands off to the next exercise. The runtime knows items and activities but not exercises.

**Gap statement:** A real online tutoring session based on the textbook requires a runtime that executes exercises in textbook order. That layer is completely absent.

---

## 2. Textbook Exercise Model — Kid's Box 1, Lesson 2 (Colours)

Source: Pupil's Book pp. 6–7 | Teacher's Book p. 17

### What "teach an exercise" means in Kid's Box 1

| Field | Example from Lesson 2 |
|---|---|
| Page reference | PB p. 6, PB p. 7, TB p. 17 |
| Exercise type | Colour flashcard presentation, rainbow song/chant, bingo |
| Teacher instruction | "Listen and say the colour" (TB p. 17) |
| Expected student action | Say the colour word; identify from options |
| Visual requirement | Colour flashcards (currently unavailable; `available: false`) |
| Audio requirement | TTS of target word (available: true) |
| Answer validation | Exact or phonetic match against `acceptedAnswers` |
| Completion criterion | All 7 colours introduced once (introduction phase); each colour attempted twice (practice phase) |
| Retry rule | On wrong answer: recast with model; escalate scaffold after 3 attempts |
| Transition signal | "Well done! Let's try the next one!" + cursor advance |

### TB-derived exercise sequence for Lesson 2

| Exercise | Activity Type | Items | Teacher Prompt | Student Action | Completion Rule |
|---|---|---|---|---|---|
| KB1-L02-EX-001 | LISTEN_AND_REPEAT | blue | "Listen — blue! Now you!" | Repeat "blue" | 1 confident repeat OR 3 attempts |
| KB1-L02-EX-002 | LISTEN_AND_REPEAT | green | "Listen — green! Now you!" | Repeat "green" | 1 confident repeat OR 3 attempts |
| KB1-L02-EX-003 | LISTEN_AND_REPEAT | pink | "Listen — pink! Now you!" | Repeat "pink" | 1 confident repeat OR 3 attempts |
| KB1-L02-EX-004 | LISTEN_AND_REPEAT | purple | "Listen — purple! Now you!" | Repeat "purple" | 1 confident repeat OR 3 attempts |
| KB1-L02-EX-005 | LISTEN_AND_REPEAT | orange | "Listen — orange! Now you!" | Repeat "orange" | 1 confident repeat OR 3 attempts |
| KB1-L02-EX-006 | LISTEN_AND_REPEAT | red | "Listen — red! Now you!" | Repeat "red" | 1 confident repeat OR 3 attempts |
| KB1-L02-EX-007 | LISTEN_AND_REPEAT | yellow | "Listen — yellow! Now you!" | Repeat "yellow" | 1 confident repeat OR 3 attempts |
| KB1-L02-EX-008 | CHANT | all 7 | "Let's say the rainbow!" | Join chant | All 7 words attempted in sequence |
| KB1-L02-EX-009 | FORCED_CHOICE_AUDIO | blue/green | "Blue or green — which one?" | Say choice | Correct identification OR 3 attempts |
| KB1-L02-EX-010 | FORCED_CHOICE_AUDIO | pink/purple | "Pink or purple?" | Say choice | Correct identification OR 3 attempts |
| KB1-L02-EX-011 | REVIEW_PRODUCTION | all 7 | "What colour is it?" | Free production | All 7 attempted OR session ends |

**Note:** TB activities include a "bingo game" (TB p. 17) and visual "colour the picture" activities. Both require visual UI and are excluded from the voice-only audio-safe runner. The above 11 exercises represent the voice-deliverable subset.

---

## 3. Missing Schema Fields — KidsCurriculumSchema Audit

### Present in current schema ✓

| Field | Location | Note |
|---|---|---|
| `acceptedAnswers` | `KidsVocabularyItem` | Exact + phonetic match; ✓ ready |
| `distractors` | `KidsVocabularyItem` | For forced-choice; ✓ ready |
| `visualAsset.available` | `KidsCurriculumItem` | Blocks visual exercises; ✓ ready |
| `audioAsset.available` | `KidsCurriculumItem` | TTS safety gate; ✓ ready |
| `fallbackPolicy` | `KidsActivityDefinition` | `USE_AUDIO_SAFE_FALLBACK / SKIP / LOWER_DIFFICULTY`; ✓ ready |
| `successCriteria` | `KidsActivityDefinition` | Human-readable string; ✓ but not machine-executable |
| `exitCriteria` | `KidsCurriculumPhase` | Human-readable string only |
| `promptTemplates` | `KidsActivityDefinition` | Scripted templates per activity type; ✓ ready |

### Missing from current schema ✗

| Missing Field | Type | Impact |
|---|---|---|
| `exerciseId` | `string` | No discrete exercise identity. Activities exist, but an exercise is an activity execution slot with a specific item, position, and state. Without an ID, reconnect cannot resume mid-exercise. |
| `pageRef` | `{ pb: string; tb?: string }` | Page references exist only as code comments (`// PB pp. 6–7`). Not queryable at runtime. |
| `textbookActivityType` | `enum` | The textbook distinguishes "Listen and say", "Sing the song", "Bingo", "Colour the picture". Current `KidsCurriculumActivityType` collapses these. |
| `teacherInstruction` | `string` | Per-exercise scripted instruction string. Currently inside `promptTemplates[].text` with placeholders, but no resolved per-exercise instruction. |
| `studentActionType` | `enum` | `REPEAT_WORD \| SAY_CHOICE \| JOIN_CHANT \| FREE_PRODUCTION`. Not modelled. Implied by activityType but not explicit. |
| `completionRule` | `CompletionRule` | The `exitCriteria` string on `KidsCurriculumPhase` is human-readable only. No machine-executable rule (e.g. `{ type: 'attempts', max: 3 }` or `{ type: 'correct_count', required: 1 }`). |
| `retryPolicy` | `RetryPolicy` | `fallbackPolicy` exists (`USE_AUDIO_SAFE_FALLBACK`) but has no `maxAttempts` count, no escalation ladder (hint → model → skip). |
| `nextExerciseId` | `string \| null` | No linked list of exercises. Curriculum schema has lesson → items but no ordered exercise sequence with explicit next pointers. |
| `visualPromptPayload` | structured | `KidsVisualAssetRef` is attached to the item globally, not to an exercise instance. An exercise showing "colour card: blue" needs a payload specifying which visual to display for this specific exercise turn. |
| `audioPromptPayload` | structured | Same issue: `KidsAudioAssetRef` is per-item, not per-exercise-turn. The chant exercise has a different audio payload than the listen-and-repeat exercise for the same word. |

### Count: 10 missing schema fields

---

## 4. Runtime State Requirements

### Present in current SessionMemory ✓

| Field | Note |
|---|---|
| `currentTargetItemId` | Current vocabulary item being taught |
| `currentActivityId` | Current `ActivityType` (runtime enum) |
| `currentItemAttemptCount` | Attempt count on current item |
| `lessonPhase` | `WARM_UP / INTRODUCTION / PRACTICE / CONSOLIDATION / CLOSE` |
| `itemsAttempted` | List of itemIds attempted this session |
| `itemsMastered` | List of itemIds mastered this session |

### Missing from current SessionMemory ✗

| Missing Field | Type | Why Needed |
|---|---|---|
| `currentExerciseId` | `string \| null` | Identifies which specific exercise is active. Without this, reconnect cannot know if the child was mid-exercise-001 or mid-exercise-009. |
| `currentExerciseStep` | `number` | Step within a multi-step exercise (e.g. chant exercise has 7 items in sequence). Not the same as `currentItemAttemptCount`. |
| `exerciseAttemptCount` | `number` | Attempts on this exercise (distinct from attempts on this item). `currentItemAttemptCount` tracks item attempts; `exerciseAttemptCount` tracks the completion gate. |
| `exerciseCompleted` | `boolean` | Whether the current exercise has met its completion rule. Required so the runner does not re-enter a completed exercise on reconnect. |
| `lessonProgress` | structured | `{ totalExercises: number; completedExercises: string[]; currentExerciseIndex: number }`. No progress summary currently exists — teacher and frontend have no way to say "Exercise 3 of 11". |
| `pageRef` | `string \| null` | Textbook page reference for the current exercise. Needed if frontend ever shows a "page indicator" ("p. 6"). Currently derivable only from source code comments. |
| `visibleAssets` | `string[]` | AssetIds currently shown to the child. Needed so the runner can block visual prompts when assets are unavailable and can restore the correct visual on reconnect. |
| `expectedStudentAction` | `StudentActionType` | The action the teacher is waiting for: `REPEAT_WORD`, `SAY_CHOICE`, `JOIN_CHANT`, `FREE_PRODUCTION`. Required for answer validation routing — REPEAT_WORD is validated differently from SAY_CHOICE. |

### Count: 8 missing runtime state fields

---

## 5. Proposed Exercise Runner Architecture

### Position in pipeline

```
KidsCurriculumLesson
  └── ExerciseSequenceBuilder   ← maps lesson to ordered ExerciseDefinition[]
        └── ExerciseRunner       ← stateful controller for one exercise at a time
              └── TurnProcessor  ← existing Perception→Classification→…→Teacher pipeline
```

The Exercise Runner sits **between** the curriculum layer and the existing turn processor. It does not replace the turn processor — it wraps it with exercise-level lifecycle management.

### Separation of concerns

| Layer | Owns |
|---|---|
| `ExerciseSequenceBuilder` | Build ordered `ExerciseDefinition[]` from a lesson. One-time at session start. Stored in Redis as part of session state. |
| `ExerciseRunner` | One active exercise at a time. Tracks state, evaluates completion rule, emits EXERCISE_COMPLETE signal, calls `getNextExercise()`. |
| `TurnProcessor` | Unchanged — perception/classification/response per turn. Receives `expectedStudentAction` from ExerciseRunner. |
| `SessionMemory` | Extended with 8 new fields (see §4). |
| `Frontend` | Receives `ExerciseFrontendPayload` only. Never decides correctness. Never decides next exercise. |

### No LLM-generated exercise plan

The exercise sequence is pre-computed from validated curriculum at session start. No LLM call generates or modifies the sequence at runtime. The AI teacher only generates verbal responses — it does not control which exercise is active.

---

## 6. Proposed Interfaces

```typescript
// ─── Exercise definition (authoring layer) ────────────────────────────────────

interface ExerciseDefinition {
  exerciseId: string;                      // e.g. 'KB1-L02-EX-001'
  lessonId: string;
  sequenceIndex: number;                   // 1-based position in lesson
  activityType: KidsCurriculumActivityType;
  textbookActivityType: TextbookActivityType; // LISTEN_SAY | SING | BINGO | COLOUR
  targetItemIds: string[];                 // 1 item for repeat; N for chant/review
  pageRef: { pb: string; tb?: string };
  teacherInstruction: string;              // Resolved (no placeholders)
  studentActionType: StudentActionType;    // REPEAT_WORD | SAY_CHOICE | JOIN_CHANT | FREE_PRODUCTION
  expectedAnswerSet: KidsAcceptedAnswer[]; // Flattened from targetItems
  choices?: string[];                      // For FORCED_CHOICE only
  visualPromptPayload: KidsVisualAssetRef | null;
  audioPromptPayload: KidsAudioAssetRef | null;
  completionRule: CompletionRule;          // { type: 'correct_count', required: 1 } | { type: 'attempts', max: 3 } | { type: 'all_items' }
  retryPolicy: RetryPolicy;               // { maxAttempts: 3, escalationLadder: ['model', 'scaffold', 'skip'] }
  nextExerciseId: string | null;           // null = lesson complete
}

// ─── Exercise runner state ─────────────────────────────────────────────────────

interface ExerciseState {
  exerciseId: string;
  currentStep: number;           // 0-based step within multi-step exercises
  attemptCount: number;
  completed: boolean;
  startedAt: string;             // ISO 8601
  completedAt: string | null;
}

// ─── Runner interface ──────────────────────────────────────────────────────────

interface ExerciseRunner {
  startExercise(exerciseId: string, sessionId: string): Promise<ExerciseState>;

  processExerciseTurn(input: {
    sessionId: string;
    sttResult: STTResult;
    exerciseState: ExerciseState;
    exercise: ExerciseDefinition;
    sessionMemory: SessionMemory;
  }): Promise<ExerciseTurnResult>;

  completeExercise(exerciseId: string, sessionId: string): Promise<ExerciseCompletionResult>;

  getNextExercise(currentExerciseId: string, lessonId: string): ExerciseDefinition | null;

  buildTeacherPrompt(exercise: ExerciseDefinition, attemptCount: number): string;

  buildFrontendPayload(exercise: ExerciseDefinition, state: ExerciseState): ExerciseFrontendPayload;
}

// ─── Turn result ───────────────────────────────────────────────────────────────

interface ExerciseTurnResult {
  exerciseState: ExerciseState;
  updatedSessionMemory: SessionMemory;
  actionPackets: RuntimeActionPacket[];
  exerciseComplete: boolean;           // true → runner must call completeExercise then startExercise(nextId)
  nextExerciseId: string | null;
  logsToEmit: LogEvent[];
}

// ─── Frontend payload (sent to child UI) ──────────────────────────────────────

interface ExerciseFrontendPayload {
  teacherText: string;
  exerciseId: string;
  activityType: KidsCurriculumActivityType;
  targetItemId: string | null;          // null for chant/multi-item exercises
  choices: string[] | null;             // Populated for FORCED_CHOICE only
  visualAssets: KidsVisualAssetRef[] | null; // null if unavailable
  progress: {
    currentExerciseIndex: number;       // 1-based
    totalExercises: number;
    completedExerciseIds: string[];
    pageRef: string | null;
  };
  expectedInputMode: 'VOICE' | 'NONE';  // NONE during teacher speech
}
```

---

## 7. Kid's Box Lesson 2 — Exercise Mapping

All 11 exercises are audio-safe (visual assets `available: false` → `visualPromptPayload: null`).

| ExerciseId | Type | Item(s) | studentActionType | completionRule | retryPolicy |
|---|---|---|---|---|---|
| KB1-L02-EX-001 | LISTEN_AND_REPEAT | blue | REPEAT_WORD | `{ type:'correct_count', required:1 }` | `{ max:3, escalation:['model','skip'] }` |
| KB1-L02-EX-002 | LISTEN_AND_REPEAT | green | REPEAT_WORD | same | same |
| KB1-L02-EX-003 | LISTEN_AND_REPEAT | pink | REPEAT_WORD | same | same |
| KB1-L02-EX-004 | LISTEN_AND_REPEAT | purple | REPEAT_WORD | same | same |
| KB1-L02-EX-005 | LISTEN_AND_REPEAT | orange | REPEAT_WORD | same | same |
| KB1-L02-EX-006 | LISTEN_AND_REPEAT | red | REPEAT_WORD | same | same |
| KB1-L02-EX-007 | LISTEN_AND_REPEAT | yellow | REPEAT_WORD | same | same |
| KB1-L02-EX-008 | CHANT | all 7 colours | JOIN_CHANT | `{ type:'all_items' }` | `{ max:1, escalation:['skip'] }` |
| KB1-L02-EX-009 | FORCED_CHOICE_AUDIO | blue/green | SAY_CHOICE | `{ type:'correct_count', required:1 }` | `{ max:3, escalation:['model','skip'] }` |
| KB1-L02-EX-010 | FORCED_CHOICE_AUDIO | pink/purple | SAY_CHOICE | same | same |
| KB1-L02-EX-011 | REVIEW_PRODUCTION | all 7 colours | FREE_PRODUCTION | `{ type:'all_items' }` | `{ max:2, escalation:['scaffold','skip'] }` |

**Total:** 11 exercises, ~12 minutes estimated runtime, all voice-deliverable.

Excluded (require visual UI):
- Bingo game (TB p. 17) — requires printed bingo cards / visual grid
- "Colour the picture" task — requires drawing/touch UI

---

## 8. Frontend Payload Proposal

Example payload for KB1-L02-EX-009 (FORCED_CHOICE_AUDIO: blue vs green):

```json
{
  "teacherText": "Blue or green — which one?",
  "exerciseId": "KB1-L02-EX-009",
  "activityType": "forced_choice_audio",
  "targetItemId": "KB1-U01-COL-001",
  "choices": ["blue", "green"],
  "visualAssets": null,
  "progress": {
    "currentExerciseIndex": 9,
    "totalExercises": 11,
    "completedExerciseIds": [
      "KB1-L02-EX-001","KB1-L02-EX-002","KB1-L02-EX-003",
      "KB1-L02-EX-004","KB1-L02-EX-005","KB1-L02-EX-006",
      "KB1-L02-EX-007","KB1-L02-EX-008"
    ],
    "pageRef": "PB p. 7"
  },
  "expectedInputMode": "VOICE"
}
```

**Backend-authority rules enforced in payload design:**
1. `choices` contains display strings only — no answer key, no correct-flag
2. `targetItemId` is set on backend; frontend cannot infer correct answer from it alone
3. `expectedInputMode` is controlled by runner; frontend cannot self-transition to VOICE
4. `progress.completedExerciseIds` is written by backend only
5. `visualAssets: null` when `available: false` — frontend cannot request visual fallback

---

## 9. Required Tests

### Suite A — Exercise order

| Test | What it verifies |
|---|---|
| A1 | `ExerciseSequenceBuilder` produces exactly 11 exercises for KB1-L02 |
| A2 | Exercises are ordered by `sequenceIndex` ascending |
| A3 | `nextExerciseId` on EX-011 is `null` (lesson end) |
| A4 | `nextExerciseId` on EX-007 is `KB1-L02-EX-008` |

### Suite B — Answer validation

| Test | What it verifies |
|---|---|
| B1 | "blue" → correct for KB1-L02-EX-001 (REPEAT_WORD) |
| B2 | "banana" → incorrect for KB1-L02-EX-001 |
| B3 | "bloo" → incorrect (outside acceptedAnswers phonetic set) |
| B4 | SAY_CHOICE: "blue" correct when target is blue, incorrect when target is green |
| B5 | JOIN_CHANT: any colour word on correct step advances step counter |
| B6 | FREE_PRODUCTION: "red" correct, "pizza" incorrect |

### Suite C — Retries and escalation

| Test | What it verifies |
|---|---|
| C1 | 3 wrong answers on EX-001 → exercise complete (max_attempts reached), advance |
| C2 | Wrong answer on turn 1 → model (teacher repeats word) |
| C3 | Wrong answer on turn 2 → scaffold (phoneme hint "b-b-b") |
| C4 | Wrong answer on turn 3 → skip + advance |

### Suite D — Completion

| Test | What it verifies |
|---|---|
| D1 | 1 confident correct → `exerciseComplete = true` for `correct_count:1` exercises |
| D2 | Chant: all 7 steps completed → `exerciseComplete = true` |
| D3 | Review: all 7 items attempted → `exerciseComplete = true` |
| D4 | `exerciseCompleted` flag set in SessionMemory after D1/D2/D3 |

### Suite E — Next exercise transition

| Test | What it verifies |
|---|---|
| E1 | `completeExercise('KB1-L02-EX-001')` → runner starts `KB1-L02-EX-002` |
| E2 | `completeExercise('KB1-L02-EX-011')` → `SESSION_COMPLETE` packet emitted |
| E3 | `currentExerciseId` in SessionMemory updated to next exercise id |
| E4 | `lessonProgress.completedExercises` contains completed exerciseId |

### Suite F — Reconnect resume

| Test | What it verifies |
|---|---|
| F1 | Session reconnect with `currentExerciseId='KB1-L02-EX-004'` → runner resumes EX-004 |
| F2 | `currentExerciseStep=3` preserved on reconnect for chant exercise |
| F3 | Completed exercises not re-entered on reconnect |
| F4 | `exerciseAttemptCount` preserved on reconnect |

### Suite G — Authority guards

| Test | What it verifies |
|---|---|
| G1 | `ExerciseFrontendPayload` contains no `isCorrect` field |
| G2 | `ExerciseFrontendPayload` contains no `correctAnswer` field |
| G3 | `ExerciseFrontendPayload` does not expose `nextExerciseId` |
| G4 | Visual exercise with `available: false` → `visualAssets: null` in payload |
| G5 | `FORCED_CHOICE_VISUAL` activity type blocked when visual unavailable |

---

## 10. Risks

| Risk | Severity | Note |
|---|---|---|
| **Article grammar ("a blue")** | Medium | Existing latent bug (Phase 12A Bug B3). Exercise runner's `teacherInstruction` must be built without the article for colour vocabulary. Add `itemType === VOCABULARY && !article` guard in instruction builder. |
| **Chant step tracking** | Medium | The chant exercise is multi-step (7 items in sequence). `currentExerciseStep` must increment per item, not per turn. If a child says nothing (silence), step must not advance but session must not freeze. |
| **Redis session size** | Low | Adding `ExerciseState` and `ExerciseDefinition[]` to SessionMemory increases Redis payload. Estimate: +2–4 KB per session. Well within the 4-hour TTL key design. Pre-compute `ExerciseDefinition[]` once at session start and store as a separate key to keep `SessionMemory` lean. |
| **Forced-choice without visual** | Low | `FORCED_CHOICE_AUDIO` is audio-safe. `FORCED_CHOICE_VISUAL` is blocked. The sequence builder must filter out `FORCED_CHOICE_VISUAL` for any lesson where all visual assets are `available: false`. |
| **Reconnect re-engagement** | Low | Phase 12A Bug B2: no teacher re-engagement message on reconnect. Exercise Runner must emit a scripted "Welcome back! We were on [colour]. Let's continue!" packet on session resume. |
| **Exercise ID stability** | Low | Once exerciseIds are stored in Redis (as `currentExerciseId`) and sent to the frontend, they cannot change between curriculum updates. Assign IDs as stable constants in the curriculum file. |
| **No PDF at runtime** | — | Runtime must never read curriculum-assets/ PDFs. The exercise sequence is pre-computed from validated TypeScript curriculum objects only. Confirmed: current curriculum loader has no PDF dependency. |

---

## 11. Recommended Implementation Phases

### Phase 13A — Schema extension (curriculum layer only)

Add to `KidsCurriculumLesson`:
- `ExerciseDefinition[]` as a new optional field `exercises`
- `CompletionRule` type
- `RetryPolicy` type
- `StudentActionType` enum
- `TextbookActivityType` enum
- `pageRef` as a first-class field on `KidsCurriculumLesson`

Author `exercises[]` for KB1-L02 (11 exercises as mapped in §7).

Tests: Schema validator, exercise ordering, completionRule shape.
No runtime changes.

---

### Phase 13B — SessionMemory extension

Add 8 new fields (listed in §4) to `SessionMemory`:
- `currentExerciseId`, `currentExerciseStep`, `exerciseAttemptCount`, `exerciseCompleted`
- `lessonProgress`, `pageRef`, `visibleAssets`, `expectedStudentAction`

All new fields optional with `?` for backward compatibility with pre-Phase-13 sessions.

Tests: SessionMemory shape, Redis round-trip.
No runtime logic changes.

---

### Phase 13C — ExerciseSequenceBuilder

New file: `backend/src/kids-brain/exercise-runner/exercise-sequence-builder.ts`

Builds `ExerciseDefinition[]` from a `KidsCurriculumLesson`. Called once at session start. Result stored in Redis as a separate key: `kids-brain:exercises:{sessionId}`.

Tests: 11 exercises built for KB1-L02, correct ordering, correct completionRules.

---

### Phase 13D — ExerciseRunner core

New file: `backend/src/kids-brain/exercise-runner/exercise-runner.ts`

Implements `startExercise()`, `processExerciseTurn()`, `completeExercise()`, `getNextExercise()`, `buildTeacherPrompt()`, `buildFrontendPayload()`.

Wraps existing `processKidsBrainTurn()` — does not replace it.

Tests: Suite B (answer validation), C (retries), D (completion), E (transitions).

---

### Phase 13E — Runtime wiring + reconnect

Wire ExerciseRunner into `lesson-ws.ts`. On session start: build exercise sequence, start first exercise. On reconnect: restore `currentExerciseId` and resume.

Fix Bug B2 (re-engagement message) as part of this phase.

Tests: Suite F (reconnect resume), G (authority guards).

---

### Phase 13F — Frontend payload + UI

Add `ExerciseFrontendPayload` to WS packet protocol. Frontend renders:
- Exercise progress indicator ("9 of 11")
- Choices for FORCED_CHOICE (audio buttons only, no images)
- Colour swatch display when visual assets become available

Tests: Suite G (no answer key leakage).

---

## Final Verdict

```
NOT READY — CURRICULUM SCHEMA GAP
```

**Reason:** The current `KidsCurriculumSchema` and `SessionMemory` do not model textbook exercises as discrete, ordered, stateful units. Ten schema fields and eight session-state fields are missing. The runtime has no Exercise Runner layer. Building one without these foundations would require the runtime to compute exercise boundaries ad-hoc from learning-engine decisions — which is the current broken state (vocabulary loop with no textbook structure).

**The runtime is otherwise healthy:**
- 571 / 571 tests passing
- 0 TypeScript errors
- Curriculum data for KB1-L02 is correct and complete for vocabulary
- Completion rules, retry policies, and exercise IDs must be added to the curriculum authoring layer before any Exercise Runner code is written

**Recommended first step:** Phase 13A — extend `KidsCurriculumLesson` with `ExerciseDefinition[]`, `CompletionRule`, `RetryPolicy`, and author all 11 exercises for KB1-L02.
