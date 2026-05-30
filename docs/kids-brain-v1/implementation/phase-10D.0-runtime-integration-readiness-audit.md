# Phase 10D.0 — Runtime Integration Readiness Audit

Goal:

Audit the safest way to integrate the Phase 10C Curriculum Loader into the Kids Brain runtime.

This is audit/design only.

Do NOT modify code.
Do NOT integrate curriculum.
Do NOT modify lesson-ws.ts.
Do NOT modify runtime.
Do NOT modify frontend.
Do NOT modify adult runtime.
Do NOT deploy.

Context:

Phase 10A created curriculum schema.
Phase 10B created prototype animals lesson.
Phase 10C created curriculum loader.

Current production/runtime still uses hardcoded prototype words:

KIDS_PROTOTYPE_TARGET_WORDS

The next phase, 10D, will replace this with curriculum-loader access.

Before coding 10D, audit the current runtime data flow and identify the smallest safe integration point.

Read:

- docs/kids-brain-v1/implementation/phase-10-curriculum-integration-audit-report.md
- docs/kids-brain-v1/implementation/phase-10A-curriculum-schema-report.md
- docs/kids-brain-v1/implementation/phase-10B-static-prototype-animals-lesson-report.md
- docs/kids-brain-v1/implementation/phase-10C-curriculum-loader-report.md
- backend/src/kids-brain/curriculum/
- backend/src/ws/lesson-ws.ts
- backend/src/kids-brain/runtime/
- backend/src/kids-brain/learning-engine/
- backend/src/kids-brain/teacher-response/
- backend/src/kids-brain/state-engine/

Audit Questions:

1. Current hardcoded vocabulary flow

Find every place where:

- KIDS_PROTOTYPE_TARGET_WORDS
- lessonTargetWords
- targetWord
- currentTargetItemId
- nextTargetItemId
- vocabularyGroup

is created, passed, mutated, or persisted.

Report file/function/line.

2. Curriculum loader integration point

Determine the smallest safe place to replace hardcoded words with:

getVocabularyWords(...)
getVocabularyItems(...)
getDistractors(...)

Answer:

- Should lesson-ws.ts call the loader?
- Should runtime/session-bootstrap.ts call the loader?
- Should a new runtime adapter call the loader?
- Should learning-engine call the loader?
- Which option touches the fewest production files?
- Which option preserves backend authority?

3. SessionMemory requirements

Answer:

- Does SessionMemory need new fields?
- Should it store courseId/unitId/lessonId?
- Should it store currentItemId only?
- Should it store full lesson plan?
- Should it store vocabulary item metadata?
- What is safe for Redis?
- What should not be stored?

4. Start session integration

Answer:

- What should startKidsBrainSession() receive after curriculum integration?
- Should it receive lessonTargetWords directly?
- Should it receive a curriculumLessonRef?
- Should it resolve curriculum internally?
- What is the minimal non-breaking change?

5. Turn processing integration

Answer:

- How should processKidsBrainTurn() know the current item?
- How should it get targetWord?
- How should it get lessonTargetWords?
- How should it get distractors?
- Should it depend on curriculum loader directly?
- Should it receive resolved context from lesson-ws?

6. Learning engine integration

Answer:

- Where should nextTargetItemId be selected?
- Should it use lesson item order from curriculum?
- Should it use mastery/recovery state?
- What is the minimal fix for the R22 gap:
  shouldAdvanceItem=true
  nextTargetItemId=undefined

7. Teacher response integration

Answer:

- Does Teacher Response need full curriculum item metadata?
- Or only targetText + distractors + activity type?
- How should prompt templates from curriculum be used later?
- Should Phase 10D use curriculum prompt templates or defer?

8. Activity/UI compatibility

Answer:

- How to ensure only visual-safe activities are used until child UI exists?
- Should getVisualSafeActivities() be used in runtime now?
- Where should visual-required prompts be blocked?

9. Risk assessment

Identify risks:

- runtime overcoupling to curriculum
- breaking kids production path
- breaking feature flag fallback
- introducing curriculum injection from frontend
- storing too much curriculum in Redis
- making lesson-ws too smart
- duplicating progression logic

10. Phase 10D implementation plan

Produce a recommended implementation plan with:

- files to modify
- files not to modify
- exact functions to change
- tests to add
- expected LOC
- rollback strategy

Output:

Create:

docs/kids-brain-v1/implementation/phase-10D.0-runtime-integration-readiness-audit-report.md

Report must include:

1. Executive Summary
2. Current Runtime Vocabulary Flow
3. Recommended Integration Point
4. SessionMemory Changes
5. Start Session Integration Plan
6. Turn Processing Integration Plan
7. Learning Engine Integration Plan
8. Teacher Response Integration Plan
9. Visual-Safe Activity Plan
10. Risks
11. Recommended Phase 10D Scope
12. Explicit Do-Not-Touch List
13. Final Verdict

Final Verdict must be one of:

- READY FOR PHASE 10D
- NOT READY FOR PHASE 10D

Commands:

Run:

cd backend
npx tsc --noEmit
npx vitest run src/kids-brain

Output in chat:

- files created
- commands run
- recommended integration point
- files to modify in Phase 10D
- final verdict