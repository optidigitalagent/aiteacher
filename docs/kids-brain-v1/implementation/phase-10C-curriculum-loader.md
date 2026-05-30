# Phase 10C — Curriculum Loader

Goal:

Create a static curriculum loader/registry for Mentium Kids Brain v1.

This phase creates read-only curriculum access helpers only.

Do NOT integrate curriculum into runtime.
Do NOT replace KIDS_PROTOTYPE_TARGET_WORDS yet.
Do NOT modify lesson-ws.ts.
Do NOT modify frontend.
Do NOT modify adult runtime.
Do NOT deploy.

Context:

Phase 10A created the curriculum schema.

Phase 10B created:

backend/src/kids-brain/curriculum/prototype-animals-lesson.ts

with:

- PROTO_ANIMALS_COURSE
- PROTO_ANIMALS_UNIT
- PROTO_ANIMALS_LESSON

Now we need a loader so future runtime code can ask for courses, units, lessons, items, activities, and distractors without importing prototype content directly.

Source of Truth:

Read:

- docs/kids-brain-v1/implementation/phase-10A-curriculum-schema-report.md
- docs/kids-brain-v1/implementation/phase-10B-static-prototype-animals-lesson-report.md
- backend/src/kids-brain/curriculum/
- backend/src/kids-brain/curriculum/prototype-animals-lesson.ts

Create:

backend/src/kids-brain/curriculum/curriculum-loader.ts

Update:

backend/src/kids-brain/curriculum/index.ts

Add tests:

backend/src/kids-brain/curriculum/__tests__/curriculum-loader.test.ts

Loader Requirements:

Implement a static in-memory registry.

No database.
No filesystem scan.
No async.
No external API.
No frontend input.
No user-provided curriculum.

Registry must include only:

- PROTO_ANIMALS_COURSE

Public API:

Implement pure functions:

1. listCourses()
2. loadCourse(courseId)
3. loadUnit(courseId, unitId)
4. loadLesson(courseId, unitId, lessonId)
5. loadItem(courseId, unitId, lessonId, itemId)
6. listLessonItems(courseId, unitId, lessonId)
7. listLessonActivities(courseId, unitId, lessonId)
8. getActivityById(courseId, unitId, lessonId, activityId)
9. getVocabularyWords(courseId, unitId, lessonId)
10. getVocabularyItems(courseId, unitId, lessonId)
11. getDistractors(courseId, unitId, lessonId, targetItemId, count)
12. getVisualSafeActivities(courseId, unitId, lessonId)
13. getLessonForPrototype()

Return Rules:

- Return readonly values where practical.
- Do not mutate curriculum objects.
- If not found, return null or [].
- Do not throw for normal missing IDs.
- Throw only for invalid arguments such as count < 0.

Distractor Rules:

getDistractors() must:

- never include the target item
- prefer items from same lesson
- return up to count items
- be deterministic
- preserve lesson item order
- return [] if target not found
- return [] if count = 0
- throw if count < 0

Visual Safe Rules:

getVisualSafeActivities() must return only activities where:

allowedWithoutVisualUI = true

and

requiresVisualUI = false

Validation:

At module initialization or via exported helper, validate that registered curriculum passes:

- validateKidsCurriculumCourse()
- validateKidsCurriculumLesson()
- validateLessonHasNoVisualRequiredActivityWithoutVisualSupport(lesson, false)

Implement:

validateRegisteredCurricula()

Return a result object, not just boolean:

{
  ok: boolean
  errors: string[]
}

Do not fail app startup in this phase.

Tests Required:

Add tests for:

1. listCourses returns prototype course
2. loadCourse returns prototype course by ID
3. loadCourse returns null for missing course
4. loadUnit returns animals unit
5. loadLesson returns animals lesson
6. loadItem returns cat item
7. loadItem returns null for missing item
8. listLessonItems returns 6 items
9. getVocabularyWords returns cat/dog/lion/monkey/elephant/tiger in order
10. getVocabularyItems returns 6 vocabulary items
11. listLessonActivities returns 4 activities
12. getActivityById returns listen_and_repeat
13. getDistractors(cat, 2) returns dog/lion
14. getDistractors excludes target
15. getDistractors count 0 returns []
16. getDistractors negative count throws
17. getDistractors missing target returns []
18. getVisualSafeActivities returns only visual-safe activities
19. validateRegisteredCurricula returns ok=true
20. returned arrays cannot mutate registry state
21. public exports available from index.ts
22. no adult Obsidian imports

Important:

Do not add runtime integration.

Do not modify:

- backend/src/ws/lesson-ws.ts
- backend/src/kids-brain/runtime/
- backend/src/kids-brain/learning-engine/
- frontend/

Run:

cd backend
npx tsc --noEmit
npx vitest run src/kids-brain

Expected:

- 0 TypeScript errors
- all kids-brain tests pass

Create report:

docs/kids-brain-v1/implementation/phase-10C-curriculum-loader-report.md

Report must include:

- files created
- files modified
- loader API overview
- validation behavior
- tests added
- commands run
- test results
- remaining risks
- next recommended phase

Output in chat:

- files created
- files modified
- commands run
- test results
- next phase recommendation