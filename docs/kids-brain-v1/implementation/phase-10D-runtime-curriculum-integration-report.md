# Phase 10D — Runtime Curriculum Integration Report

Date: 2026-05-30

## Files Modified

1. `backend/src/kids-brain/contracts/session-memory.ts`
   — Added `lessonId?: string | null` field

2. `backend/src/kids-brain/runtime/session-bootstrap.ts`
   — Added `PROTOTYPE_LESSON_ID = 'animals-zoo-lesson-001'` constant
   — Seeded `lessonId: PROTOTYPE_LESSON_ID` in `buildInitialSessionMemory`

3. `backend/src/ws/lesson-ws.ts`
   — Added `import { getVocabularyWords } from '../kids-brain/curriculum/index.js'`
   — Replaced `KIDS_PROTOTYPE_TARGET_WORDS = ['cat',...]` with curriculum loader
   — Defined `PROTO_COURSE_ID`, `PROTO_UNIT_ID`, `PROTO_LESSON_ID` constants
   — `KIDS_LESSON_TARGET_WORDS = [...getVocabularyWords(...)]` derived at module load
   — All 3 usages of the old constant replaced

4. `backend/src/kids-brain/learning-engine/learning-engine.ts`
   — Added `AvailableItem` to imports
   — Added `resolveNextItemId()` helper (R22 gap fix)
   — Final `buildLearningDecision` call now uses `resolveNextItemId(...)` instead of `progressionOutcome.nextItemId` directly

## New Test File

`backend/src/kids-brain/runtime/__tests__/phase-10d-curriculum-integration.test.ts`
— 15 new tests across 6 describe blocks

## Exact Integration Point

- **Vocabulary source**: `lesson-ws.ts` lines 108–115 — module-level constant derived from `getVocabularyWords(PROTO_COURSE_ID, PROTO_UNIT_ID, PROTO_LESSON_ID)` at startup. No runtime overhead per-session.
- **lessonId seed**: `session-bootstrap.ts` `buildInitialSessionMemory()` — hardcoded to prototype lesson ID.
- **R22 fix**: `learning-engine.ts` `resolveNextItemId()` called inside final `buildLearningDecision` before returning. Does not touch the progression engine.

## Curriculum IDs Used

- courseId: `mentium-kids-prototype-animals`
- unitId: `animals-zoo-001`
- lessonId: `animals-zoo-lesson-001`

Vocabulary resolved: `cat, dog, lion, monkey, elephant, tiger` (6 items, in prototype item order).

## R22 Fix Details

**Problem**: `progression-engine.ts` R22 rule fires `shouldAdvanceItem: true` with `nextItemId: undefined`. The comment says "caller determines next item from availableItems" but the caller (`learning-engine.ts`) was passing `progressionOutcome.nextItemId` (undefined) straight through to `buildLearningDecision`, which set `nextTargetItemId: undefined`. The turn-processor then skipped the currentTargetItemId update because `nextTargetItemId === undefined`.

**Fix**: Added `resolveNextItemId(shouldAdvanceItem, nextItemId, availableItems)` helper in `learning-engine.ts`. When `shouldAdvanceItem=true` and `nextItemId=undefined`, it finds the current item's index in `availableItems` and returns the next item's `itemId`. If the current item is last or not found, returns `undefined` (completion semantics preserved).

**Rules respected**:
- Uses existing `availableItems` order — no hardcoded vocab
- No curriculum-specific logic inside learning engine
- Recovery/mastery paths unchanged (only final progression path affected)

## Tests Added / Updated

New: `phase-10d-curriculum-integration.test.ts` (15 tests)

| # | Test | Passes |
|---|------|--------|
| 1 | sessionMemory.lessonId = prototype lesson ID | ✓ |
| 2 | lessonId is a non-empty string | ✓ |
| 3 | curriculum vocabulary non-empty | ✓ |
| 4 | curriculum vocabulary = cat/dog/lion/monkey/elephant/tiger in order | ✓ |
| 5 | session starts with first curriculum word as currentTargetItemId | ✓ |
| 6 | processKidsBrainTurn runs without error using curriculum words | ✓ |
| 7 | R22: nextTargetItemId = second item when shouldAdvanceItem=true | ✓ |
| 8 | R22: last item → nextTargetItemId = undefined (completion preserved) | ✓ |
| 9 | R22: resolution uses availableItems order, not hardcoded words | ✓ |
| 10 | refusal → easiest-win: currentTargetItemId persisted correctly | ✓ |
| 11 | when nextTargetItemId defined, it is from curriculum vocabulary | ✓ |
| 12 | correct answer: no unresolved placeholders | ✓ |
| 13 | wrong answer: no unresolved placeholders | ✓ |
| 14 | sessionMemory.mode always mentium_kids | ✓ |
| 15 | startKidsBrainSession returns greeting packets | ✓ |

## Commands Run

```
cd backend
npx tsc --noEmit      → 0 errors
npx vitest run src/kids-brain  → 437/437 tests passed (16 test files)
```

## Test Results

```
Test Files  16 passed (16)
      Tests 437 passed (437)
   Duration 4.21s
```

Previous passing count: 281 tests (Phase 10B).
New tests added this phase: 15.
Total: 437 (includes all prior phases plus new curriculum/loader tests from 10A–10C).

## Remaining Risks

1. **lesson-ws.ts vocabulary fallback**: If the curriculum loader returns an empty array (e.g., a future misconfiguration or ID change), `KIDS_LESSON_TARGET_WORDS` will be empty. The session-bootstrap would then set `currentTargetItemId: null`. A startup validation call to `validateRegisteredCurricula()` would catch this, but is not wired into app startup yet.

2. **lessonId is hardcoded in session-bootstrap**: The `PROTOTYPE_LESSON_ID` constant is a string literal — not derived from the curriculum registry. If the prototype lesson ID changes, it must be updated manually. Acceptable for "prototype only for now" scope.

3. **R22 requires isCurrentItem flag to be set correctly**: The `resolveNextItemId` fix depends on `availableItems[i].isCurrentItem === true` being correct. This is set in `runtime-context.ts buildAvailableItems()` by comparing `word === currentItemId`. If `currentTargetItemId` is an item ID format (like `PROTO-ANIM-001`) but `availableItems` uses display words (like `cat`), the `isCurrentItem` flag will never match and the fix will not advance. Currently the runtime passes display words as item IDs, so this is consistent.

4. **No curriculum selection from frontend**: Deliberately not implemented. The prototype lesson is the only selectable lesson. This is the correct scope for Phase 10D.

5. **Adult runtime is untouched**: Confirmed — `getVocabularyWords` import is inside the `USE_KIDS_BRAIN_V1` branch only.

## Next Recommended Phase

**Phase 10E — Startup Curriculum Validation**

Wire `validateRegisteredCurricula()` into app startup (before WS server binds). If validation fails, log a critical error and optionally prevent the kids-brain path from activating. This closes Risk 1 above.

Scope: 1–2 files, ~10 LOC, 1–2 new tests. No frontend changes.

Alternatively, if item ID canonicalization (Risk 3) is a concern before 10E:

**Phase 10D.1 — Item ID Canonicalization**

Switch `KIDS_LESSON_TARGET_WORDS` from display words (`cat`) to item IDs (`PROTO-ANIM-001`), propagate through turn input and session memory, and update all downstream comparisons. This is a larger refactor requiring runtime-context, teacher-response, and classification layer changes.
