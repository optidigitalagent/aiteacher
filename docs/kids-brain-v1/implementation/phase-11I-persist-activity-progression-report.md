# Phase 11I — Persist Activity Progression Report

**Date:** 2026-05-31  
**Scope:** bug fix — no curriculum, frontend, Redis schema, or adult runtime changes  
**Baseline:** 528/528 passing, 0 TS errors  
**Result:** 553/553 passing (+25 new tests), 0 TS errors  

---

## Files Modified

| File | Type | Change |
|------|------|--------|
| `backend/src/kids-brain/runtime/turn-processor.ts` | Fix | Step 6 now persists `learningDecision.nextActivityType` to `currentActivityId` |
| `backend/src/kids-brain/runtime/__tests__/phase-11i-persist-activity-progression.test.ts` | New | 25 new regression tests (A–K) |

---

## Exact Code Change

**File:** `backend/src/kids-brain/runtime/turn-processor.ts`  
**Location:** Step 6, `processKidsBrainTurn()` (~line 453)

### Before

```typescript
const updatedSessionMemory = learningDecision.nextTargetItemId !== undefined
  ? { ...memWithPraise, currentTargetItemId: learningDecision.nextTargetItemId }
  : memWithPraise;
```

### After

```typescript
const updatedSessionMemory: SessionMemory = {
  ...memWithPraise,
  currentActivityId: learningDecision.nextActivityType,
  ...(learningDecision.nextTargetItemId !== undefined
    ? { currentTargetItemId: learningDecision.nextTargetItemId }
    : {}),
};
```

**Net change:** +5 lines, -3 lines. Adds `currentActivityId` write. Preserves existing `currentTargetItemId` logic.

---

## Tests Added

**File:** `phase-11i-persist-activity-progression.test.ts` (25 tests)

| Group | Tests | What it proves |
|-------|-------|----------------|
| A (3) | Any-turn invariant | `currentActivityId === nextActivityType` after correct, wrong, and silence turns |
| B (4) | Equality invariant | Invariant holds for refusal, KB1 correct, KB1 wrong, and null check |
| C (2) | Multi-turn chain | Activity ID propagates correctly across 4-turn and 5-turn sequences |
| D (2) | SENTENCE_PRODUCTION | R20 advances from SENTENCE_FRAME_PRODUCTION to SENTENCE_PRODUCTION; activity propagates to next turn |
| E (1) | R22 eligibility | R22 fires at SENTENCE_PRODUCTION with double CORRECT_CONFIDENT |
| F (1) | shouldAdvanceItem | `shouldAdvanceItem === true` after R22 |
| G (1) | nextTargetItemId | `nextTargetItemId` is defined and in vocabulary list |
| H (2) | blue → green | `currentTargetItemId` changes from `'blue'` to `'green'`; Redis-bound memory correct |
| I (3) | Phase 8.11 regression | Easiest-win target persistence still works; both fields updated together |
| J (3) | Phase 11E regression | Readiness handshake sets flag, preserves target, resumes curriculum |
| K (3) | Phase 11G regression | No `{target}` placeholders in teacher text across normal/wrong/advance turns |

---

## Commands Run

```
cd backend
npx tsc --noEmit          → 0 errors
npx vitest run src/kids-brain → 553/553 passing
```

---

## Proof Activity Advances

Test D (`11i-D1`): 
- Session crafted with `SENTENCE_FRAME_PRODUCTION` + `productionConfidence=0.70` + `comprehensionConfidence=0.70`
- Pre-seeded with 2 CORRECT_CONFIDENT turn records
- 3rd live CORRECT_CONFIDENT turn triggers R20 (triple confident, prod≥65, comp≥65)
- `learningDecision.nextActivityType === SENTENCE_PRODUCTION` ✓
- `updatedSessionMemory.currentActivityId === SENTENCE_PRODUCTION` ✓ (proved by fix)

Test D2: The advanced `SENTENCE_PRODUCTION` activity propagates into the next turn's session memory.

---

## Proof Target Advances (blue → green)

Tests H (`11i-H1`, `11i-H2`):
- Session at `SENTENCE_PRODUCTION` with `productionConfidence=0.65` (post-update engine=77≥75) and `comprehensionConfidence=0.59` (post-update engine=74<75, blocks R21)
- Pre-seeded with 1 CORRECT_CONFIDENT record
- 2nd live CORRECT_CONFIDENT turn triggers R22 (double confident, prod≥75)
- `learningDecision.priorityRuleFired === 'R22_advance_to_next_item_sentence_production'` ✓
- `learningDecision.shouldAdvanceItem === true` ✓
- `learningDecision.nextTargetItemId === 'green'` ✓
- `updatedSessionMemory.currentTargetItemId === 'green'` ✓

---

## Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Activity advances at first confident answer | Low | R20/R21 require triple/double CC + confidence thresholds; accidental advance unlikely at cold start |
| Confidence calibration sensitivity | Low | Tests E-H use exact pre-update values derived from delta constants. If constants change, re-calibrate |
| Multi-session state (Redis) | None | Fix is in-memory assembly; Redis write path unchanged |
| Readiness path | None | Readiness path has its own `updatedSessionMemory` block before Step 6; not affected by this change |

---

## Next Recommended Phase

**Phase 11J — End-to-End Activity Progression Integration Test**

The fix is correct and unit-tested. The next gap is an integration test that:
1. Starts a live WebSocket session
2. Submits multiple correct answers
3. Verifies `lesson-ws.ts` writes the advanced `currentActivityId` to Redis via `saveSession()`
4. Reads back the Redis state and confirms the value

This would prove the fix survives the full WS → turn-processor → Redis write path, not just the in-memory pipeline. It can reuse the existing `lesson-ws.ts` integration test infrastructure.

Alternatively, **Phase 11J — Vocabulary Guard for Advanced Activities** (when child reaches FORCED_CHOICE_2 or SENTENCE_PRODUCTION, verify the teacher response engine correctly selects templates for the new activity type rather than falling back to LISTEN_AND_POINT templates).
