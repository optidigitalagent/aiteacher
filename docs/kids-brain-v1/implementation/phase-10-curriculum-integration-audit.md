# Phase 10 — Curriculum Integration Audit

Goal:

Determine how Mentium Kids Brain v1 should receive real curriculum content instead of the current prototype animal word list.

This is audit/design only.

Do NOT implement curriculum.
Do NOT add textbook content.
Do NOT modify runtime.
Do NOT modify frontend.
Do NOT modify adult runtime.
Do NOT deploy.

Context:

Kids Brain v1 now works in production behind feature flag.

Live testing proved:

- correct answers are recognized
- {target} placeholder bug is fixed
- target persistence works
- TTS works
- Redis/Postgres are working

But live testing also proved:

- current lesson uses prototype hardcoded animal vocabulary
- target progression is not curriculum-driven
- some prompts require visuals that the current UI does not provide
- the lesson behaves like a text/audio loop, not a structured child lesson

Audit objective:

Design the bridge between curriculum content and Kids Brain v1.

Do not write code.

Read:

- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-spec.md
- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-patch-1.1.md
- docs/kids-brain-v1/implementation/phase-8.10-live-test-fix-audit-report.md
- docs/kids-brain-v1/implementation/phase-8.11-persist-target-progression-report.md
- backend/src/kids-brain/
- backend/src/ws/lesson-ws.ts
- backend/src/kids-brain/runtime/
- backend/src/kids-brain/learning-engine/
- backend/src/kids-brain/teacher-response/

Also inspect current research/curriculum docs:

- docs/kids-brain-v1/research/
- docs/kids-brain-v1/core/
- docs/kids-brain-v1/runtime/
- docs/kids-brain-v1/architecture/

Audit Questions:

1. Curriculum Source

Answer:

- Where should real kids curriculum live?
- Should it be YAML, JSON, TS, or database-backed?
- What is appropriate for v1?
- What should stay out of code?
- What should be versioned in Git?

2. Curriculum Unit Shape

Define the minimum schema for:

- course
- unit
- lesson
- item
- vocabulary word
- activity
- visual asset reference
- teacher prompt
- accepted answers
- distractors
- review links

Do not create real content.
Only define schema.

3. Runtime Integration

Answer:

- How does startKidsBrainSession receive curriculum?
- How does processKidsBrainTurn know current item?
- Where is current item selected?
- Where is next item selected?
- Where is lesson phase selected?
- What should Learning Engine own?
- What should Activity Engine own?
- What should Teacher Response own?

4. Target Progression

Answer:

- Should progression be linear?
- Should it be mastery-based?
- Should it be activity-phase-based?
- How should cat → dog → lion style progression become curriculum-driven?
- What replaces KIDS_PROTOTYPE_TARGET_WORDS?

5. Activity Rendering

Current issue:

Teacher asks:
- "Point to it"
- "Where is the dog?"
- "Can you find the dog?"

but frontend does not show images.

Answer:

- Which activities are safe without visual UI?
- Which activities require visual UI?
- What temporary activity subset should be allowed before child UI exists?
- Should visual-required prompts be disabled until UI supports them?

6. Frontend Contract

Define minimal frontend contract for child lesson:

- show target word
- show image cards
- show two-choice activity
- show teacher character text
- show listening state
- show selected answer
- no adult phase labels

Do not implement frontend.

7. Teacher Prompt Contract

Answer:

- Should teacher response templates be curriculum-aware?
- How should templates receive:
  - target word
  - activity type
  - distractors
  - visual asset refs
  - child state
- How to prevent placeholder leaks?
- How to prevent prompts requiring unavailable UI?

8. Data Flow

Define desired data flow:

Curriculum file
→ Curriculum loader
→ Lesson plan
→ Runtime session memory
→ Learning engine
→ Activity engine
→ Teacher response
→ WS action packets
→ frontend rendering

9. Safety / Cost / Abuse Constraints

Ensure:

- no unauthenticated curriculum access
- no frontend-authoritative progression
- no user-provided curriculum injection
- no LLM-generated curriculum at runtime
- backend owns curriculum selection
- no extra LLM calls for curriculum progression

10. Migration Path

Create phased plan:

Phase 10A — Curriculum schema
Phase 10B — Static prototype curriculum file
Phase 10C — Curriculum loader
Phase 10D — Runtime integration
Phase 10E — Activity UI contract
Phase 10F — Visual-safe activity subset
Phase 10G — Replace hardcoded animal list
Phase 10H — QA

11. Readiness

Answer:

- Is it better to add textbook now?
- Or first add curriculum schema + prototype lesson?
- What blocks textbook integration?
- What should be implemented before importing a real textbook?

Output:

Create:

docs/kids-brain-v1/implementation/phase-10-curriculum-integration-audit-report.md

Report must include:

1. Executive Summary
2. Recommended Curriculum Architecture
3. Minimum Curriculum Schema
4. Backend Module Map
5. Runtime Integration Plan
6. Activity/UI Compatibility Matrix
7. Teacher Prompt Contract
8. Data Flow
9. Security/Cost Constraints
10. Migration Plan
11. Blockers
12. Recommended Next Phase
13. Final Verdict

Final Verdict must be one of:

- READY TO DESIGN CURRICULUM SCHEMA
- NOT READY FOR CURRICULUM WORK

Commands:

Run:

cd backend
npx tsc --noEmit
npx vitest run src/kids-brain

Output in chat:

- files created
- commands run
- key findings
- recommended next phase
- final verdict