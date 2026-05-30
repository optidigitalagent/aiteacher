# Phase 10B — Static Prototype Animals Lesson Report

**Date:** 2026-05-30
**Status:** COMPLETE
**TypeScript errors:** 0
**Kids-brain tests:** 397 / 397 passing (19 new tests added)
**Code modified:** 2 files touched (1 created, 1 updated), 1 test file created

---

## Files Created

| File | Purpose |
|---|---|
| `backend/src/kids-brain/curriculum/prototype-animals-lesson.ts` | Static prototype lesson: 6 items, 4 activities, 5 phases, 4 review links |
| `backend/src/kids-brain/curriculum/__tests__/prototype-animals-lesson.test.ts` | 19 tests covering all 16 Phase 10B requirements + 3 bonus structural checks |

## Files Modified

| File | Change |
|---|---|
| `backend/src/kids-brain/curriculum/index.ts` | Added public exports for `PROTO_ANIMALS_LESSON`, `PROTO_ANIMALS_UNIT`, `PROTO_ANIMALS_COURSE` |

---

## Content Overview

### Course

```
courseId:  mentium-kids-prototype-animals
version:   1.0.0
title:     Mentium Kids Prototype Animals
source:    mentium-authored-prototype
cefrLevel: pre-A1
ageBands:  6-7, 8-9
```

### Unit

```
unitId: animals-zoo-001
title:  At the Zoo
theme:  animals
```

### Lesson

```
lessonId:         animals-zoo-lesson-001
title:            Zoo Animals Starter
estimatedMinutes: 12
ageBands:         6-7, 8-9
```

**Learning objectives:**
1. Recognize 6 animal words: cat, dog, lion, monkey, elephant, tiger
2. Say 6 animal words clearly
3. Answer simple forced-choice animal questions
4. Recover from mistakes without shame

### Vocabulary Items (6)

| itemId | targetText | difficulty | ru | uk | gesture |
|---|---|---|---|---|---|
| PROTO-ANIM-001 | cat | 1 | кот | кіт | mime_stroking_cat |
| PROTO-ANIM-002 | dog | 1 | собака | собака | mime_petting_dog |
| PROTO-ANIM-003 | lion | 2 | лев | лев | mime_lion_shake_mane |
| PROTO-ANIM-004 | monkey | 2 | обезьяна | мавпа | mime_monkey_swing |
| PROTO-ANIM-005 | elephant | 3 | слон | слон | mime_elephant_trunk |
| PROTO-ANIM-006 | tiger | 2 | тигр | тигр | mime_tiger_claws |

Each item has:
- Visual asset ref (placeholder, `available: false`)
- Audio asset ref (TTS, `available: true`)
- Accepted answers (exact + partial, phonetic where applicable)
- Distractor pairs for forced_choice_audio
- First phoneme scaffold
- Semantic cluster links

### Lesson Phases (5)

| order | phaseId | type | estimatedSeconds | allowedActivities |
|---|---|---|---|---|
| 1 | animals-zoo-lesson-001-warm-up | warm_up | 60 | listen_and_repeat |
| 2 | animals-zoo-lesson-001-introduction | introduction | 180 | listen_and_repeat, chant |
| 3 | animals-zoo-lesson-001-practice | practice | 240 | listen_and_repeat, forced_choice_audio |
| 4 | animals-zoo-lesson-001-consolidation | consolidation | 120 | forced_choice_audio, review_production |
| 5 | animals-zoo-lesson-001-close | close | 60 | review_production |

### Activities (4, all visual-safe)

| activityId | type | requiresVisualUI | allowedWithoutVisualUI |
|---|---|---|---|
| proto-anim-listen-repeat | listen_and_repeat | false | true |
| proto-anim-forced-choice-audio | forced_choice_audio | false | true |
| proto-anim-chant | chant | false | true |
| proto-anim-review-production | review_production | false | true |

Prompt templates use only approved placeholders: `{target}`, `{choiceA}`, `{choiceB}`.

### Review Links (4)

- PROTO-ANIM-002 (dog) reviewed alongside cat — `semantic_cluster`
- PROTO-ANIM-003 (lion) reviewed alongside cat — `semantic_cluster`
- PROTO-ANIM-001 (cat) reviewed alongside dog — `semantic_cluster`
- PROTO-ANIM-004 (monkey) reviewed alongside dog — `semantic_cluster`

---

## Validation Results

All three required validators pass:

| Validator | Result |
|---|---|
| `validateKidsCurriculumCourse(PROTO_ANIMALS_COURSE)` | ✓ valid |
| `validateKidsCurriculumLesson(PROTO_ANIMALS_LESSON)` | ✓ valid |
| `validateLessonHasNoVisualRequiredActivityWithoutVisualSupport(lesson, false)` | ✓ valid |

---

## Tests Added

19 tests in `__tests__/prototype-animals-lesson.test.ts`:

| # | Test |
|---|---|
| 1 | prototype course validates |
| 2 | prototype lesson validates |
| 3 | lesson has exactly 6 vocabulary items |
| 4 | all expected animal words exist |
| 5 | all items have Russian and Ukrainian translations |
| 6 | all items have visual asset refs |
| 7 | all items have audio asset refs |
| 8 | all activities are visual-safe (allowedWithoutVisualUI=true) |
| 9 | no listen_and_point activity exists |
| 10 | no forced_choice_visual activity exists |
| 11 | no find_the_object activity exists |
| 12 | all prompt templates pass approved placeholder validation |
| 13 | no final-output placeholder leaks in rendered sample prompts |
| 14 | review links exist |
| 15 | public export exists from curriculum/index.ts |
| 16 | no adult runtime imports in prototype-animals-lesson.ts |
| + | course/unit/lesson hierarchy consistency check |
| + | lesson passes visual-safe check with visualSupport=false |
| + | no forbidden activity types in any phase allowedActivities |

---

## Commands Run

```bash
cd backend
npx tsc --noEmit
npx vitest run src/kids-brain
```

## Test Results

```
Test Files  14 passed (14)
     Tests  397 passed (397)
  Duration  4.22s
```

Previous baseline: 363 tests. New: 397 tests (+34 from 19 new proto-animals tests plus previously uncounted tests).

---

## Remaining Risks

| Risk | Severity | Notes |
|---|---|---|
| Visual asset refs are all placeholders (`available: false`) | LOW | Correct by design — no real images exist yet |
| estimatedMinutes is a fixed `12` (schema requires `number`) | LOW | Spec said "10-15" range but type is scalar; 12 is a reasonable midpoint |
| Review links self-reference the same lesson | LOW | Prototype has no prior lessons; structure is valid, semantics are simplified |
| R22 item advancement gap | MEDIUM | Known blocker for Phase 10D; learning engine does not yet advance items sequentially |
| Visual prompts in recovery-manager.ts | MEDIUM | 3 EASIEST_WIN_SCRIPTS still require pointing UI (Phase 10F fix) |
| No runtime loader yet | MEDIUM | Phase 10C will build `CurriculumLoader.loadLesson()` and `loadItem()` |

---

## Next Recommended Phase

**Phase 10C — Curriculum Loader**

Build `backend/src/kids-brain/curriculum/curriculum-loader.ts` with:

- `loadLesson(lessonId: string): KidsCurriculumLesson` — throws `LESSON_NOT_FOUND` for unknown IDs
- `loadItems(itemIds: string[]): KidsVocabularyItem[]` — returns all or throws `ITEM_NOT_FOUND`
- `getDistractors(itemId: string, n: number): KidsDistractor[]` — returns n distractors
- Static registry: `Map<string, KidsCurriculumLesson>` seeded from `PROTO_ANIMALS_LESSON`
- Tests: all error paths covered; bad lessonId throws correctly; 0 TS errors

Phase 10C is the last pure-schema phase. After it, Phase 10D wires the loader into
`lesson-ws.ts` and the Kids Brain session pipeline (first production path change).
