# Phase 10C — Curriculum Loader Report

## Files Created

- `backend/src/kids-brain/curriculum/curriculum-loader.ts`
- `backend/src/kids-brain/curriculum/__tests__/curriculum-loader.test.ts`

## Files Modified

- `backend/src/kids-brain/curriculum/index.ts` — added 14 loader function exports + `CurriculaValidationResult` type export

## Loader API Overview

Static in-memory registry holds `PROTO_ANIMALS_COURSE` (frozen array, no external input).

| Function | Returns |
|---|---|
| `listCourses()` | `readonly KidsCurriculumCourse[]` — shallow copy |
| `loadCourse(courseId)` | `KidsCurriculumCourse \| null` |
| `loadUnit(courseId, unitId)` | `KidsCurriculumUnit \| null` |
| `loadLesson(courseId, unitId, lessonId)` | `KidsCurriculumLesson \| null` |
| `loadItem(courseId, unitId, lessonId, itemId)` | `KidsCurriculumItem \| null` |
| `listLessonItems(...)` | `readonly KidsCurriculumItem[]` — copy |
| `listLessonActivities(...)` | `readonly KidsActivityDefinition[]` — copy |
| `getActivityById(..., activityId)` | `KidsActivityDefinition \| null` |
| `getVocabularyWords(...)` | `readonly string[]` — targetText of VOCABULARY items |
| `getVocabularyItems(...)` | `readonly KidsVocabularyItem[]` — type-narrowed |
| `getDistractors(..., targetItemId, count)` | `readonly KidsCurriculumItem[]` — deterministic, lesson order |
| `getVisualSafeActivities(...)` | Activities where `allowedWithoutVisualUI=true && requiresVisualUI=false` |
| `getLessonForPrototype()` | `KidsCurriculumLesson` — direct shortcut |
| `validateRegisteredCurricula()` | `CurriculaValidationResult { ok, errors }` |

## Validation Behavior

`validateRegisteredCurricula()` runs against every registered course/lesson:
- `validateKidsCurriculumCourse()` per course
- `validateKidsCurriculumLesson()` per lesson
- `validateLessonHasNoVisualRequiredActivityWithoutVisualSupport(lesson, false)` per lesson

Returns `{ ok: true, errors: [] }` for PROTO_ANIMALS_COURSE. Does not throw or block startup.

## Tests Added

25 tests in `curriculum-loader.test.ts` covering all 22 spec requirements plus 3 bonus edge cases:

1. listCourses returns prototype course
2. loadCourse returns prototype course by ID
3. loadCourse returns null for missing course
4. loadUnit returns animals unit
5. loadLesson returns animals lesson
6. loadItem returns cat item
7. loadItem returns null for missing item
8. listLessonItems returns 6 items
9. getVocabularyWords returns animals in lesson order (cat/dog/lion/monkey/elephant/tiger)
10. getVocabularyItems returns 6 vocabulary items
11. listLessonActivities returns 4 activities
12. getActivityById returns listen_and_repeat activity
13. getDistractors(cat, 2) returns dog then lion
14. getDistractors never includes the target item
15. getDistractors with count=0 returns []
16. getDistractors with negative count throws
17. getDistractors with missing targetItemId returns []
18. getVisualSafeActivities returns only allowedWithoutVisualUI=true / requiresVisualUI=false
19. validateRegisteredCurricula returns ok=true with no errors
20. mutating a returned array does not affect the registry
21. all loader functions exported from curriculum/index.ts
22. curriculum-loader.ts has no adult runtime imports
+ getLessonForPrototype returns the prototype animals lesson
+ loadUnit returns null for missing course
+ listLessonItems returns [] for unknown lesson

## Commands Run

```
npx tsc --noEmit        → 0 errors
npx vitest run src/kids-brain → 422/422 passed (15 test files)
```

## Test Results

```
✓ curriculum-loader.test.ts  (25 tests)
Total: 422 passed, 0 failed
```

## Remaining Risks

- Registry is static; adding new courses requires a code change to `REGISTERED_COURSES`. Acceptable for prototype phase.
- `getDistractors` returns items from the same lesson only (all 5 remaining items in order). Multi-lesson distractor pools are not yet supported.
- `validateRegisteredCurricula` errors are logged but do not block startup — consumer code must call and check explicitly.

## Next Recommended Phase

**Phase 10D — Curriculum Runtime Adapter**

Wire `curriculum-loader.ts` into the Kids Brain runtime so that `KIDS_PROTOTYPE_TARGET_WORDS` is sourced from `getVocabularyWords()` instead of the hardcoded constant. This is the first integration step and should be the only runtime file modified.
