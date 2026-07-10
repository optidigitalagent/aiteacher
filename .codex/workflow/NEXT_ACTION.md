# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Commit, push, and deploy paid teacher word-help routing plus stale input guard
**Type:** DEPLOY
**Phase:** Phase 2 - follow-up production repair
**Agent:** deploy-railway + live-qa-orchestrator

**Why this is next:**
  The user-provided authenticated paid lesson transcript after commit `703da40`
  proved two remaining defects: ASR `Which world... I don't know` could still
  reach the WebSocket off-topic guard instead of current-item help, and the
  paid input could still show stale previous transcript text at the next mic
  start. The local follow-up repair is implemented and verified.

**Completed evidence:**
  - Targeted test:
    `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts --reporter=dot --silent`
    -> exit 0; 1 file passed; 12 tests passed.
  - Backend TypeScript: `cd backend; npx tsc --noEmit` -> exit 0.
  - Frontend build: `cd frontend; npm run build` -> exit 0; Vite build
    succeeded with pre-existing chunk-size warning.
  - Focused regression -> exit 0; 6 files passed; 211 tests passed.
  - Full backend suite -> exit 0; 68 files passed; 2178 tests passed.
  - Review gate -> PASS WITH PENDING DEPLOY + LIVE SMOKE.

**Exact next step:**
  Create a targeted commit for the follow-up repair, push `main`, wait for
  Railway backend/frontend deployments, then verify `/health`, frontend
  `/demo/setup`, startup logs, HTTP 4xx/5xx sweeps, and critical log sweeps.

**Current stop condition:**
  Do not mark the active goal complete after deploy. Final completion still
  requires authenticated paid browser microphone smoke for EN/RU/UA turns,
  direct word-help, no lost/split/stale transcript turns, TTS, and backend log
  correlation.
