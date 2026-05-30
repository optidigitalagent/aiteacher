# Kids Brain v1 — Phase 8.5 Bug Analysis

**Date:** 2026-05-30  
**Analyst:** Phase 8.5 QA simulation run  
**Test suite:** `backend/src/kids-brain/runtime/__tests__/kids-brain-simulation.qa.test.ts`  
**Status after phase 8.5 edits:** 52 passed / **5 failed**

---

## Summary Table

| ID  | Finding                                    | Type         | Severity | File                                  | Status   |
|-----|--------------------------------------------|--------------|----------|---------------------------------------|----------|
| B1  | Greeting is 13 words (limit 12)            | Real bug     | LOW      | `runtime/session-bootstrap.ts:24`     | Open     |
| B2  | mild\_confusion fires after correct turns  | Real bug     | CRITICAL | `runtime/turn-processor.ts:204`       | Open     |
| B3  | 2s silence → `isSilence=false`            | Test design  | —        | test file line 398                    | Open     |
| B4  | 3× I\_DONT\_KNOW stays NORMAL recovery    | Real bug     | MEDIUM   | `state-engine/recovery-state-updater.ts:20` | Open |
| B5  | Playful→correct `eligibleForProgression=false` | Derived B2 | CRITICAL | same as B2                           | Open     |
| P1  | Praise rotation passes by coincidence      | Fragile test | LOW      | `session-memory-updater.ts` + test    | Open     |

---

## B1 — Greeting word count exceeds age-profile limit

### Reproduce

```
Scenario 16 > start → progression → recovery → close: QA passes every turn
→ [greeting] 13 words > max 12 (age 6-7): expected 13 to be less than or equal to 12
```

### Root cause

`session-bootstrap.ts:24`:

```ts
const GREETING_TEXT = "Hello! Let's play and learn English today! Are you ready? Here we go!";
```

Word count: Hello(1) Let's(2) play(3) and(4) learn(5) English(6) today(7) Are(8) you(9) ready(10) Here(11) we(12) go(13) = **13 words**.

`MAX_WORDS_BY_AGE['6-7'] = 12` (`teacher-response-constants.ts:5`).

The `enforceMaxLength` guard in `teacher-response-engine.ts` trims at 12 words, but the greeting bypasses the guard — it is built by `buildGreetingPlan` and fed directly through `buildTeacherResponsePlan` without guard execution.

The test assertion `assertTeacherQuality` → `assertWordCount` fires on the raw `greetingPlan.mainText`.

### Classification

Real bug. The hardcoded string was never counted against its own spec limit.

### Severity

LOW. No child-facing harm. Single string to shorten.

### Smallest safe fix

Change `GREETING_TEXT` to any string ≤12 words. Example (10 words):

```ts
const GREETING_TEXT = "Hello! Let's play and learn English! Are you ready?";
```

---

## B2 — mild\_confusion fires after correct turns (CRITICAL)

### Reproduce

```
Scenario 1 > emotional safety stays above 0.5 and recovery stays NORMAL
→ expected 'mild_confusion' to be 'normal'
```

Occurs after 3 consecutive turns where the child answers the exact target word.

### Root cause — full trace

**Step 1** — `turn-processor.ts:204`: the classification input is assembled **without `vocabularyContext`**:

```ts
const classificationInput: ClassificationInput = {
  perception: perceptionBundle,
  activityContext,
  recentTurns: sessionMemory.recentTurns,
  ageProfile: sessionMemory.ageProfile,
  // vocabularyContext: not passed ← BUG
};
```

**Step 2** — `runtime-context.ts:38`: `buildActivityContext` reads `sessionMemory.currentTargetItemId`, which is initialized to `null` in bootstrap and **never updated** by the state engine (only `itemState` Map entries are updated; `currentTargetItemId` is not reassigned).

```ts
return {
  ...
  currentTargetItemId: sessionMemory.currentTargetItemId,  // always null
};
```

**Step 3** — `classification/deterministic-classifier.ts:196`: Rules 12–17 (exact match, phonetic match, near match) all require a `targetWord`:

```ts
const targetWord = vocabularyContext?.targetWord ?? activityContext.currentTargetItemId;
// undefined ?? null = null → all word-match rules SKIP
if (targetWord) { ... }   // never entered
```

Deterministic classifier returns `null` for every correct single-word answer.

**Step 4** — `classification/classification-router.ts:84`: no LLM is injected, so the conservative fallback fires:

```ts
const recentFailureCount = recentTurns.filter(t => !t.wasSuccess).length;
return computeTimeoutFallback(perception, activityContext.currentTargetItemId, recentFailureCount);
```

**Step 5** — `classification/timeout-fallback.ts`: for a 1-word transcript like "cat" with `adjustedSttConfidence = 0.636`:

```
adjustedSttConfidence = 0.88 (raw) × 0.85 (child_prior_6_7) × 0.85 (1-word penalty) = 0.636
```

The 0.636 value is **below** the `>= 0.65` threshold in rules 5 and 6 of the fallback. The path resolves as:

- Turn 1: `recentFailureCount = 0` → default → **RANDOM\_NONSENSE**
- Turn 2: `recentFailureCount = 1` → default → **RANDOM\_NONSENSE**
- Turn 3: `recentFailureCount = 2` → Rule 7 (`< 0.65 && >= 2`) → **WRONG\_SEMANTIC**

**Step 6** — `state-engine/recovery-state-updater.ts:129`: `projectFailureCount` accumulates:

- After Turn 2 is appended: 2 RANDOM\_NONSENSE turns in history + WRONG\_SEMANTIC current = 3 projected failures
- Tier 5 check: `projectedFailureCount >= 3` → **REPEATED\_FAILURE**
  
  Actually: Turn 3 label is WRONG\_SEMANTIC (in FAILURE\_LABELS). Tier 6 fires even earlier:
  After Turn 1+2 in history, Turn 3 projected count = 2+1 = 3. Tier 5 (≥3) fires → `REPEATED_FAILURE`.
  
  The `mild_confusion` seen in the test failure message occurs at the state after Turn 2 (projectedFailureCount = 2+1=3... no, wait: Turn 2 is the *third* round of the loop but uses words in sequence). The exact state machine path is:
  
  - After Turn 1 (cat→RANDOM\_NONSENSE): 0 prev failures + 1 current = 1 projected → NORMAL
  - After Turn 2 (dog→RANDOM\_NONSENSE): 1 prev failure + 1 current = 2 projected → **MILD\_CONFUSION** (Tier 6, ≥2)
  - After Turn 3 (lion→WRONG\_SEMANTIC): 2 prev failures + 1 current = 3 projected → REPEATED\_FAILURE

The test fails at the Turn 2 assertion: `expected 'mild_confusion' to be 'normal'`.

### Downstream effects

Every correct answer in every fresh session is classified as RANDOM\_NONSENSE or WRONG\_SEMANTIC. Consequences:

1. `eligibleForProgression = false` for all correct answers — mastery never advances
2. Teacher response falls to `fallback_safe` → outputs `"Let's try again!"` instead of praise
3. Recovery state incorrectly enters `mild_confusion` then `repeated_failure`
4. This causes Scenario 9 (B5) to fail: after a playful turn, the subsequent correct answer is still misclassified

### Classification

Real bug. Critical pipeline break. The deterministic classifier has all the correct logic for word-match rules (Rules 12–17), but the entry point never hands it the target word.

### Severity

CRITICAL. Affects every session, every correct answer, every turn.

### Smallest safe fix

In `turn-processor.ts`, add `vocabularyContext` to `classificationInput`. The `KidsBrainTurnInput.targetWord` field is already available:

```ts
const classificationInput: ClassificationInput = {
  perception: perceptionBundle,
  activityContext,
  recentTurns: sessionMemory.recentTurns,
  ageProfile: sessionMemory.ageProfile,
  vocabularyContext: input.targetWord
    ? {
        targetWord: input.targetWord,
        vocabularyGroup: input.lessonTargetWords,
      }
    : undefined,
};
```

No other file needs to change. This single addition restores the full deterministic path for exact match, phonetic match, and near-match rules.

---

## B3 — 2s silence → `isSilence=false` (Test design error)

### Reproduce

```
Scenario 6 > short silence (2s) → gentle scaffolding, no frustration
→ expected false to be true   [perceptionBundle.isSilence]
```

### Root cause

`perception/silence-analyzer.ts:34`:

```ts
const shortThreshold = SILENCE_THRESHOLD_SHORT_MS + adj;  // 3000 + 500 = 3500ms for 6-7
const isShortSilence = silenceDurationMs < shortThreshold; // 2000 < 3500 = true
const isSilence = !isShortSilence;                         // false
```

2000ms is correctly classified as a short gap, not as silence per spec §5.5. The source code is correct. The test assertion is wrong: it expects `isSilence=true` for 2s, but 2s is explicitly below the 3.5s silence threshold for 6-7 year olds.

### Classification

Test design error. Source behavior matches spec.

### Considerations

A pedagogical question worth spec-level review: should a 2s pause from a 6-7 year old trigger a silence handler? The current spec says no. If the team decides 2s *should* register as silence for young children, the fix is in constants (`SILENCE_THRESHOLD_SHORT_MS`). Otherwise the test must change.

### Fix (test-only)

Change the 2s silence test to use a duration above the 3.5s threshold:

```ts
const r = await processKidsBrainSilence(makeSilence(sessionMemory, 4000, 'cat'));
// 4000ms > 3500ms → isSilence=true
```

---

## B4 — 3× I\_DONT\_KNOW stays NORMAL recovery

### Reproduce

```
Scenario 7 > 3 repeated "I don't know" — recovery activates, teacher stays warm
→ expected 'normal' not to be 'normal'
```

### Root cause

`state-engine/recovery-state-updater.ts:20`:

```ts
const FAILURE_LABELS = new Set<ClassificationLabel>([
  ClassificationLabel.WRONG_SEMANTIC,
  ClassificationLabel.WRONG_BUT_RELATED,
  ClassificationLabel.RANDOM_NONSENSE,
  ClassificationLabel.AVOIDANCE_NONSENSE,
  ClassificationLabel.NO_RESPONSE,
  ClassificationLabel.REFUSAL,
  ClassificationLabel.L1_REFUSAL,
  ClassificationLabel.EMOTIONAL_SHUTDOWN,
  // I_DONT_KNOW ← MISSING
]);
```

`I_DONT_KNOW` is not in `FAILURE_LABELS`, so `projectFailureCount` never increments for it. After 3 consecutive `I_DONT_KNOW` turns, `projectedFailureCount = 0` → Tiers 5 and 6 never fire → recovery stays `NORMAL`.

The pedagogical intent is clear: 3 "I don't know" answers in a row means the child is stuck and needs an easier task or support. The recovery state machine should escalate.

The same omission exists in `turn-history-updater.ts:17` (the SUCCESS\_LABELS/FAILURE\_LABELS used for `wasSuccess` and rolling counts):

```ts
const FAILURE_LABELS = new Set<ClassificationLabel>([
  // same list — I_DONT_KNOW also missing here
]);
```

### Classification

Real bug. Pedagogically consequential: a struggling child who says "I don't know" repeatedly receives no recovery behavior.

### Severity

MEDIUM. Does not crash. Does not harm emotionally. But withholds the support response the spec requires.

### Smallest safe fix

Add `ClassificationLabel.I_DONT_KNOW` to `FAILURE_LABELS` in both:
- `state-engine/recovery-state-updater.ts:20`
- `state-engine/turn-history-updater.ts:17`

This ensures `I_DONT_KNOW` is counted in the rolling failure window and triggers `mild_confusion` after 2 occurrences and `repeated_failure` after 3, which in turn routes the teacher to `recovery_script` → easier task.

---

## B5 — Playful→correct `eligibleForProgression=false` (Derived from B2)

### Reproduce

```
Scenario 9 > playful → correct: lesson returns normally after redirect
→ expected false to be true   [classificationResult.eligibleForProgression]
```

### Root cause

Same as B2. After 1 playful turn, the session memory has 1 FAILURE in history (PLAYFUL\_NONSENSE is not in FAILURE\_LABELS, but... actually the playful label is PLAYFUL\_NONSENSE which IS in FAILURE\_LABELS in turn-history-updater). So when the next "correct" answer arrives, the timeout fallback classifies it as RANDOM\_NONSENSE or WRONG\_SEMANTIC with `eligibleForProgression = false`.

Fixing B2 (adding `vocabularyContext` to the classification input) will restore deterministic exact-match classification for the subsequent correct turn, giving `eligibleForProgression = true`.

### Classification

Derived from B2. Will be resolved when B2 is patched.

---

## P1 — Praise rotation passes by coincidence (Fragile)

### Status

The test `"praise is not identical across 4 consecutive correct turns"` is currently **passing**, but for the wrong reason.

### Why it passes now

Because of B2, the 4 correct turns are classified as RANDOM\_NONSENSE (×2) then WRONG\_SEMANTIC (×2), not as CORRECT\_CONFIDENT. The teacher response engine produces:

- Turns 1–2 (RANDOM\_NONSENSE → `fallback_safe`): `"Let's try again!"`
- Turns 3–4 (WRONG\_SEMANTIC → `recovery_script` → `wrong_semantic`): a scaffold response from `buildRecoveryResponse`

The text variety arises from the label switch, not from praise rotation. `Set(texts).size = 2 > 1` → test passes.

### Underlying defect

`session-memory-updater.ts` never updates `recentPraisePhrases`. The spread `...original` preserves the initialized empty array:

```ts
return {
  ...original,
  // recentPraisePhrases not updated ← MISSING
  childState: childStateWithCounts,
  ...
};
```

The deduplication filter in `teacher-response-engine.ts:147`:

```ts
const praiseVariants = PRAISE_VARIANTS.filter(v => !recentPhrases.includes(v));
```

always sees `recentPhrases = []` → always returns all 18 variants → always picks randomly. The repeat-cooldown mechanism (spec §10.8, `PRAISE_REPEAT_COOLDOWN_TURNS = 3`) is inoperative.

### Why it will break again after B2 is fixed

When B2 is patched, all 4 turns will correctly classify as CORRECT\_CONFIDENT. All 4 will hit the praise branch. With 18 variants and pure random, the probability of identical text across 4 turns = (1/18)^3 ≈ 0.017% — essentially never fails. But the deduplication spec §10.8 requires is still broken.

### Severity

LOW. Will not fail tests. May cause occasional praise repetition in real sessions.

### Fix

In `buildUpdatedSessionMemory`, after computing the teacher response, update `recentPraisePhrases` with the phrase used in that turn. This requires passing the praise phrase used through the state update pipeline, or handling it in a post-processing step. The teacher response engine is the natural owner.

---

## Recommended Phase 8.6 Patch Plan

### Patch order

Fix in priority order. B2 is the gating fix — it will also resolve B5 and let P1 become observable.

**Patch 8.6.1 — B2 (CRITICAL): Restore classification vocabulary context**

File: `backend/src/kids-brain/runtime/turn-processor.ts`

Add `vocabularyContext` to `classificationInput` (7 lines). This alone fixes B2 and B5 and makes P1 testable.

**Patch 8.6.2 — B4 (MEDIUM): Add I\_DONT\_KNOW to failure sets**

Files:
- `backend/src/kids-brain/state-engine/recovery-state-updater.ts`
- `backend/src/kids-brain/state-engine/turn-history-updater.ts`

Add one label to each set (2 lines total).

**Patch 8.6.3 — B1 (LOW): Shorten greeting**

File: `backend/src/kids-brain/runtime/session-bootstrap.ts`

Change `GREETING_TEXT` to a ≤12 word string (1 line).

**Patch 8.6.4 — B3 (Test design): Fix silence test duration**

File: `backend/src/kids-brain/runtime/__tests__/kids-brain-simulation.qa.test.ts`

Change 2000ms to 4000ms for the `isSilence=true` assertion (1 line), OR remove the `isSilence` assertion and keep only the behavior guards (no pressure language, session safe).

**Patch 8.6.5 — P1 (LOW): Wire recentPraisePhrases update**

This is a post-B2 cleanup. After B2 is fixed, run the praise rotation test to confirm it still passes. If it does (likely, given 18 variants), defer this to Phase 9. If not, wire the phrase update through the state update pipeline.

### Estimated scope

| Patch  | Files | Lines changed | Risk |
|--------|-------|---------------|------|
| 8.6.1  | 1     | ~7            | LOW  |
| 8.6.2  | 2     | ~2            | LOW  |
| 8.6.3  | 1     | ~1            | LOW  |
| 8.6.4  | 1     | ~1            | LOW  |
| 8.6.5  | 2–3   | ~15           | LOW  |

All patches are local, deterministic, and have no LLM, Redis, or Postgres dependencies.

### Expected result after 8.6.1–8.6.4

```
Tests: 57 passed, 0 failed
```

---

## Appendix — Adjusted STT Confidence Formula

For reference: a 1-word English answer with 0.88 raw STT confidence from a 6-7 year old:

```
adjustedSttConfidence = 0.88 × STT_RESPONSE_LENGTH_1_WORD(0.85) × STT_CHILD_SPEECH_PRIOR_6_7(0.85)
                      = 0.88 × 0.85 × 0.85
                      = 0.636
```

This value is below the `>= 0.65` threshold in timeout fallback rules 5 and 6, which is why the default RANDOM\_NONSENSE branch fires for single-word correct answers when B2 is present.

When B2 is fixed, the deterministic classifier handles single-word correct answers through Rule 13 (exact match) before the timeout fallback is ever reached.
