# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Deploy paid lesson production smoke follow-up repair after explicit approval
**Type:** DEPLOY-PROD-VERIFY
**Phase:** Phase 3 - Deploy and production owner smoke
**Agent:** goal-executor + deploy-railway + qa-tester

**Why this is next:**
  The owner paid-access bypass is deployed, but the post-deploy authenticated
  smoke found additional production defects: OpenAI TTS cooldown left the
  lesson text-only while ElevenLabs was skipped, queued inputs interleaved with
  still-sending teacher turns, and soft-speaking lesson completion could route
  back into stale Exercise 1 Teacher Brain context. The follow-up repair is
  implemented and locally validated. A new Railway production deploy requires
  explicit approval before mutation.

**Completed evidence:**
  - `backend/src/voice/tts.ts` now falls back to another configured provider
    when the preferred provider fails or is in cooldown, and treats provider
    timeouts as failures rather than successful silent aborts.
  - `backend/src/lesson/master-orchestrator.ts` now returns deterministic
    wrong-turn hints for engine-owned fill-gap items.
  - `backend/src/ws/lesson-ws.ts` now holds `aiProcessing` through TTS,
    replays queued input only after teacher-turn completion, discards queued
    input after lesson end, and short-circuits soft-speaking `lesson_complete`.
  - `cd backend; npx vitest run src/voice/__tests__/tts-fallback.test.ts --reporter=dot --silent`
    -> exit 0; 19 tests passed.
  - `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts --reporter=dot --silent`
    -> exit 0; 1 test passed.
  - `cd backend; npx tsc --noEmit` -> exit 0.
  - `cd backend; npm test -- --reporter=dot --silent`
    -> exit 0; 66 files passed; 2134 tests passed.
  - Review gate: backend reviewer PASS WITH WARNING; curriculum reviewer PASS;
    QA tester PASS; frontend/kids safety/acceptance auditor not applicable.

**Exact next step after approval:**
  1. Commit only the follow-up repair files plus workflow checkpoint.
  2. Push `main`.
  3. Wait for Railway backend/frontend deployment success.
  4. Production-smoke `artenon92@gmail.com` paid lesson section `1.1` in an
     authenticated browser with real audio: teacher turns must be voiced, item
     hints must not reference stale items, and lesson completion must not
     return to Exercise 1 Number 5.

**Current stop condition:**
  Explicit approval is required before the new production deploy/mutation.
