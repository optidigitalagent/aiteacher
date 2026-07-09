# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Deploy paid lesson voice-finalization and human-tutor repair, then run owner paid mic smoke
**Type:** DEPLOY-AND-PROD-SMOKE
**Phase:** Phase 3 - Deploy and production owner smoke
**Agent:** deploy-railway + owner/user + goal-executor observation

**Why this is next:**
  Local implementation and automated validation are complete for the current
  repair. The code is not committed or deployed yet, so production still runs
  the previous bundle. Acceptance now requires Railway deploy plus a real
  authenticated paid lesson microphone smoke.

**Completed evidence:**
  - Backend paid voice now counts adult audio chunks, keeps adult partial/late
    transcript state, sends explicit `voice_turn_empty`, and submits all adult
    voice turns through a single deduped helper.
  - Frontend paid mic pending state now clears on backend `student_message`,
    `voice_turn_empty`, or STT `voice_unavailable`; the old 1500ms no-text
    release is now only a 7000ms lost-event fallback.
  - Deterministic paid STT cleanup normalizes only to backend expected answers.
  - Teacher Brain now allows one friendly follow-up only in speaking/warmup
    tasks and keeps deterministic textbook items strict.
  - `cd backend; npx vitest run src/voice/__tests__/voice-turn-stabilizer.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts`
    -> exit 0; 150 tests passed.
  - `cd backend; npx tsc --noEmit` -> exit 0.
  - `cd frontend; npm run build` -> exit 0.
  - `cd backend; npm test -- --reporter=dot --silent` -> exit 0; 67 test
    files passed; 2142 tests passed.

**Exact next step:**
  Commit the scoped product/test changes, deploy backend/frontend to Railway,
  verify `/health` and frontend asset refresh, then run authenticated owner paid
  lesson section `1.1` with real microphone. Verify:
  spoken words stay visible until backend finalization; click mic -> speak ->
  click mic sends one clean `student_message`; clicking mic while Alex speaks
  stops teacher audio immediately; no stale `exercise_answer` double-submit;
  speaking/warmup gets one friendly follow-up while deterministic fill-gap does
  not drift.

**Current stop condition:**
  Deployment and manual production verification are pending.
