# Phase 10D — Runtime Curriculum Integration

Goal:

Integrate the Phase 10C curriculum loader into the Kids Brain runtime path.

This phase replaces hardcoded prototype vocabulary with curriculum-loader vocabulary.

Keep scope minimal.

Do NOT add real textbook content.
Do NOT modify frontend.
Do NOT modify adult runtime.
Do NOT change WebSocket protocol.
Do NOT redesign runtime.
Do NOT deploy.

Source of Truth:

Read:

- docs/kids-brain-v1/implementation/phase-10D.0-runtime-integration-readiness-audit-report.md
- docs/kids-brain-v1/implementation/phase-10C-curriculum-loader-report.md
- backend/src/kids-brain/curriculum/
- backend/src/ws/lesson-ws.ts
- backend/src/kids-brain/runtime/
- backend/src/kids-brain/learning-engine/

Allowed files to modify:

1. backend/src/ws/lesson-ws.ts
2. backend/src/kids-brain/learning-engine/learning-engine.ts
3. backend/src/kids-brain/contracts/session-memory.ts
4. backend/src/kids-brain/runtime/session-bootstrap.ts
5. backend/src/kids-brain/runtime/runtime-types.ts
6. tests under backend/src/kids-brain/**

If another file is needed, stop and report why.

Tasks:

1. Replace hardcoded vocabulary source

In lesson-ws.ts:

Remove or stop using:

KIDS_PROTOTYPE_TARGET_WORDS

Use curriculum loader instead:

getVocabularyWords(...)

Use the prototype lesson from Phase 10C.

Do not expose curriculum selection to frontend.

Do not accept curriculum IDs from client yet.

2. Add lessonId to SessionMemory

Add:

lessonId: string | null

Seed it during startKidsBrainSession.

Use prototype lesson ID for now.

3. Fix R22 next item gap

Problem:

Learning engine may produce:

shouldAdvanceItem = true
nextTargetItemId = undefined

Fix:

When shouldAdvanceItem is true and nextTargetItemId is undefined, select the next item from availableItems.

Rules:

- use existing availableItems order
- do not hardcode cat→dog→lion
- do not add curriculum-specific logic inside learning engine
- if current item is last item, keep current item or return null according to existing completion semantics
- preserve existing recovery/mastery behavior

4. Tests

Add or update tests proving:

- lesson-ws no longer relies on literal KIDS_PROTOTYPE_TARGET_WORDS as source of truth
- curriculum loader vocabulary is used for kids session start
- curriculum loader vocabulary is used for kids turn processing
- sessionMemory.lessonId is seeded
- R22 advancement produces nextTargetItemId from availableItems
- nextTargetItemId persists into updatedSessionMemory.currentTargetItemId
- no regression to placeholder guard
- no adult runtime imports
- feature flag behavior unchanged

Use mocks/stubs where needed.

Do not require live Redis/Postgres.

5. Validation

Run:

cd backend
npx tsc --noEmit
npx vitest run src/kids-brain

Expected:

- 0 TypeScript errors
- all kids-brain tests pass

Create report:

docs/kids-brain-v1/implementation/phase-10D-runtime-curriculum-integration-report.md

Report must include:

- files modified
- exact integration point
- curriculum IDs used
- R22 fix details
- tests added/updated
- commands run
- test results
- remaining risks
- next recommended phase

Output in chat:

- files modified
- commands run
- test results
- remaining risks
- next phase recommendation