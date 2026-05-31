# Phase 13F — Exercise Advance Teacher Prompt Fix — Report

**Date:** 2026-05-31
**Status:** COMPLETE

---

## Commands run

```
cd backend && npx tsc --noEmit          → 0 errors
cd backend && npx vitest run src/kids-brain → 686/686 passing (22 new)
```

---

## Files modified

| File | Change |
|---|---|
| `backend/src/kids-brain/runtime/turn-processor.ts` | Added `buildExercisePrompt` to import; added Step 6B intercept (~22 lines) |
| `backend/src/kids-brain/runtime/__tests__/phase-13f-exercise-advance-teacher-prompt-fix.test.ts` | New — 22 tests across 8 describe groups (P–X) |

---

## Exact Step 6B behavior

Added in `processKidsBrainTurn()` immediately after `runExerciseBridge()` (before Step 7):

```typescript
const prevExerciseId = memAfterLearning.currentExerciseId ?? null;
const nextExerciseId = updatedSessionMemory.currentExerciseId ?? null;

if (prevExerciseId !== nextExerciseId) {
  const lesson = memAfterLearning.lessonId ? findLessonById(memAfterLearning.lessonId) : null;

  if (nextExerciseId !== null) {
    // Advanced to next exercise — use its authored prompt.
    const nextExercise = lesson?.exercises?.find(e => e.exerciseId === nextExerciseId) ?? null;
    if (nextExercise) {
      teacherOutput.plan = { ...teacherOutput.plan, mainText: buildExercisePrompt(nextExercise) };
    }
  } else if (prevExerciseId !== null) {
    // Lesson exhausted — use the just-completed exercise's closing prompt.
    const closingExercise = lesson?.exercises?.find(e => e.exerciseId === prevExerciseId) ?? null;
    const closingPrompt = closingExercise
      ? buildExercisePrompt(closingExercise)
      : "Great job today! We're all done!";
    teacherOutput.plan = { ...teacherOutput.plan, mainText: closingPrompt };
  }
}
```

---

## Prompt override rules

| Condition | Override? | Teacher text source |
|---|---|---|
| Exercise advances to next (e.g. blue → green) | YES | `buildExercisePrompt(nextExercise)` |
| Lesson exhausted (e.g. close → null) | YES | `buildExercisePrompt(closingExercise)` |
| No exercise change (wrong answer, mid-exercise correct) | NO | Existing teacher response engine template |
| No exercise state (old sessions, no-exercise lessons) | NO | Existing teacher response engine template |
| Readiness path (`buildReadinessTurnResult`) | NOT IN PATH | Scripted "Listen — {word}! Now you!" |

`buildExercisePrompt(exercise)` returns `exercise.prompt.ttsText ?? exercise.prompt.text`.

---

## Actual prompt values (KB1 Lesson 2)

| Exercise | `buildExercisePrompt()` output |
|---|---|
| `kb1-u01-l02-ex-02-blue` | `Listen — blue! Now you say it!` |
| `kb1-u01-l02-ex-03-green` | `Listen — green! Now you say it!` |
| `kb1-u01-l02-ex-04-red` | `Listen — red! Now you say it!` |
| `kb1-u01-l02-ex-10-close` | `Well done! We finished colours today. Great job!` |

---

## Proof stale prompt fixed

**Before Phase 13F (the bug):**

| Turn | Child says | Exercise | Step 5 teacher text (pre-bridge) | Step 6 bridge result | Delivered text |
|---|---|---|---|---|---|
| Turn 1 | "blue" | blue (1/2) | hesitant_correct("blue") | No advance | "I heard you! blue! Say it one more time!" |
| Turn 2 | "blue" | blue (2/2) | hesitant_correct("blue") → **STALE** | Advances to green | "Ooh! blue! You know this! Say it again!" ← WRONG |
| Turn 3 | "blue" (repeat) | green | wrong_but_safe("green") | No advance | "Good thinking! Listen — green!" ← WRONG |

**After Phase 13F (the fix):**

| Turn | Child says | Exercise | Step 5 teacher text | Step 6B intercept | Delivered text |
|---|---|---|---|---|---|
| Turn 1 | "blue" | blue (1/2) | hesitant_correct("blue") | No advance → no override | "I heard you! blue! Say it one more time!" |
| Turn 2 | "blue" | blue (2/2) | hesitant_correct("blue") | Advances to green → OVERRIDE | **"Listen — green! Now you say it!"** ← CORRECT |
| Turn 3 | "green" | green (1/2) | correct template for "green" | No advance → no override | "Well done! green!" |

---

## Tests added (22 tests in 8 groups)

| Group | Tests | What they prove |
|---|---|---|
| P — blue completion turn | 3 | teacher text = `PROMPT_GREEN`; plan.mainText = `PROMPT_GREEN`; session advances to ex-03 |
| Q — stale blue not emitted | 2 | no "Say it again" / "one more time" on completion turn; text differs from mid-exercise template |
| R — no override on non-advance | 3 | wrong answer → teacher text ≠ `PROMPT_GREEN`; exercise stays on ex-02 |
| S — close exercise | 2 | lesson exhausted → teacher text = `PROMPT_CLOSE`; plan.mainText = `PROMPT_CLOSE` |
| T — classification unchanged | 3 | label is a correct label; learningDecision defined; safeToContinue=true |
| U — readiness handshake unchanged | 3 | teacher text = "Listen — blue! Now you!"; ex-01→ex-02 still works; not green/blue prompt |
| V — green → red advance | 2 | green completion → teacher text = `PROMPT_RED`; text does not contain "green" |
| W — WS protocol unchanged | 3 | PacketType values intact; only known types in packets; sequence order correct |
| X — intermediate correct no override | 1 | 1st correct blue: exercise stays ex-02; teacher text ≠ `PROMPT_GREEN` |

---

## Test results

```
src/kids-brain/runtime/__tests__/phase-13f-exercise-advance-teacher-prompt-fix.test.ts  22/22 ✓
src/kids-brain/runtime/__tests__/phase-13d-exercise-runtime-bridge.test.ts              29/29 ✓
All other kids-brain tests                                                               635/635 ✓

Total: 686/686 passing
```

---

## Remaining risks

| Risk | Severity | Status |
|---|---|---|
| `fastTrackText` dead field in action packets (audit 13E finding) | LOW | Out of scope — no runtime impact |
| Transcript logging `item=-` (Kids Brain v1 Redis key mismatch) | LOW | Out of scope — logging only |
| Step 6B in readiness path (`buildReadinessTurnResult`) not added | NONE | Intentional — readiness scripted path must stay as authored |
| `lessonId` absent on old sessions | NONE | Guard `memAfterLearning.lessonId ? ... : null` handles it |

---

## Next recommended phase

**Phase 13G — Exercise-Aware Teacher Response Engine**

Current state: Step 6B intercepts after the teacher response engine, overriding `plan.mainText`. This is a post-hoc patch. Longer term, the teacher response engine should receive the post-bridge exercise context as an input so it can select the correct template path before rendering. This is optional for correctness (Step 6B is sufficient) but would improve:
- Template selection accuracy (correct FeedbackTone for exercise transition vs. hesitant-correct)
- `teacherActionCode` accuracy (MODEL_ANSWER instead of hesitant_correct code on transition turn)
- Observability (plan.responseMode would reflect 'scripted' instead of 'template' on transition)

Alternatively, **Phase 13H — Kids Brain QA Integration** could validate the full multi-turn lesson flow end-to-end with the fixed teacher text, ensuring the child experience is correct across the full 10-exercise sequence.
