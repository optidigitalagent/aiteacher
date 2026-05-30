# Phase 8.11 — Persist Target Progression Report

## Root Cause

`processKidsBrainTurn()` in `turn-processor.ts` (Step 6) assembled `updatedSessionMemory` from
`stateOutput.updatedSessionMemory` and only propagated `recentPraisePhrases` from the teacher
output. `learningDecision.nextTargetItemId` was computed, visible in the returned result, but
**never written back** to `updatedSessionMemory.currentTargetItemId`.

The caller (lesson-ws.ts, Phase 8.8 wiring) reads `sessionMemory.currentTargetItemId` at the
start of every turn to determine `targetWord`. Because `currentTargetItemId` never changed, the
lesson looped on the same vocabulary item indefinitely regardless of what the learning engine
decided.

## When `nextTargetItemId` Is Produced by the Learning Engine

The learning engine produces a defined `nextTargetItemId` in these priority paths:

| Priority | Trigger | Produces `nextTargetItemId` |
|---|---|---|
| 4 | REFUSAL / L1_REFUSAL label, or recoveryState=REFUSAL | `selectEasiestWin().itemId` (always defined) |
| 5 | `frustrationRisk >= 0.75` (engine: >= 75) | `selectEasiestWin().itemId` |
| 6 | `recoveryState === REPEATED_FAILURE` | `selectEasiestWin().itemId` |
| 7 | `consecutiveWrong >= 3` (labels in WRONG_GROUP) | `selectEasiestWin().itemId` |
| R61 | Review due (review queue non-empty) | `reviewQueue[0].itemId` |

The `selectEasiestWin()` cold-start logic (Phase 7/8: no mastery persistence) returns:
- Level 1 (attemptCount=0): itemId of the simplest non-current item → e.g., 'dog'
- Level 2 (attemptCount=1): same
- Level 3 (attemptCount≥2): itemId of the current item (stays on same word)

Since `attemptsAdded=1` for every turn regardless of label, on turn 1 `attemptCount=1` (level 2),
on turn 2+ `attemptCount≥2` (level 3). This means refusal on turn 1 → nextTargetItemId='dog';
recovery turns 2+ → nextTargetItemId stays on current word.

## Note on R22 (Item Advance via SENTENCE_PRODUCTION)

Rule R22 fires only when `currentActivityId === SENTENCE_PRODUCTION`. Fresh sessions start at
`LISTEN_AND_POINT`. Reaching SENTENCE_PRODUCTION requires ~6 activity-level upgrades (from 3×
triple-confident advances). In Phase 7/8 cold sessions this is unreachable in practice.

R22 also sets `shouldAdvanceItem: true` with `nextItemId: undefined` and a comment "caller
determines next item from availableItems" — but the learning engine does NOT populate the item.
This is a **learning engine issue**, not a runtime issue, and is not touched here per task spec.

## Files Modified

### `backend/src/kids-brain/runtime/turn-processor.ts`

**Before (Step 6, lines ~289-295):**
```typescript
const baseMemory = stateOutput.updatedSessionMemory;
const updatedSessionMemory = teacherOutput.praisePhraseUsed !== null
  ? {
      ...baseMemory,
      recentPraisePhrases: [...baseMemory.recentPraisePhrases, teacherOutput.praisePhraseUsed].slice(-3),
    }
  : baseMemory;
```

**After:**
```typescript
const baseMemory = stateOutput.updatedSessionMemory;
const memWithPraise = teacherOutput.praisePhraseUsed !== null
  ? {
      ...baseMemory,
      recentPraisePhrases: [...baseMemory.recentPraisePhrases, teacherOutput.praisePhraseUsed].slice(-3),
    }
  : baseMemory;

// Persist target item advancement from the learning engine decision.
// When learningDecision.nextTargetItemId is defined, the learning engine has
// explicitly chosen a new target (e.g. easiest-win recovery, review trigger).
// Without this, currentTargetItemId never advances and lessons loop indefinitely.
const updatedSessionMemory = learningDecision.nextTargetItemId !== undefined
  ? { ...memWithPraise, currentTargetItemId: learningDecision.nextTargetItemId }
  : memWithPraise;
```

### `backend/src/kids-brain/runtime/__tests__/phase-8-11-persist-target-progression.test.ts`

New test file, 17 tests across 7 describe blocks (A–G).

## Tests Added

| Group | Description |
|---|---|
| A | Single correct answer → `currentTargetItemId` unchanged (no advancement) |
| B | Refusal (`'no'`) → REFUSAL label → priority 4 → `nextTargetItemId` defined; WRONG_BUT_RELATED ×3 → REPEATED_FAILURE → priority 6 → `nextTargetItemId` defined |
| C | Core persistence guard: `updatedSessionMemory.currentTargetItemId === learningDecision.nextTargetItemId` when defined (non-vacuous using refusal and vocab-group triggers) |
| D | Turn N+1 session memory inherits the advanced target from turn N |
| E | `recentPraisePhrases` still updates correctly alongside target persistence |
| F | No unresolved `{target}` / `undefined` / `null` placeholders after advancement |
| G | Correct classification not regressed; turnNumber increments correctly |

**Key learning about test inputs:** Inputs like `'banana'` or `'spaceship'` at STT confidence
0.88–0.90 fall into the timeout fallback Rule 5 (adj_confidence >= 0.65 AND target known →
`CORRECT_HESITANT`), so they do NOT count as wrong answers and do NOT trigger consecutive-wrong or
failure recovery paths. Reliable wrong-answer triggers are vocabulary-group words (e.g., `'dog'`
for target `'cat'` → `WRONG_BUT_RELATED`) or refusal phrases (`'no'`).

## Before/After Behavior

**Before the fix:**
- Turn 1: child says "cat" for target "cat" → correct → `nextTargetItemId = undefined` → `currentTargetItemId` stays 'cat'
- Turn 2 (after refusal): learning engine sets `nextTargetItemId = 'dog'` → **discarded** → `currentTargetItemId` stays 'cat'
- All subsequent turns: always target 'cat', lesson loops

**After the fix:**
- Turn 2 (after refusal): learning engine sets `nextTargetItemId = 'dog'` → **persisted** → `currentTargetItemId` becomes 'dog'
- Turn 3: lesson-ws.ts reads `sessionMemory.currentTargetItemId = 'dog'` → `targetWord = 'dog'` → classification correct for the new word

## Commands Run

```sh
cd backend
npx tsc --noEmit      # 0 errors
npx vitest run src/kids-brain
```

## Test Results

```
Test Files  12 passed (12)
Tests       363 passed (363)
```

All existing kids-brain tests pass with 0 regressions. 17 new tests added.

## Remaining Risks

1. **R22 item advancement (SENTENCE_PRODUCTION)**: The learning engine sets `shouldAdvanceItem:true`
   with `nextTargetItemId: undefined` for this rule. With the current fix, this means
   `currentTargetItemId` will NOT advance when R22 fires (no item selected). This is a known
   learning engine gap — not patched here per spec.

2. **Cold-start level 3 (attemptCount ≥ 2)**: After 2+ attempts on the same item, `selectEasiestWin`
   returns `itemId = currentItemContext.itemId` (stays on current). Recovery-triggered easiest-win
   turns will still produce `nextTargetItemId = current item` — which is idempotent but won't
   advance to new vocabulary. This is correct behavior (spec: "stay on current item, lowest demand")
   and not a bug.

3. **Linear progression (cat → dog → lion → …)**: The current learning engine has no rule for
   sequential vocabulary progression under normal (non-recovery) conditions. Advancement only
   happens via R22 (SENTENCE_PRODUCTION mastery, cold-session-unreachable) or recovery easiest-win
   (jumps to simplest available item, not next-in-sequence). Full linear progression requires a
   learning engine change, not a runtime change.
