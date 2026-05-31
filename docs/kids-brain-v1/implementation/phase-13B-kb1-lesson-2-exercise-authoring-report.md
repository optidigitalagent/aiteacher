# Phase 13B — KB1 Lesson 2 Exercise Authoring Report

## Files Modified

| File | Change |
|---|---|
| `backend/src/kids-brain/curriculum/kids-box/kids-box-unit-01.ts` | Added 4 enum imports, 1 type import, `LESSON_2_EXERCISES` constant (10 exercises), wired into `KB1_U01_L02_COLOURS` |
| `backend/src/kids-brain/curriculum/__tests__/kids-box-unit-01.test.ts` | Added `validateLessonExercises` import, `KidsTextbookActivityType` + `KidsCompletionRuleType` imports, new describe block (tests 40–59, 20 tests) |

## Exercises Authored

10 exercises for lesson `kb1-u01-l02` (Colours):

| # | exerciseId | Type | Action | Target items |
|---|---|---|---|---|
| 1 | `kb1-u01-l02-ex-01-readiness` | REVIEW | LISTEN_ONLY | — |
| 2 | `kb1-u01-l02-ex-02-blue` | LISTEN_AND_REPEAT | REPEAT_WORD | COL-001 (blue) |
| 3 | `kb1-u01-l02-ex-03-green` | LISTEN_AND_REPEAT | REPEAT_WORD | COL-002 (green) |
| 4 | `kb1-u01-l02-ex-04-red` | LISTEN_AND_REPEAT | REPEAT_WORD | COL-006 (red) |
| 5 | `kb1-u01-l02-ex-05-yellow` | LISTEN_AND_REPEAT | REPEAT_WORD | COL-007 (yellow) |
| 6 | `kb1-u01-l02-ex-06-choose-pair-1` | LISTEN_AND_CHOOSE | SAY_CHOICE | COL-001, COL-002 |
| 7 | `kb1-u01-l02-ex-07-choose-pair-2` | LISTEN_AND_CHOOSE | SAY_CHOICE | COL-003, COL-004 |
| 8 | `kb1-u01-l02-ex-08-say-review` | REVIEW | FREE_PRODUCTION | All 7 colours |
| 9 | `kb1-u01-l02-ex-09-chant` | CHANT | JOIN_CHANT | All 7 colours |
| 10 | `kb1-u01-l02-ex-10-close` | REVIEW | LISTEN_ONLY | — |

## Exercise Sequence

```
readiness → blue_repeat → green_repeat → red_repeat → yellow_repeat
  → blue_vs_green_choice → pink_vs_purple_choice → all_colours_review
  → colours_chant → close (null)
```

## Validation Results

- All exercise IDs unique ✓
- Orders 1–10 sequential, no gaps ✓
- nextExerciseId chain valid, final is null ✓
- All targetItemIds reference real lesson items ✓
- No exercise requires visual UI ✓
- No illegal placeholders in teacher instructions ✓
- No raw copyrighted long text ✓
- `validateLessonExercises(KB1_U01_L02_COLOURS)` → `{ valid: true, errors: [] }` ✓

## Tests Added

20 new tests (numbers 40–59) in `kids-box-unit-01.test.ts`:

- 40: lesson 2 has exercises defined
- 41: exercise count between 8 and 12
- 42: ordered sequentially from 1
- 43: first exercise is readiness
- 44: final exercise has nextExerciseId null
- 45: nextExerciseId chain valid
- 46: all exercises pass validateLessonExercises()
- 47: all audio-safe (allowedWithoutVisualUI = true)
- 48: no exercise requires visual UI
- 49: all targetItemIds reference real lesson items
- 50: listen-and-repeat uses correct_repetitions / requiredCorrectCount 2
- 51: listen-and-choose uses correct_choice / requiredCorrectCount 1
- 52: valid retry policies with escalation ladders
- 53: no instruction > 200 chars
- 54: no unapproved placeholders in instructions
- 55: all exercise IDs unique
- 56: repeat_word exercises have non-empty expectedAnswers
- 57: say_choice exercises have non-empty choices and expectedAnswers
- 58: no choice contains isCorrect field
- 59: public lesson 2 export still intact

## Commands Run

```
cd backend
npx tsc --noEmit          # 0 errors
npx vitest run src/kids-brain
```

## Test Results

```
Test Files  22 passed (22)
     Tests  614 passed (614)   (+20 from Phase 13A baseline of 594)
  Duration  5.78s
```

## Remaining Risks

- Pink, purple, and orange have no dedicated listen-and-repeat — introduced via choice and review. Acceptable for lesson 1 on colours; a follow-up lesson (13C) could add targeted repetition.
- `expectedAnswers` for choose exercises is a single fixed value ('blue', 'pink'). The runtime must accept the other valid choice as correct too if context demands it — curriculum validators don't enforce this yet.
- Audio assets are all `available: false` (TTS-generated at runtime). No blocking risk.

## Next Recommended Phase

**Phase 13C — KB1 Lesson 3 Exercise Authoring (Numbers 1–10)**

Same pattern as 13B, applied to `kb1-u01-l03`. Alternatively:

**Phase 13D — Exercise Runtime Bridge**

Wire `lesson.exercises` into the Kids Brain runtime so the exercise sequence is driven by the authored data rather than the legacy activity loop. Prerequisite for any curriculum-driven exercise testing.
