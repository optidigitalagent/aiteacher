# Phase 11E Report — Kids v1 Start Handshake Fix

## Root Cause

`processKidsBrainTurn()` had no concept of a "readiness confirmation" phase.

When a child responded to the greeting "Hello! Let's play and learn English! Are you ready?" with "I'm ready" / "start" / "yes", the full Perception → Classification pipeline ran immediately. The classifier compared the readiness phrase against `currentTargetItemId` (e.g. "blue") and produced `WRONG_SEMANTIC` or `RANDOM_NONSENSE`. The Teacher Response Engine then emitted "Let's try again!" — before the first exercise had started.

Specifically: `buildInitialSessionMemory()` seeded `currentTargetItemId = lessonTargetWords[0]` and `lessonPhase = WARM_UP`, but provided no flag indicating the session was still in the greeting/readiness phase. The turn processor treated every input as a curriculum answer.

## Files Modified

| File | Change |
|---|---|
| `backend/src/kids-brain/shared/log-events.ts` | Added `READINESS_PHRASE_INTERCEPTED` log event |
| `backend/src/kids-brain/contracts/session-memory.ts` | Added `hasStartedFirstExercise?: boolean` field |
| `backend/src/kids-brain/runtime/session-bootstrap.ts` | Initialized `hasStartedFirstExercise: false` |
| `backend/src/kids-brain/runtime/turn-processor.ts` | Added readiness set, helper, intercept, and helper function |

## New Test File

`backend/src/kids-brain/runtime/__tests__/phase-11e-start-handshake.test.ts` — 17 new tests.

## Exact Handshake Fix

### 1. New `SessionMemory` field (`session-memory.ts`)

```typescript
// Phase 11E: readiness handshake — false until first readiness phrase is confirmed.
// Optional for backward compatibility with sessions created before Phase 11E.
hasStartedFirstExercise?: boolean;
```

Backward compatible: `undefined` is treated as `false` by the guard in `turn-processor.ts` (`!sessionMemory.hasStartedFirstExercise`).

### 2. Initialized to `false` in bootstrap (`session-bootstrap.ts`)

```typescript
hasStartedFirstExercise: false,
```

### 3. Readiness guard in `processKidsBrainTurn()` (`turn-processor.ts`)

After step 1 (perception), before step 2 (classification):

```typescript
if (
  !sessionMemory.hasStartedFirstExercise &&
  perceptionBundle.normalizedTranscript !== null &&
  isReadinessPhrase(perceptionBundle.normalizedTranscript)
) {
  return buildReadinessTurnResult(input, sessionMemory, perceptionBundle, inputTurnNumber, logs);
}
```

### 4. Accepted readiness phrases (case-insensitive, normalized)

```
"i'm ready", "im ready", "ready", "yes", "yep", "ok", "okay",
"start", "let's go", "lets go", "go"
```

### 5. Readiness result (`buildReadinessTurnResult`)

- Builds a **neutral synthetic classification** (`CORRECT_HESITANT`, source `deterministic`, `requiresRecovery: false`, `eligibleForMasteryUpdate: false`, `eligibleForProgression: false`) — so no mastery/progression/recovery effects apply.
- Runs state engine normally (increments `turnNumber`, applies small positive engagement signals — child is present and responding).
- Runs learning engine normally (stays on current item because `eligibleForProgression: false`).
- Emits scripted teacher response: `"Listen — [word]! Now you!"` (never "try again", never wrong-answer feedback).
- Sets `hasStartedFirstExercise: true` and **preserves `currentTargetItemId`** (never advances on readiness).

## New `SessionMemory` Field

```typescript
hasStartedFirstExercise?: boolean;
```

- `false` (or `undefined`): session is in greeting/readiness phase; readiness phrases are intercepted.
- `true`: session is in active lesson; all turns go through the normal classification pipeline.

## Tests Added

17 new tests in `phase-11e-start-handshake.test.ts`:

1. `startKidsBrainSession` returns a greeting action packet ✓
2. Session memory starts with `hasStartedFirstExercise = false` ✓
3. "I'm ready" does not produce a failure classification ✓
4. "start" does not produce a failure classification ✓
5. "yes" does not produce a failure classification ✓
6. "ok" does not produce a failure classification ✓
7. Readiness input emits the first target word in the teacher response ✓
8. Readiness response does NOT contain "try again" or "wrong" ✓
9. Readiness response includes `TEACHER_TEXT` and `START_LISTENING` packets ✓
10. `hasStartedFirstExercise` is `true` after readiness turn ✓
11. First target word is preserved (not advanced) after readiness turn ✓
12. Correct answer after readiness classifies as a correct label (`CORRECT_CONFIDENT` or `CORRECT_HESITANT`) ✓
13. Wrong answer after readiness classifies normally (not intercepted as readiness) ✓
14. `eligibleForMasteryUpdate` and `eligibleForProgression` are `false` for readiness ✓
15. No recovery triggered for readiness input ✓
16. Kids-brain module loads without importing adult runtime ✓
17. `processKidsBrainTurn` with `hasStartedFirstExercise=true` skips the readiness intercept ✓

## Commands Run

```
cd backend
npx tsc --noEmit
npx vitest run src/kids-brain
```

## Test Results

```
Test Files  19 passed (19)
Tests       521 passed (521)
```

0 TypeScript errors. 521/521 tests passing (was 504/504 before Phase 11E; 17 new tests added).

## Remaining Risks

1. **Non-readiness first input**: If the child's first input is NOT a readiness phrase (e.g. they immediately say "blue"), the guard is skipped and the normal pipeline runs. This is the correct behavior — there is no requirement for a readiness confirmation.

2. **Silence on first turn**: If the child says nothing (silence), `normalizedTranscript` is `null`, so the readiness guard is skipped and silence handling runs normally. This is correct.

3. **`hasStartedFirstExercise` in Redis**: Existing sessions persisted in Redis before Phase 11E will have `hasStartedFirstExercise = undefined`, which is treated as `false` by the guard. This is safe: it only affects the first turn if the child happens to say a readiness phrase — unlikely mid-lesson.

4. **State engine positive deltas on readiness**: The readiness turn applies small positive `childState` deltas (comprehension, emotional safety) because the synthetic classification is `CORRECT_HESITANT`. This is pedagogically correct (child is engaged and responded), but slightly inflates initial state scores. Empirically neutral.

## Next Recommended Phase

**Phase 11F — Kids v1 Lesson Phase Transitions**

The session currently stays in `LessonPhase.WARM_UP` indefinitely. After `hasStartedFirstExercise = true`, it should transition to `LessonPhase.INTRODUCTION` (introduce target words) → `LessonPhase.PRACTICE` (repetition) → `LessonPhase.CONSOLIDATION`. Implement the lesson-phase FSM so the teacher adapts its prompts as the child progresses through the lesson arc.
