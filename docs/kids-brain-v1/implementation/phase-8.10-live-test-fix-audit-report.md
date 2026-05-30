# Phase 8.10 — Live Test Fix Audit Report

**Date:** 2026-05-30
**Triggered by:** Real internal Kids Brain test session executed after Phase 8.9.

---

## Results Summary

| | Status |
|---|---|
| TypeScript errors | **0** |
| kids-brain tests | **346 / 346 passing** (+7 new) |
| Files modified | **2** |
| Priority 1 (placeholder bug) | **FIXED** |
| Priority 2 (progression loop) | **ANALYSIS ONLY — not implemented** |
| Priority 3 (visual prompts) | **ANALYSIS ONLY — not implemented** |

---

## Priority 1 — Placeholder Bug: `{target}` in Teacher Output

### Observed

Teacher speaks:

```
"Together — {target}! Your turn!"
```

### Root Cause

**File:** `backend/src/kids-runtime/recovery-manager.ts`

The `TOGETHER_SCRIPTS` array (lines 29–33) contains templates with **two** `{target}` markers:

```typescript
const TOGETHER_SCRIPTS = [
  "Let's say it together! Ready? {target}! Now YOU!",
  'With me! {target}! Together — {target}! Your turn!',   // ← two {target}
  'You and me! {target}! Again — {target}! Now just you!', // ← two {target}
];
```

The substitution used `String.replace('{target}', targetWord)` with a **string literal**, which replaces only the **first** occurrence. The second `{target}` survived and was delivered to the user verbatim.

When the template `'With me! {target}! Together — {target}! Your turn!'` was selected (level 2 or 3 recovery) and the word was e.g. `cat`:

```
"With me! cat! Together — {target}! Your turn!"
             ^^^^^^^^^^^^^^^
             first replaced   second leaked
```

The observed output `"Together — {target}! Your turn!"` is exactly the **suffix** of the resulting string (starting after the first substitution).

The same bug existed in all three call sites (lines 205, 285, 296–298).

### Fix Applied

Changed all three `.replace('{target}', ...)` calls to regex replacements that match every occurrence:

```typescript
// Before (all 3 sites):
.replace('{target}', targetWord)

// After:
.replace(/\{target\}/g, targetWord)
```

**Files modified:**
- `backend/src/kids-runtime/recovery-manager.ts` — 3 lines changed (lines 205, 285, 297)

### Regression Tests Added

7 new tests added to `backend/src/kids-brain/teacher-response/__tests__/teacher-response-engine.test.ts` (tests B1–B7):

| Test | Coverage |
|---|---|
| B1 | `renderTemplate` replaces every `{word}` occurrence (multi-occurrence) |
| B2 | `renderTemplate` replaces every `{optA}` / `{optB}` occurrence |
| B3 | All `repeat_after_me` variants render without unresolved placeholders |
| B4 | All template bank keys (`correct_answer`, `near_correct`, etc.) render cleanly |
| B5 | `buildRecoveryResponse` produces no `{word}`, `{optA}`, `{optB}`, `{target}` for all recovery types |
| B6 | `applyPlaceholderGuard` catches all `TOGETHER_SCRIPTS`-style `{target}` patterns |
| B7 | `forced_choice` templates render both options with no remaining placeholders |

---

## Priority 2 — Progression Loop (Analysis Only)

### Observed

Teacher repeats the same vocabulary words in a cycle (e.g., cat → dog → cat → dog) instead of advancing through the six-word prototype vocabulary.

### Trace: `currentTargetItemId` Lifecycle

#### Session start (`session-bootstrap.ts:62`)

```typescript
currentTargetItemId: input.lessonTargetWords[0] ?? null,  // → 'cat'
```

Seeded correctly from the first word in `KIDS_PROTOTYPE_TARGET_WORDS = ['cat', 'dog', 'lion', ...]`.

#### Per-turn input (`lesson-ws.ts:1276`)

```typescript
targetWord: sessionMemory.currentTargetItemId ?? KIDS_PROTOTYPE_TARGET_WORDS[0],
```

Reads `currentTargetItemId` from Redis — starts at `'cat'`.

#### Learning engine decision (`learning-engine.ts:339–357`)

The engine produces a valid `LearningDecision` with:
- `shouldAdvanceItem: true` (when mastery thresholds met, e.g. R22)
- `nextTargetItemId: 'dog'` (or next item selected by `selectEasiestWin` / `computeProgressionDecision`)

The `nextTargetItemId` field is populated and correct.

#### **THE GAP — `turn-processor.ts:288–295`**

```typescript
// Step 6: Update recentPraisePhrases in session memory
const baseMemory = stateOutput.updatedSessionMemory;
const updatedSessionMemory = teacherOutput.praisePhraseUsed !== null
  ? {
      ...baseMemory,
      recentPraisePhrases: [...baseMemory.recentPraisePhrases, teacherOutput.praisePhraseUsed].slice(-3),
    }
  : baseMemory;
```

`learningDecision.nextTargetItemId` is **never applied** to `updatedSessionMemory.currentTargetItemId`. Only `recentPraisePhrases` is updated.

#### State engine (`session-memory-updater.ts:53–65`)

```typescript
return {
  ...original,
  childState, recoveryState, itemState, recentTurns, costCounters,
  currentActivityId: ...,
  turnNumber: original.turnNumber + 1,
  // currentTargetItemId: NOT UPDATED
};
```

The state engine also does not update `currentTargetItemId` — by design, it doesn't have access to the learning decision.

#### Persistence (`lesson-ws.ts:1308`)

```typescript
await getKidsBrainRedisStore().saveSession(result.updatedSessionMemory)
```

The unchanged `currentTargetItemId = 'cat'` is written back to Redis.

#### Result

Every turn reads the same `currentTargetItemId = 'cat'` from Redis. The teacher always responds about `'cat'`. The learning engine generates correct `nextTargetItemId` decisions that are silently discarded.

The cat → dog → cat → dog cycling observed during testing most likely occurred from pressing the "I don't understand" button multiple times, which in some paths triggers the `easiest-win-selector` to suggest a different item (`simplest` = item with fewest attempts among non-current items). The learning decision gets `nextTargetItemId: 'dog'`, which is correctly computed but — as shown above — never persisted. The teacher still says `'cat'`, but the selector oscillates between items on alternate calls, explaining the appearance of cycling.

### Root Cause

**File:** `backend/src/kids-brain/runtime/turn-processor.ts`
**Lines:** 288–295

`learningDecision.nextTargetItemId` is computed and available in step 4 but is never written to `updatedSessionMemory.currentTargetItemId` in step 6.

### Smallest Safe Fix

```typescript
// turn-processor.ts — replace step 6 (lines 288–295) with:

const baseMemory = stateOutput.updatedSessionMemory;
const nextItemId = learningDecision.nextTargetItemId ?? baseMemory.currentTargetItemId;
const updatedSessionMemory = teacherOutput.praisePhraseUsed !== null
  ? {
      ...baseMemory,
      currentTargetItemId: nextItemId,
      recentPraisePhrases: [...baseMemory.recentPraisePhrases, teacherOutput.praisePhraseUsed].slice(-3),
    }
  : {
      ...baseMemory,
      currentTargetItemId: nextItemId,
    };
```

**Estimated LOC:** +3 lines, 0 structural changes.

---

## Priority 3 — Visual Prompt Audit (Analysis Only)

The following prompts require a visible image, object, or clickable element that does not exist in the current adult-interface prototype.

### Prompts Requiring Visual UI

| Prompt | File | Reason | Risk | Recommended Temporary Replacement |
|---|---|---|---|---|
| `"That's okay! Can you point to the {target}? Show me!"` | `src/kids-runtime/recovery-manager.ts` EASIEST_WIN_SCRIPTS[0] | Requires pointing to on-screen image | **High** — child has no image to point at; request is unanswerable | `"That's okay! Just say it with me — {target}! Say: {target}!"` |
| `"No worries! Look — can you find the {target}?"` | `src/kids-runtime/recovery-manager.ts` EASIEST_WIN_SCRIPTS[1] | Requires visual search of on-screen elements | **High** — same | `"No worries! Listen — {target}! Can you say {target}?"` |
| `"It's okay! Just point to the {target} for me!"` | `src/kids-runtime/recovery-manager.ts` EASIEST_WIN_SCRIPTS[2] | Requires pointing | **High** — same | `"It's okay! Say it with me — {target}! {target}! Your turn!"` |
| `'Can you point to the {word}?'` | `src/kids-brain/teacher-response/response-template-bank.ts` easiest_win[1] | Requires pointing to image | **Medium** — adult interface has no image; child may be confused but can still attempt | `'Say it with me — {word}! Just say: {word}!'` |
| `"${word}! Hands up! ${word}! Say: ${word}!"` | `src/kids-brain/teacher-response/scaffold-response-builder.ts` level 2 | Physical gesture (Total Physical Response) — requires child to understand "hands up" as play | **Low** — gesture is fun and non-blocking; child can ignore and still say the word | No change needed for prototype |

### Already Fixed (No Action Needed)

| Prompt | Location | Status |
|---|---|---|
| `"Point to it!"` / `"Where is the dog?"` | `activity-prompt-builder.ts` LISTEN_AND_POINT | **Already fixed** in a prior phase — now routes to `repeat_after_me` (audio-first) |

### Notes

- The 3 high-risk prompts in `EASIEST_WIN_SCRIPTS` are part of `kids-runtime` (old module), which fires only for `NO_RESPONSE` / `L1_SWITCH` freeze recovery at level 3, pattern 3c. This is a lower-frequency code path.
- The `kids-brain` `easiest_win` template `'Can you point to the {word}?'` fires when `ActivityType.EASIEST_WIN` or `LearningActivityType.EASIEST_WIN` is selected by the learning engine. During prototype testing with the adult interface, this will produce an unanswerable request.
- No visual prompts were found in `scaffold-response-builder.ts` levels 1, 3, 4, 5, or 6.
- No visual prompts were found in `recovery-response-builder.ts`.
- No visual prompts were found in `fast-track-reactions.ts`.

---

## Files Modified

| File | Change |
|---|---|
| `backend/src/kids-runtime/recovery-manager.ts` | 3 × `replace('{target}', ...)` → `replace(/\{target\}/g, ...)` |
| `backend/src/kids-brain/teacher-response/__tests__/teacher-response-engine.test.ts` | Added 7 regression tests (B1–B7) |
