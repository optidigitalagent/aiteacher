# Phase 10A — Curriculum Schema

Goal:

Design and implement the static curriculum schema for Mentium Kids Brain v1.

This phase creates the schema only.

Do NOT integrate curriculum into runtime.
Do NOT replace KIDS_PROTOTYPE_TARGET_WORDS yet.
Do NOT modify lesson-ws.ts.
Do NOT modify frontend.
Do NOT add real textbook content.
Do NOT deploy.

Context:

Phase 10 audit found:

- Kids Brain architecture is ready.
- Current production path uses hardcoded KIDS_PROTOTYPE_TARGET_WORDS.
- backend/src/kids-runtime/animals-curriculum.ts contains useful prototype content.
- Runtime needs a curriculum/ module before textbook integration.
- We need a schema first, then prototype content, then loader, then runtime integration.

Source of Truth:

Read:

- docs/kids-brain-v1/implementation/phase-10-curriculum-integration-audit-report.md
- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-spec.md
- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-patch-1.1.md
- backend/src/kids-brain/
- backend/src/kids-runtime/animals-curriculum.ts

Create Module:

backend/src/kids-brain/curriculum/

Create files:

- index.ts
- curriculum-types.ts
- curriculum-schema.ts
- curriculum-validators.ts

Create tests:

backend/src/kids-brain/curriculum/__tests__/curriculum-schema.test.ts

Schema Requirements:

Define TypeScript types for:

1. KidsCurriculumCourse
2. KidsCurriculumUnit
3. KidsCurriculumLesson
4. KidsCurriculumPhase
5. KidsCurriculumItem
6. KidsVocabularyItem
7. KidsActivityDefinition
8. KidsVisualAssetRef
9. KidsAudioAssetRef
10. KidsTeacherPromptTemplate
11. KidsAcceptedAnswer
12. KidsDistractor
13. KidsReviewLink

Minimum Course Fields:

- courseId
- version
- title
- source
- cefrLevel
- ageBands
- units

Minimum Unit Fields:

- unitId
- title
- theme
- targetAgeBands
- lessons

Minimum Lesson Fields:

- lessonId
- unitId
- title
- estimatedMinutes
- allowedAgeBands
- learningObjectives
- phases
- items
- activities
- reviewLinks

Minimum Phase Fields:

- phaseId
- type
- order
- estimatedSeconds
- allowedActivities
- exitCriteria

Minimum Item Fields:

- itemId
- type
- targetText
- normalizedAnswer
- l1Translations
- visualAsset
- audioAsset
- gestures
- difficulty
- tags

Minimum Activity Fields:

- activityId
- type
- requiredItemTypes
- requiresVisualUI
- requiresAudio
- requiresSpeech
- allowedWithoutVisualUI
- promptTemplates
- successCriteria
- fallbackPolicy

Activity UI Safety:

Define activity compatibility rules:

- listen_and_repeat: allowed without visual UI
- forced_choice_audio: allowed without visual UI only if spoken choices exist
- forced_choice_visual: requires visual UI
- listen_and_point: requires visual UI
- find_the_object: requires visual UI
- chant: allowed without visual UI
- open_answer: allowed only for age 8–9 or later phases
- review_production: allowed without visual UI

Validation Functions:

Implement pure validators:

- validateKidsCurriculumCourse(course)
- validateKidsCurriculumLesson(lesson)
- validateKidsCurriculumActivity(activity)
- validateNoPlaceholderLeaks(template)
- validateActivityUISafety(activity)
- validateLessonHasNoVisualRequiredActivityWithoutVisualSupport(lesson)

Do not use external validation libraries unless already installed.

Placeholder Guard:

Reject templates containing unresolved placeholders other than approved variables.

Approved variables:

- {target}
- {choiceA}
- {choiceB}
- {childName}
- {characterName}

But validators must distinguish:

- allowed template variables at authoring time
- unresolved placeholders in final teacher output

In this phase, only schema-level validation is required.

Security Rules:

- Curriculum files are backend-authored only.
- No user-provided curriculum.
- No frontend-authored progression.
- No LLM-generated curriculum at runtime.
- No raw copyrighted textbook text.
- Store only metadata and original authored content owned by us.

Tests Required:

Add tests for:

1. valid minimal course passes
2. valid minimal lesson passes
3. missing courseId fails
4. missing lesson phases fails
5. item without normalizedAnswer fails
6. visual activity requires visual UI
7. listen_and_repeat allowed without visual UI
8. forced_choice_visual rejected without visual support
9. prompt with approved placeholders passes
10. prompt with unknown placeholder fails
11. final-output placeholder guard rejects {target}
12. lesson with visual-required activity fails when visualSupport=false
13. lesson with only visual-safe activities passes when visualSupport=false
14. no adult Obsidian imports
15. public exports available from index.ts

Important:

Do not create actual curriculum content in this phase.
Use test fixtures only.

Run:

cd backend
npx tsc --noEmit
npx vitest run src/kids-brain

Expected:

- 0 TypeScript errors
- all kids-brain tests pass

Create report:

docs/kids-brain-v1/implementation/phase-10A-curriculum-schema-report.md

Report must include:

- files created
- schema overview
- validator overview
- tests added
- commands run
- test results
- remaining risks
- next recommended phase

Output in chat:

- files created
- commands run
- test results
- next phase recommendation