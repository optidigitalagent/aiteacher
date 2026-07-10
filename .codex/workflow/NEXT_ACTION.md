# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Commit, push, deploy the paid mic ordering and word-help repair, then run post-deploy checks
**Type:** DEPLOY
**Phase:** Phase 2 - deployed running-product voice repair
**Agent:** deploy-railway + live-qa-orchestrator + qa-tester + acceptance-auditor

**Why this is next:**
  The user-provided paid lesson transcript invalidated the previous claim that
  the paid teacher brain-side behavior was ready. Local repair now covers
  direct word-help / ASR variants (`worms`, `world`, `which word is it`), RU/UA
  unknown word-help fallback, paid frontend `mic_start` ordering before PCM
  capture, and captured adult voice turn ids. Targeted tests, TypeScript,
  frontend build, focused regression, full backend suite, static ordering
  check, and review gate passed locally.

**Completed evidence:**
  - `backend/src/lesson/master-orchestrator.ts` intercepts direct word-help
    before engine grading and returns current expected-answer help without
    `feedback`, `cursorUpdate`, `teacherInput`, cursor movement, or attempts.
  - Unknown RU/UA word-help fallback during deterministic gap-fill now returns
    current expected-answer help instead of `I'm not sure...`, while known
    phrase-map translations remain preserved.
  - `frontend/src/features/classroom/hooks/useVoiceSession.ts` supports a
    `beforeCapture` callback.
  - `frontend/src/features/classroom/components/ClassroomLayout.tsx` sends
    paid `mic_start` through that callback before PCM capture starts, so first
    audio chunks cannot be ordered before `mic_start`.
  - `backend/src/ws/lesson-ws.ts` uses captured voice turn id for stabilized
    adult paid turn submission/logging.
  - Targeted test:
    `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts --reporter=dot --silent`
    -> exit 0; 1 file passed; 10 tests passed.
  - Backend TypeScript: `cd backend; npx tsc --noEmit` -> exit 0.
  - Frontend build: `cd frontend; npm run build` -> exit 0; Vite build
    succeeded with the pre-existing chunk-size warning.
  - Focused regression:
    `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts src/voice/__tests__/voice-turn-stabilizer.test.ts src/voice/__tests__/stt-deepgram-options.test.ts src/voice/__tests__/kids-stt-config-parity.test.ts src/ws/__tests__/message-types.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts --reporter=dot --silent`
    -> exit 0; 6 files passed; 209 tests passed.
  - Full backend suite: `cd backend; npm test -- --reporter=dot --silent`
    -> exit 0; 68 files passed; 2176 tests passed.
  - Static paid mic ordering check -> exit 0; `paid mic start ordering static
    check passed`.
  - `git diff --check` -> exit 0; CRLF warnings only.
  - Review gate -> PASS WITH PENDING DEPLOY AND LIVE SMOKE.

**Exact next step:**
  Stage only the scoped backend/frontend/workflow files, run
  `git diff --cached --check`, commit, push `main`, wait for Railway backend
  and frontend deployments for the new commit, verify backend `/health`,
  frontend `/demo/setup`, startup logs, HTTP 4xx/5xx log windows, and critical
  log sweeps. Then update workflow state and proceed to authenticated paid
  microphone smoke when auth state is available.

**Current stop condition:**
  Do not mark the goal complete. Even after deploy, the required final evidence
  remains authenticated paid classroom microphone smoke for EN/RU/UA turns,
  no lost first words, no split half-turns, no stale transcript carryover, no
  missing `student_message`, TTS audibility, and backend/WS log correlation.
