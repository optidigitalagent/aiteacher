# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Deploy paid lesson mic UX parity repair after explicit approval
**Type:** DEPLOY-PROD-VERIFY
**Phase:** Phase 3 - Deploy and production owner smoke
**Agent:** goal-executor + deploy-railway + qa-tester

**Why this is next:**
  The owner paid-access bypass and backend follow-up runtime repair are deployed
  to Railway production. The latest owner smoke showed the lesson is better,
  but paid microphone UX still differs from demo: spoken words are not preserved
  visibly around `mic_stop`, pending turns can clear the field, and typed send
  did not interrupt teacher audio like demo. The frontend repair is implemented
  and locally validated. A new production deploy requires explicit approval
  before mutation.

**Completed evidence:**
  - `backend/src/voice/tts.ts` now falls back to another configured provider
    when the preferred provider fails or is in cooldown, and treats provider
    timeouts as failures rather than successful silent aborts.
  - `backend/src/lesson/master-orchestrator.ts` now returns deterministic
    wrong-turn hints for engine-owned fill-gap items.
  - `backend/src/ws/lesson-ws.ts` now holds `aiProcessing` through TTS,
    replays queued input only after teacher-turn completion, discards queued
    input after lesson end, and short-circuits soft-speaking `lesson_complete`.
  - Commit `2d1535048b7ad49119e22f5d0ac59af3571bcacc`
    (`fix(lesson): stabilize paid voice turn state`) was pushed to
    `origin/main`.
  - Railway backend `aiteacher` deployment
    `c1d6d54d-c1d2-4558-80af-9a79a5ca8cd2` -> SUCCESS.
  - Railway frontend `aware-alignment` deployment
    `ed41ec51-ed38-4708-8ce4-b4826ff4d8e2` -> SUCCESS.
  - Backend `/health` -> HTTP 200; postgres ok; redis ok; timestamp
    `2026-07-09T12:44:05.215Z`.
  - Frontend `/demo/setup` -> HTTP 200.
  - Railway startup/runtime logs show migrations applied, server listening on
    `0.0.0.0:8080`, PostgreSQL ready, Redis ready, WS endpoint attached, and
    no checked HTTP 4xx/5xx entries in the 10-minute post-deploy window.
  - `frontend/src/features/classroom/components/ClassroomLayout.tsx` now keeps
    paid lesson transcript visible during backend finalization, disables
    mic/send while the voice turn is pending to prevent double-submit, clears
    stale text only when starting a new mic turn, and interrupts active teacher
    audio on paid typed/exercise submit.
  - `cd frontend; npm run build` -> exit 0; TypeScript and Vite production
    build completed.
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
  1. Commit only the frontend mic UX parity repair plus workflow checkpoint.
  2. Push `main`.
  3. Wait for Railway backend/frontend deployment success.
  4. Production-smoke `artenon92@gmail.com` paid lesson section `1.1` in an
     authenticated browser with real audio. Verify that spoken words remain
     visible while finalizing, mic/send are blocked only during pending
     finalization, typed send interrupts teacher audio, backend receives the
     final student message, and the prior voiced/progression fixes still hold.

**Current stop condition:**
  Explicit approval is required before the new production deploy/mutation.
