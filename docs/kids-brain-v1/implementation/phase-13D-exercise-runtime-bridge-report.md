# Phase 13D — Exercise Runtime Bridge — Implementation Report

## Commands run

```
npx tsc --noEmit          → 0 errors
npx vitest run src/kids-brain → 643/643 passed
```

## Files modified

| File | Change |
|------|--------|
| `backend/src/kids-brain/contracts/session-memory.ts` | Added 5 optional exercise-tracking fields |
| `backend/src/kids-brain/runtime/session-bootstrap.ts` | Imported `findLessonById`; added `resolveFirstExercise()`; seeded exercise fields in `buildInitialSessionMemory` |
| `backend/src/kids-brain/runtime/turn-processor.ts` | Imported `applyExerciseBridge`, `findLessonById`; added `runExerciseBridge()` helper; wired bridge into readiness path and main pipeline Step 6 |
| `backend/src/kids-brain/curriculum/curriculum-loader.ts` | Added `findLessonById()` and `loadLessonExercises()` |
| `backend/src/kids-brain/runtime/exercise-runner.ts` | **New file** — pure bridge helpers |
| `backend/src/kids-brain/runtime/__tests__/phase-13d-exercise-runtime-bridge.test.ts` | **New file** — 29 tests across 15 describe groups |

## Session memory fields added

```typescript
// Phase 13D: optional, backward-compatible
currentExerciseId?: string | null;    // null = no exercises or lesson exhausted
currentExerciseOrder?: number | null; // 1-based order of current exercise
exerciseAttemptCount?: number;        // cumulative turns on this exercise; resets on advance
exerciseCorrectCount?: number;        // cumulative correct answers; resets on advance
completedExerciseIds?: string[];      // all exercises completed so far
```

Old sessions missing these fields continue to work — the bridge checks `!memory.hasStartedFirstExercise` and `!memory.currentExerciseId` before proceeding.

## Exact bridge behavior

### Bootstrap (`session-bootstrap.ts`)
- Calls `findLessonById('kb1-u01-l02')` during `buildInitialSessionMemory`
- Finds first exercise (order=1) = `kb1-u01-l02-ex-01-readiness`
- Seeds `currentExerciseId`, `currentExerciseOrder=1`, `exerciseAttemptCount=0`, `exerciseCorrectCount=0`, `completedExerciseIds=[]`
- Lessons without exercises → both IDs set to `null`

### Readiness handshake path (`buildReadinessTurnResult`)
- After marking `hasStartedFirstExercise=true`, calls `runExerciseBridge(memAfterReadiness, CORRECT_HESITANT)`
- Bridge finds ex-01 (LISTEN_ONLY, TEACHER_CONTROLLED, order=1)
- **Silent advance guard**: since `hasStartedFirstExercise=true` and exercise is the listen-only readiness type, advances to ex-02 WITHOUT overriding `currentTargetItemId`
- Result: `currentExerciseId = 'kb1-u01-l02-ex-02-blue'`, `exerciseAttemptCount=0`, ex-01 in `completedExerciseIds`

### Main pipeline (`processKidsBrainTurn` Step 6+)
Applied after the learning engine updates `currentActivityId` and optionally `currentTargetItemId`.

**Guard 1 — readiness not confirmed**: if `hasStartedFirstExercise` is false/undefined, the bridge returns the memory unchanged. Ensures pre-readiness turns (including sessions that bypass the readiness phrase) never have their target overridden.

**Guard 2 — silent advance of LISTEN_ONLY readiness exercise**: if `hasStartedFirstExercise=true` but cursor is still at ex-01 (elevated test sessions that skip the readiness path), advances ex-01 silently without overriding `currentTargetItemId`. Preserves learning-engine target changes (e.g. R22).

**Normal completion** (ex-02 onward):
- `CORRECT_REPETITIONS` (ex-02–05): cumulative `exerciseCorrectCount`; completes when `(correctCount+1) >= requiredCorrectCount`
- `CORRECT_CHOICE` (ex-06–07): completes on first correct answer
- `TEACHER_CONTROLLED` (ex-08 review, ex-09 chant, ex-10 close): completes after `maxAttempts` turns regardless of classification
- On completion: appends exerciseId to `completedExerciseIds`, advances `currentExerciseId`, resets both counters, updates `currentTargetItemId` from next exercise's `targetItemIds[0]` (resolved via lesson items)
- On non-completion: increments `exerciseAttemptCount`; increments `exerciseCorrectCount` only on correct labels

## Exercise progression proof

### Bootstrap
```
startKidsBrainSession({ lessonTargetWords: ['blue', 'green', ...] })
→ sessionMemory.currentExerciseId = 'kb1-u01-l02-ex-01-readiness'
→ sessionMemory.currentExerciseOrder = 1
→ sessionMemory.completedExerciseIds = []
```

### Readiness → ex-02
```
processKidsBrainTurn(sessionMemory, stt: "I'm ready", target: 'blue')
→ buildReadinessTurnResult path
→ runExerciseBridge: ex-01 silent advance
→ updatedSessionMemory.currentExerciseId = 'kb1-u01-l02-ex-02-blue'
→ updatedSessionMemory.completedExerciseIds = ['kb1-u01-l02-ex-01-readiness']
→ currentTargetItemId = 'blue' (unchanged)
```

### 2 correct blues → ex-03-green
```
turn-1 (correct 'blue'):
  exerciseCorrectCount: 0→1
  exerciseAttemptCount: 0→1
  currentExerciseId: ex-02-blue (unchanged, needs 2)

turn-2 (correct 'blue'):
  shouldCompleteExercise: (1+1)>=2 → true
  completedExerciseIds += 'kb1-u01-l02-ex-02-blue'
  currentExerciseId → 'kb1-u01-l02-ex-03-green'
  currentTargetItemId: 'blue' → 'green'
  exerciseAttemptCount: 0, exerciseCorrectCount: 0
```

### Wrong answer
```
turn (wrong):
  exerciseAttemptCount: N→N+1
  exerciseCorrectCount: unchanged (cumulative model)
  currentExerciseId: unchanged
```

### CHOOSE exercise (ex-06, CORRECT_CHOICE, required=1)
```
turn-1 (correct 'blue'):
  shouldCompleteExercise: (0+1)>=1 → true
  advances to ex-07-choose-pair-2
```

### Lesson close (ex-10, nextExerciseId=null)
```
turn (any):
  shouldCompleteExercise → true (TEACHER_CONTROLLED, maxAttempts=1)
  currentExerciseId → null (lesson exhausted)
```

## Tests added (29 total)

| Group | Description |
|-------|-------------|
| A+B | Bootstrap seeds ex-01, order=1, counts=0, completedExerciseIds=[] |
| C | Readiness phrase advances to ex-02; ex-01 in completedExerciseIds; target stays blue; counters reset |
| D+E | 2 correct blues → ex-03; currentTargetItemId = green; order=3 |
| F | Both ex-01 and ex-02 in completedExerciseIds after both complete |
| G+H | exerciseAttemptCount and exerciseCorrectCount reset to 0 after completion |
| I | Wrong increments attemptCount not correctCount; correct increments correctCount; exercise stays |
| J | All exercise fields JSON-serializable via round-trip |
| K | Old sessions (undefined exercise fields) and proto animals sessions work normally |
| L | currentExerciseId=null after ex-10-close completes |
| M | CHOOSE (ex-06) completes after 1 correct choice |
| N | 3 wrong turns → exerciseAttemptCount=3, exercise stays at ex-02 |
| O | RuntimeActionPacketType enum values unchanged (no WS protocol change) |

## Remaining risks

1. **Proto session lessonId mismatch**: All sessions use `PROTOTYPE_LESSON_ID='kb1-u01-l02'` regardless of the words passed. If a session starts with animals words but `lessonId='kb1-u01-l02'`, the bridge skips via Guard 1 (hasStartedFirstExercise=false or the readiness guard). This is acceptable for Phase 13D since proto sessions never go through the readiness flow.

2. **TEACHER_CONTROLLED exercise timing**: ex-08 (review, maxAttempts=2) and ex-09 (chant, maxAttempts=2) auto-advance after 2 turns. This means regardless of child engagement, they advance. Phase 14 can improve this with explicit teacher control signals.

3. **Teacher text not exercise-aware**: The teacher response engine generates text before the exercise bridge fires. After ex-02 completes and target advances to 'green', the teacher might still reference 'blue'. Phase 14 should override the teacher text with `buildExercisePrompt(nextExercise)` on exercise advance.

4. **Multi-lesson support**: `PROTOTYPE_LESSON_ID` is hard-coded in session-bootstrap. Adding support for dynamic lesson assignment is a Phase 14 task.

## Next recommended phase

**Phase 13E — Exercise-aware teacher text**: When the exercise bridge advances to a new exercise on a turn, inject `buildExercisePrompt(nextExercise)` as the teacher's main text, replacing the learning-engine-generated response. This completes the "teacher follows the exercise sequence" requirement.

Alternatively: **Phase 14 — Multi-lesson session bootstrap**: allow `KidsBrainSessionStartInput` to carry the active `lessonId` so sessions aren't hard-coded to `kb1-u01-l02`.
