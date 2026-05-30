# Phase 10A — Curriculum Schema Report

**Date:** 2026-05-30
**Status:** COMPLETE
**TypeScript errors:** 0
**Kids-brain tests:** 378 / 378 passing (363 pre-existing + 15 new)
**Code modified:** NONE (schema only — no runtime, no lesson-ws, no frontend)

---

## Files Created

```
backend/src/kids-brain/curriculum/
├── curriculum-types.ts          — 13 TypeScript interfaces/enums
├── curriculum-schema.ts         — APPROVED_TEMPLATE_VARIABLES + ACTIVITY_UI_SAFETY_RULES
├── curriculum-validators.ts     — 7 pure validator functions
├── index.ts                     — public re-exports
└── __tests__/
    └── curriculum-schema.test.ts — 15 tests
```

---

## Schema Overview

### Types defined (curriculum-types.ts)

| Type | Kind | Purpose |
|---|---|---|
| `KidsCurriculumCourse` | interface | Top-level course container |
| `KidsCurriculumUnit` | interface | Unit grouping lessons by theme |
| `KidsCurriculumLesson` | interface | Lesson plan with phases, items, activities |
| `KidsCurriculumPhase` | interface | One lesson phase (maps to LessonPhase enum) |
| `KidsCurriculumItem` | interface | A single teachable item (word, sentence frame, chant line) |
| `KidsVocabularyItem` | interface | Specialisation of item for vocabulary nouns/verbs |
| `KidsActivityDefinition` | interface | An activity that can run on items |
| `KidsVisualAssetRef` | interface | Visual asset pointer with availability flag |
| `KidsAudioAssetRef` | interface | Audio asset pointer with availability flag |
| `KidsTeacherPromptTemplate` | interface | Scripted teacher utterance with placeholder variables |
| `KidsAcceptedAnswer` | interface | STT accepted form definition |
| `KidsDistractor` | interface | Forced-choice distractor item |
| `KidsReviewLink` | interface | Cross-reference to prior-unit review item |
| `KidsCurriculumActivityType` | enum | 8 curriculum-facing activity types |
| `KidsCurriculumItemType` | enum | vocabulary / sentence_frame / chant_line |
| `KidsFallbackPolicy` | enum | use_audio_safe_fallback / skip_activity / lower_difficulty |

### Key design decisions

- `KidsCurriculumActivityType` is separate from the runtime `ActivityType` enum — the authoring
  layer is stable and maps to runtime types in Phase 10D. Changes to the runtime enum do not
  break curriculum files.
- `KidsVocabularyItem extends KidsCurriculumItem` — narrows `type` to `KidsCurriculumItemType.VOCABULARY`.
- All types import only from `../shared/enums.js` (AgeBand, LessonPhase) — no adult-module imports.

---

## Schema Constants (curriculum-schema.ts)

### APPROVED_TEMPLATE_VARIABLES

Five placeholder variables allowed at authoring time:

```
{target}      — the target word/phrase for this item
{choiceA}     — first option in forced-choice activity
{choiceB}     — second option in forced-choice activity
{childName}   — child's first name
{characterName} — story character name
```

Any other `{token}` in a template is a schema violation caught by `validateNoPlaceholderLeaks`.

Even approved variables must be fully resolved before delivery — `validateFinalOutputNoPlaceholders`
catches any remaining `{...}` in final teacher text.

### ACTIVITY_UI_SAFETY_RULES

| Activity | requiresVisualUI | allowedWithoutVisualUI | Restriction |
|---|---|---|---|
| listen_and_repeat | false | true | — |
| forced_choice_audio | false | true | — |
| forced_choice_visual | true | false | Blocked (no child UI) |
| listen_and_point | true | false | Blocked (no child UI) |
| find_the_object | true | false | Blocked (no child UI) |
| chant | false | true | — |
| open_answer | false | true | Age band 8-9 only |
| review_production | false | true | — |

---

## Validator Overview (curriculum-validators.ts)

| Function | What it checks |
|---|---|
| `validateKidsCurriculumCourse(course)` | All required course fields present and typed |
| `validateKidsCurriculumLesson(lesson)` | Required lesson fields; non-empty phases; all items have normalizedAnswer |
| `validateKidsCurriculumActivity(activity)` | Required activity fields; type is valid KidsCurriculumActivityType |
| `validateNoPlaceholderLeaks(template)` | All `{...}` in template text are approved variables |
| `validateFinalOutputNoPlaceholders(text)` | No `{...}` remaining in rendered teacher output |
| `validateActivityUISafety(activity)` | Activity's requiresVisualUI/allowedWithoutVisualUI match schema rule |
| `validateLessonHasNoVisualRequiredActivityWithoutVisualSupport(lesson, visualSupport)` | Blocks visual activities when UI has no visual support |

---

## Tests Added

`backend/src/kids-brain/curriculum/__tests__/curriculum-schema.test.ts` — 15 tests:

1. valid minimal course passes
2. valid minimal lesson passes
3. missing courseId fails
4. missing lesson phases fails
5. item without normalizedAnswer fails
6. visual activity requires visual UI (FORCED_CHOICE_VISUAL rule check)
7. listen_and_repeat allowed without visual UI (schema rule check)
8. forced_choice_visual rejected without visual support (lesson validator)
9. prompt with approved placeholders passes
10. prompt with unknown placeholder fails
11. final-output placeholder guard rejects {target}
12. lesson with visual-required activity fails when visualSupport=false
13. lesson with only visual-safe activities passes when visualSupport=false
14. no adult module imports in curriculum files (fs read + import path check)
15. public exports available from index.ts (dynamic import check)

---

## Commands Run

```
cd backend
npx tsc --noEmit
# → 0 errors

npx vitest run src/kids-brain
# → 378 / 378 passing (363 pre-existing + 15 new)
```

---

## Test Results

```
✓ src/kids-brain/curriculum/__tests__/curriculum-schema.test.ts (15 tests) 28ms
✓ All 13 pre-existing test files pass
Tests: 378 passed (378)
```

---

## Remaining Risks

| Risk | Severity | Phase |
|---|---|---|
| R22 gap: item advancement leaves `nextTargetItemId: undefined` | HIGH | 10D |
| 3 visual prompts in `kids-runtime/recovery-manager.ts` (EASIEST_WIN_SCRIPTS) | HIGH | 10F |
| No lesson phase connection to 10-phase lesson-format-spec | MEDIUM | 10D |
| `KidsCurriculumActivityType` ↔ runtime `ActivityType` mapping not yet defined | LOW | 10D |
| `KidsVocabularyItem.distractors` field has no loader to populate it yet | LOW | 10C |

---

## Next Recommended Phase

**Phase 10B — Static Prototype Lesson File**

Goal: create one complete `KidsCurriculumLesson` using the 6 animals from
`backend/src/kids-runtime/animals-curriculum.ts`, migrated into the new schema.

Deliverables:
- `backend/src/kids-brain/curriculum/prototype-lesson.ts`
  - 1 course, 1 unit, 1 lesson (KB-U1-L1)
  - 6 `KidsVocabularyItem` objects (cat, dog, elephant, tiger, monkey, lion)
  - distractor pairs for `forced_choice_audio`
  - all 5 lesson phases with audio-safe activities only
  - story hook text (original, ≤ 5 sentences)
  - 6 chant lines (one per item)
  - open loop hint (1 sentence)
- `backend/src/kids-brain/curriculum/curriculum-loader.ts`
  - `loadLesson(lessonId)` → KidsCurriculumLesson | throws LESSON_NOT_FOUND
  - `loadItem(itemId)` → KidsCurriculumItem | throws ITEM_NOT_FOUND
- Tests: loader returns correct items; all items have complete schemas

Do NOT integrate into runtime in 10B. Do NOT modify lesson-ws.ts.

10B can be done safely in parallel with any other work.
