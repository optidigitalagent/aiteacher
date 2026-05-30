# Phase 10D.0 — Runtime Integration Readiness Audit Report

**Date:** 2026-05-30
**Status:** COMPLETE — Audit/Design Only
**TypeScript errors:** 0
**Kids-brain tests:** 422 / 422 passing
**Code modified:** NONE

---

## 1. Executive Summary

Phases 10A, 10B, and 10C are complete. The curriculum schema, prototype animals lesson, and
curriculum loader are fully implemented and tested (59 new tests added across those phases).
The loader exports are production-ready: `getVocabularyWords`, `getVocabularyItems`,
`getDistractors`, `getVisualSafeActivities`, `getLessonForPrototype`.

The runtime still uses `KIDS_PROTOTYPE_TARGET_WORDS` (a hardcoded 6-word array in `lesson-ws.ts`)
at exactly three callsites. The curriculum loader already contains the same 6 words as proper
`KidsCurriculumItem` objects. The integration delta is small.

Two blockers require fixes in Phase 10D:

1. **R22 item-advance gap** — `progression-engine.ts` sets `shouldAdvanceItem: true` but
   `nextItemId: undefined`. The caller in `learning-engine.ts` forwards `undefined` directly.
   `turn-processor.ts` only writes `currentTargetItemId` when `nextTargetItemId !== undefined`,
   so items never advance after mastery under the normal (non-recovery) progression path.

2. **No lessonId in SessionMemory** — The runtime has no durable record of which lesson is
   active. Without this, resync after reconnect cannot reload curriculum without falling back
   to the hardcoded list again.

Both blockers are small and well-scoped. Phase 10D is **READY**.

---

## 2. Current Runtime Vocabulary Flow

### 2.1 KIDS_PROTOTYPE_TARGET_WORDS — all occurrences

| File | Line | Usage | Type |
|---|---|---|---|
| `backend/src/ws/lesson-ws.ts` | 112 | `const KIDS_PROTOTYPE_TARGET_WORDS = ['cat', 'dog', 'lion', 'monkey', 'elephant', 'tiger']` | Definition |
| `backend/src/ws/lesson-ws.ts` | 1199 | `lessonTargetWords: KIDS_PROTOTYPE_TARGET_WORDS` | Passed to `startKidsBrainSession()` |
| `backend/src/ws/lesson-ws.ts` | 1276 | `targetWord: sessionMemory.currentTargetItemId ?? KIDS_PROTOTYPE_TARGET_WORDS[0]` | Fallback for null target |
| `backend/src/ws/lesson-ws.ts` | 1278 | `lessonTargetWords: KIDS_PROTOTYPE_TARGET_WORDS` | Passed to `processKidsBrainTurn()` |

### 2.2 lessonTargetWords — full flow

```
lesson-ws.ts:1199
  → KidsBrainSessionStartInput.lessonTargetWords: string[]
  → session-bootstrap.ts:63
      currentTargetItemId = input.lessonTargetWords[0] ?? null   ← seeds first target

lesson-ws.ts:1278
  → KidsBrainTurnInput.lessonTargetWords: string[]
  → turn-processor.ts:212
      vocabularyContext.vocabularyGroup = input.lessonTargetWords  ← classification layer
  → turn-processor.ts:258
      buildAvailableItems(input.lessonTargetWords, sessionMemory.currentTargetItemId)
      → AvailableItem[] ordered by lessonTargetWords array
  → runtime-context.ts:150
      TeacherResponseContext.lessonTargetWords = input.lessonTargetWords ← vocabulary guard
```

`lessonTargetWords` is NOT stored in `SessionMemory`. It is passed as a parameter on every
turn from `lesson-ws.ts`. This means replacing it in lesson-ws immediately eliminates the
hardcoded list from the full runtime path.

### 2.3 targetWord — full flow

```
lesson-ws.ts:1276
  targetWord = sessionMemory.currentTargetItemId ?? KIDS_PROTOTYPE_TARGET_WORDS[0]

KidsBrainTurnInput.targetWord: string | null
  → turn-processor.ts:181
      buildPromptContext(sessionMemory, input.targetWord) → PerceptionLayer
  → runtime-context.ts:147
      TeacherResponseContext.targetWord = input.targetWord → Teacher Response Engine
```

`targetWord` is currently a bare word string ("cat", "dog", ...). After curriculum
integration it will continue to be a bare word string (the `targetText` from
`KidsCurriculumItem.targetText`). No type change is required.

### 2.4 currentTargetItemId — full flow

```
SessionMemory.currentTargetItemId: string | null

Seeded in session-bootstrap.ts:63:
  currentTargetItemId = input.lessonTargetWords[0] ?? null

Read in:
  runtime-context.ts:27     buildActivityContext → activityContext.currentTargetItemId
  runtime-context.ts:34     itemState lookup for current item
  runtime-context.ts:77     buildCurrentItemContext → itemId: currentTargetItemId ?? 'unknown'
  lesson-ws.ts:1276         targetWord fallback

Written in:
  turn-processor.ts:301     updatedSessionMemory.currentTargetItemId = learningDecision.nextTargetItemId
                            (only when nextTargetItemId !== undefined)
```

Currently stores bare word strings. After 10D it will store curriculum itemIds
(`PROTO-ANIM-001`, etc.) or continue to store bare word strings — see Section 4 decision.

### 2.5 nextTargetItemId — R22 gap confirmed

```
progression-engine.ts:386 (R22):
  return {
    shouldAdvanceItem: true,
    nextItemId: undefined,   ← gap: caller must resolve this
  }

learning-engine.ts:345:
  nextTargetItemId: progressionOutcome.nextItemId,  ← passes undefined

turn-processor.ts:301:
  const updatedSessionMemory = learningDecision.nextTargetItemId !== undefined
    ? { ...memWithPraise, currentTargetItemId: learningDecision.nextTargetItemId }
    : memWithPraise;  ← undefined → no write → item never advances
```

**Impact:** Under normal (non-recovery) sentence_production mastery, the item cursor is
stuck. Recovery paths (easiest-win, refusal) do resolve `nextTargetItemId` correctly
(they call `selectEasiestWin()` which returns an itemId), but the standard mastery
advance path does not.

### 2.6 vocabularyGroup

```
turn-processor.ts:212-215:
  vocabularyContext: input.targetWord ? {
    targetWord: input.targetWord,
    relatedWords: input.lessonTargetWords.filter(w => w !== input.targetWord),
    vocabularyGroup: input.lessonTargetWords,
  } : undefined
```

Used only by the classification layer for vocabulary context. After 10D, this becomes
`getVocabularyWords(courseId, unitId, lessonId)` — same shape, no type change.

---

## 3. Recommended Integration Point

**Answer: lesson-ws.ts only, plus learning-engine.ts for the R22 fix.**

| Option | Touches prod files | Preserves backend authority | Complexity |
|---|---|---|---|
| lesson-ws.ts calls loader | 1 file | YES | Low |
| session-bootstrap.ts calls loader | 2 files | YES | Medium |
| New runtime adapter | 3+ files | YES | High |
| learning-engine calls loader | 3 files | Questionable | High |

**Rationale for lesson-ws.ts:**

`lesson-ws.ts` already owns the decision of which child gets which lesson. It already
constructs `startKidsBrainSession` and `processKidsBrainTurn` inputs. Replacing the
hardcoded constant with a `getVocabularyWords(...)` call at those two callsites (lines
1199 and 1278) changes exactly one concern: where the word list comes from. All
downstream interfaces stay unchanged.

**Should lesson-ws.ts call the loader?** YES.

**Should runtime/session-bootstrap.ts call the loader?** NO — not in 10D. Keep the
`lessonTargetWords: string[]` interface unchanged. Bootstrap receives a word list, not
a curriculum reference.

**Should a new runtime adapter call the loader?** NO — unnecessary indirection.

**Should learning-engine call the loader?** NO — the learning engine is stateless and
must not depend on the curriculum layer directly.

**Which option touches the fewest production files?** lesson-ws.ts only (1 file).

**Which option preserves backend authority?** All options above do. lesson-ws.ts is
the existing backend authority for session start.

---

## 4. SessionMemory Changes

### Required in Phase 10D

Add `lessonId: string | null` to `SessionMemory`.

**Rationale:** Without lessonId in session state, a reconnect/resync would have no
way to reload the correct curriculum without falling back to the hardcoded list. Even
if `lessonTargetWords` is passed on every turn, a WS resync path (e.g. after
disconnect) needs to know which lesson was active.

**Safe for Redis:** A single `string | null` field. No PII. No large objects.

### Deferred to Phase 10G

Do NOT add `targetWordIds: ItemId[]` to `SessionMemory` in Phase 10D. The current
per-turn passthrough of `lessonTargetWords: string[]` is simpler and equivalent for
now. Removing the per-turn passthrough is a Phase 10G concern (when
`KIDS_PROTOTYPE_TARGET_WORDS` is fully deleted).

Do NOT store full `LessonPlan` or `CurriculumItem[]` in Redis. These are large
objects and are statically available from the loader — no need to persist.

### Summary of decisions

| Field | Phase 10D | Rationale |
|---|---|---|
| `lessonId: string \| null` | ADD | Enables resync without hardcoded fallback |
| `targetWordIds: string[]` | DEFER (10G) | Per-turn passthrough is equivalent now |
| Full `LessonPlan` in Redis | NEVER | Statically loaded, no persistence needed |
| `courseId`, `unitId` | DEFER (10G) | Derivable from lessonId via loader registry |

---

## 5. Start Session Integration Plan

### Current signature (runtime-types.ts:77)

```typescript
export interface KidsBrainSessionStartInput {
  sessionId: string;
  userId: string;
  childId: string;
  childFirstName: string;
  ageBand: AgeBand;
  ageProfile: AgeProfile;
  lessonTargetWords: string[];     ← currently hardcoded
  unitReviewWords: string[];
  characterNames: string[];
  timestamp: string;
}
```

### Phase 10D change

Do NOT change `KidsBrainSessionStartInput`. Keep `lessonTargetWords: string[]`.

In `lesson-ws.ts`, replace:
```typescript
lessonTargetWords: KIDS_PROTOTYPE_TARGET_WORDS,
```
with:
```typescript
lessonTargetWords: getVocabularyWords('KB-STARTER', 'KB-STARTER-U1', 'KB-STARTER-U1-L1'),
```

Add `lessonId: 'KB-STARTER-U1-L1'` to the input once `KidsBrainSessionStartInput` has
the optional field. `session-bootstrap.ts` seeds it into `SessionMemory.lessonId`.

**What should startKidsBrainSession() receive after curriculum integration?**

For Phase 10D: `lessonTargetWords: string[]` (unchanged). The loader is called in
lesson-ws.ts before the call, not inside startKidsBrainSession itself.

**Should it resolve curriculum internally?** NO. Keep session-bootstrap.ts free of
curriculum dependencies.

**Minimal non-breaking change:** Replace constant reference with loader call at the
lesson-ws.ts callsite. Zero interface changes.

---

## 6. Turn Processing Integration Plan

### Current turn input (runtime-types.ts:39)

```typescript
export interface KidsBrainTurnInput {
  sessionMemory: SessionMemory;
  sttResult: STTResult;
  ...
  targetWord: string | null;
  lessonTargetWords: string[];    ← currently hardcoded
  unitReviewWords: string[];
  characterNames: string[];
  forcedChoiceOptionA?: string;
  forcedChoiceOptionB?: string;
  timestamp: string;
}
```

### Phase 10D change

Do NOT change `KidsBrainTurnInput`. Keep `lessonTargetWords: string[]`.

In `lesson-ws.ts`, replace:
```typescript
targetWord: sessionMemory.currentTargetItemId ?? KIDS_PROTOTYPE_TARGET_WORDS[0],
lessonTargetWords: KIDS_PROTOTYPE_TARGET_WORDS,
```
with:
```typescript
targetWord: sessionMemory.currentTargetItemId,
lessonTargetWords: getVocabularyWords('KB-STARTER', 'KB-STARTER-U1', 'KB-STARTER-U1-L1'),
```

**Why remove the KIDS_PROTOTYPE_TARGET_WORDS[0] fallback?** After curriculum
integration, `currentTargetItemId` is always seeded from the lesson (it cannot be null
unless session-bootstrap failed). Passing null is safe — turn-processor handles
`targetWord: null` already.

**Should turn-processor.ts depend on curriculum loader directly?** NO. The loader is
called once per turn in lesson-ws.ts, not in the pipeline internals.

**Should it receive resolved context from lesson-ws?** YES — it already does via
`lessonTargetWords`. No change needed.

**How should processKidsBrainTurn() know the current item?**
- `input.targetWord` = resolved from `sessionMemory.currentTargetItemId` (unchanged)
- `input.lessonTargetWords` = word list from loader (unchanged type, new source)

**How should it get distractors?**
For Phase 10D, distractors are not yet passed through the pipeline (they use
`forcedChoiceOptionA/B` which are currently unpopulated for kids sessions). Defer
distractor integration to Phase 10E when `ActionPacket` is extended.

---

## 7. Learning Engine Integration Plan

### R22 gap fix (required for Phase 10D)

**File:** `backend/src/kids-brain/learning-engine/learning-engine.ts`

**Location:** After `computeProgressionDecision()` is called and before
`buildLearningDecision()` is called (approximately line 272–345).

**Fix — add after the progression outcome is computed:**

```typescript
// R22 gap fix: when shouldAdvanceItem=true but nextItemId=undefined,
// resolve the next item from the ordered availableItems list.
if (progressionOutcome.shouldAdvanceItem && progressionOutcome.nextItemId === undefined) {
  const currentItemId = input.currentItemContext.itemId;
  const currentIndex = input.availableItems.findIndex(i => i.itemId === currentItemId);
  if (currentIndex >= 0 && currentIndex < input.availableItems.length - 1) {
    progressionOutcome = {
      ...progressionOutcome,
      nextItemId: input.availableItems[currentIndex + 1].itemId,
    };
  }
  // If currentIndex is the last item: no advancement (lesson complete signal instead).
}
```

**Prerequisite:** `input.availableItems` must be in curriculum lesson order.
`buildAvailableItems(lessonTargetWords, currentTargetItemId)` in `runtime-context.ts`
already preserves the order of the `lessonTargetWords` array. As long as
`getVocabularyWords()` returns items in lesson order (it does — it preserves the
`lesson.items` array order from `prototype-animals-lesson.ts`), this fix works correctly.

**selectNextItemFromPlan() — is a new function needed?**

No separate function is needed for Phase 10D. The inline resolution above (4 lines)
is sufficient. A named `selectNextItemFromPlan()` function belongs in Phase 10G when
more complex progression logic (mastery-weighted, review-due priority) is added.

**Where should nextTargetItemId be selected?** In `learning-engine.ts` after the
progression engine fires, not inside `progression-engine.ts` (which has no access to
`availableItems`).

**Should it use lesson item order from curriculum?** YES — lesson order from
`availableItems` which mirrors `lessonTargetWords` array order from the loader.

**Should it use mastery/recovery state?** Not in Phase 10D. Mastery-weighted
selection is Phase 10G.

---

## 8. Teacher Response Integration Plan

### Does Teacher Response need full curriculum item metadata?

NO. For Phase 10D, Teacher Response only needs:
- `targetWord: string | null` — already present in `TeacherResponseContext`
- `lessonTargetWords: string[]` — already present (vocabulary guard)
- `forcedChoiceOptionA?: string` — already present (for forced-choice; unpopulated now)
- `forcedChoiceOptionB?: string` — already present

The `KidsCurriculumItem.firstPhoneme`, `rescueLadder`, `acceptedAnswers`,
`distractors` fields are Phase 10E–10F scope.

### Should Phase 10D use curriculum prompt templates?

NO. Defer curriculum prompt templates (`KidsTeacherPromptTemplate.text`) to Phase 10F.
The current `response-template-bank.ts` scripted strings are sufficient for 10D.

### How should placeholder templates be used later?

Phase 10F: `activity-prompt-builder.ts` will call
`getVocabularyItems()` to get `KidsCurriculumItem` objects, resolve `{target}`,
`{choiceA}`, `{choiceB}`, `{characterName}` placeholders, then run through
`placeholder-guard.ts` (already implemented) to catch unresolved tokens.

For Phase 10D: no change to Teacher Response Engine needed.

---

## 9. Visual-Safe Activity Plan

### Should getVisualSafeActivities() be used in runtime now?

NOT in Phase 10D. The current runtime defaults to audio-safe activities by design
(no image card UI exists yet). Enforcing this at the activity-selection layer is a
Phase 10F concern.

### Where should visual-required prompts be blocked?

Phase 10F: Add `ui.visualsAvailable: boolean` to `KidsBrainTurnInput` (default `false`).
In `buildAvailableActivities()` in `runtime-context.ts`, filter using:
```typescript
getVisualSafeActivities('KB-STARTER', 'KB-STARTER-U1', 'KB-STARTER-U1-L1')
  .map(a => mapCurriculumActivityToRuntime(a.type))
```

Phase 10F also patches `recovery-manager.ts` (3 visual `EASIEST_WIN_SCRIPTS` entries
to audio-safe alternatives).

**For Phase 10D:** No action. Status quo is safe for audio-only sessions.

---

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Curriculum loader throws on unknown lessonId | HIGH | Wrap `getVocabularyWords()` call in lesson-ws.ts in try/catch; fall back to empty array + log error (session blocked rather than using wrong words) |
| `buildAvailableItems()` order not preserved | MEDIUM | Verify `getVocabularyWords()` returns items in lesson declaration order (it does — `lesson.items` array order is preserved in prototype-animals-lesson.ts) |
| R22 fix selects wrong next item | MEDIUM | Add test: after 2× CORRECT_CONFIDENT on SENTENCE_PRODUCTION, `nextTargetItemId` must be `lessonTargetWords[1]` when current is `lessonTargetWords[0]` |
| lesson-ws.ts becomes too smart | LOW | Loader is called once at session start + once per turn. No pedagogical logic in lesson-ws. Loader is a pure data accessor. |
| Storing too much curriculum in Redis | NONE | Only `lessonId: string` added to SessionMemory. No objects. |
| Breaking kids production path | LOW | `USE_KIDS_BRAIN_V1` feature flag exists; old runtime fallback unaffected. Loader call can be wrapped in try/catch. |
| Breaking feature flag fallback | LOW | Old fallback path in lesson-ws (`!USE_KIDS_BRAIN_V1`) does not use `KIDS_PROTOTYPE_TARGET_WORDS`; change is isolated to the v1 path only. |
| Introducing curriculum injection from frontend | NONE | Loader runs server-side only in lesson-ws.ts. Frontend never selects curriculum. |
| Duplicating progression logic | LOW | R22 fix is additive only (4 lines inline). No second progression system. |

---

## 11. Recommended Phase 10D Scope

### Files to modify

| File | What changes | LOC estimate |
|---|---|---|
| `backend/src/ws/lesson-ws.ts` | Remove `KIDS_PROTOTYPE_TARGET_WORDS` constant; import `getVocabularyWords` from curriculum-loader; replace 3 callsites | ~8 LOC net change |
| `backend/src/kids-brain/learning-engine/learning-engine.ts` | Fix R22 gap — resolve `nextItemId` from `availableItems` when `shouldAdvanceItem && nextItemId === undefined` | ~10 LOC |
| `backend/src/kids-brain/contracts/session-memory.ts` | Add `lessonId: string \| null` field | ~2 LOC |
| `backend/src/kids-brain/runtime/session-bootstrap.ts` | Seed `lessonId` from `input.lessonId` (optional field) into initial `SessionMemory` | ~2 LOC |
| `backend/src/kids-brain/runtime/runtime-types.ts` | Add optional `lessonId?: string` to `KidsBrainSessionStartInput` | ~1 LOC |

**Total estimated LOC:** ~23 lines changed/added.

### Files NOT to modify in Phase 10D

- `runtime-context.ts` — no change; `buildAvailableItems(lessonTargetWords, ...)` works correctly
- `turn-processor.ts` — no change; interface unchanged
- `runtime-types.ts` `KidsBrainTurnInput` — no change; `lessonTargetWords: string[]` retained
- `teacher-response/*` — no change; curriculum not needed at this layer yet
- `activity-prompt-builder.ts` — Phase 10F
- `recovery-manager.ts` — Phase 10F
- `lesson-flow-engine.ts` — Phase 10D phase mapping not required for minimal integration
- Any state-engine, perception, or classification files
- Any frontend files
- Any adult runtime files

### Exact functions to change

1. `lesson-ws.ts` — anonymous kids session start handler (line ~1196)
   - Remove `KIDS_PROTOTYPE_TARGET_WORDS` constant (line 112)
   - Add import `getVocabularyWords` from `'../kids-brain/curriculum/curriculum-loader.js'`
   - Replace `lessonTargetWords: KIDS_PROTOTYPE_TARGET_WORDS` with loader call
   - Replace `targetWord: sessionMemory.currentTargetItemId ?? KIDS_PROTOTYPE_TARGET_WORDS[0]` with `targetWord: sessionMemory.currentTargetItemId`
   - Replace `lessonTargetWords: KIDS_PROTOTYPE_TARGET_WORDS` (turn callsite) with loader call

2. `learning-engine.ts` — `runLearningEngine()` function (line ~272)
   - After `computeProgressionDecision()`, add R22 gap resolution (4–6 lines)

3. `session-memory.ts` — `SessionMemory` interface
   - Add `lessonId: string | null`

4. `session-bootstrap.ts` — `buildInitialSessionMemory()`
   - Add `lessonId: input.lessonId ?? null`

5. `runtime-types.ts` — `KidsBrainSessionStartInput`
   - Add `lessonId?: string`

### Tests to add

1. **R22 advancement test** — in `learning-engine.test.ts`:
   - After 2× CORRECT_CONFIDENT on SENTENCE_PRODUCTION with cat as item[0],
     `nextTargetItemId` must equal `dog` (item[1] in availableItems order)
   - After last item mastered, `nextTargetItemId` must be undefined (end of lesson)

2. **Session-bootstrap lessonId test** — in `runtime-orchestrator.test.ts` or new file:
   - `startKidsBrainSession({ ..., lessonId: 'KB-STARTER-U1-L1' })` seeds
     `sessionMemory.lessonId === 'KB-STARTER-U1-L1'`

3. **lesson-ws integration check** (existing simulation tests should pass unchanged):
   - `kids-brain-simulation.qa.test.ts` — 57 tests must remain green

### Rollback strategy

If Phase 10D causes regressions:
1. Revert `KIDS_PROTOTYPE_TARGET_WORDS` removal in lesson-ws.ts (trivial — restore 4 lines)
2. Revert learning-engine.ts inline fix (trivial — remove 6 lines)
3. `SessionMemory.lessonId` is additive — no rollback needed (null by default)
4. Feature flag `USE_KIDS_BRAIN_V1` already isolates the kids path from adult runtime

No database migrations. No Redis schema changes (additive field only).

---

## 12. Explicit Do-Not-Touch List

| File / System | Reason |
|---|---|
| `lesson-ws.ts` adult lesson paths | Isolated from kids path; `USE_KIDS_BRAIN_V1` flag |
| All `kids-runtime/` files | Old fallback — do not remove until Phase 10G QA passes |
| `animals-curriculum.ts` in kids-runtime | Reference only; migration to curriculum-types already done in 10B |
| `session-memory.ts` existing fields | Only add `lessonId`; do not rename existing fields |
| `runtime-types.ts` `KidsBrainTurnInput` | Do not change `lessonTargetWords: string[]` in 10D |
| `runtime-context.ts` | buildAvailableItems works correctly with current interface |
| `activity-prompt-builder.ts` | Visual guard belongs in Phase 10F |
| `recovery-manager.ts` | Audio-safe script replacement belongs in Phase 10F |
| `placeholder-guard.ts` | Already implemented; no changes needed |
| `teacher-response-engine.ts` | No curriculum dependency needed in 10D |
| Any frontend file | 10D is backend only |
| Any adult runtime file | Isolated |

---

## 13. Final Verdict

```
READY FOR PHASE 10D
```

**Evidence:**

1. **10A–10C complete.** Curriculum schema, prototype lesson, and loader are implemented
   and tested. 59 new tests added. 0 TypeScript errors.

2. **Test baseline stable.** 422/422 tests passing (363 from prior phases + 59 curriculum).
   0 TypeScript errors at time of audit.

3. **Integration surface is small.** 5 files, ~23 LOC total. The core runtime pipeline
   (turn-processor, learning-engine, state-engine, teacher-response) requires minimal
   or no change. The integration is a source substitution, not an architectural change.

4. **R22 gap is understood and fixable.** The fix is 6 lines inline in learning-engine.ts.
   The prerequisite (ordered `availableItems`) is already satisfied by the existing
   `buildAvailableItems()` which preserves `lessonTargetWords` array order.

5. **Rollback is trivial.** The hardcoded constant can be restored in under 5 minutes.
   No DB migrations. No Redis schema breaking changes.

6. **Blockers resolved:**
   - Blocker 1 (R22 gap): fixed in Phase 10D via inline resolution in learning-engine.ts
   - Blocker 2 (visual prompts): deferred to Phase 10F (not a 10D blocker)
   - Blocker 3 (lesson phase connection): deferred to Phase 10D/E (story hook + chant)

**What Phase 10D delivers:**
- `KIDS_PROTOTYPE_TARGET_WORDS` removed from all production turn paths
- `SessionMemory.lessonId` persisted for resync safety
- R22 item advancement gap fixed (items now advance after mastery)
- All 422 existing tests continue to pass
- Curriculum loader is the single source of truth for lesson vocabulary

**What Phase 10D does NOT deliver** (deferred):
- Curriculum distractor passthrough (Phase 10E)
- ActionPacket `activityType` / `currentWord` fields (Phase 10E)
- Visual-safe activity enforcement (Phase 10F)
- Audio-safe easiest_win scripts (Phase 10F)
- Full `lessonTargetWords` removal from per-turn inputs (Phase 10G)
- Story hook / chant phase sequencing (Phase 10D.1 or 10E)
