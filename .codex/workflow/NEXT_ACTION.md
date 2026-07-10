# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Commit, push, and deploy paid lesson 1.1 live tutor intelligence repair
**Type:** DEPLOY
**Phase:** Phase 3 - Deploy and production owner smoke
**Agent:** goal-executor + qa-tester

**Why this is next:**
  User manually tested production paid lesson section `1.1` after commit
  `ae5eb8b` and found remaining Teacher Brain / backend intelligence defects:
  readiness bypassed the warm-up, the `My ___ is photography.` expected-answer
  alignment needed proof, repeated full answer `keen on keen on` was rejected,
  and the reason-required speaking task repeated the whole prompt instead of
  targeted scaffolding. The scoped backend/Teacher Brain repair is implemented
  and locally validated; it now needs commit, push, Railway deployment, and
  post-deploy health/log verification before manual owner smoke.

**Completed evidence:**
  - `backend/src/ws/lesson-ws.ts` readiness now delegates to
    `MasterLessonOrchestrator.handleStudentAnswer`, so the production WS path
    can return the deterministic warm-up instead of an immediate Exercise 1
    prompt.
  - Section `1.1` item sync is pinned by test:
    `My ___ is photography.` expects `hobby`; `spare time` is rejected there
    and the cursor stays on the same item.
  - `backend/src/voice/voice-turn-stabilizer.ts` normalizes the current
    expected phrase repeated exactly 2-3 times, e.g. `keen on keen on` ->
    `keen on`, and rejects that normalization for other current answers.
  - `backend/src/validation/soft-speaking-validator.ts` detects
    opinion-without-reason fragments, asks for one missing reason or reason
    plus example, and blocks premature completion of tiny reason-required
    fragments before the anti-loop limit.
  - Teacher Brain runtime docs, prompt-builder, rules, and exercise-teaching
    protocol text now match the bounded reason/example/recast/repeat behavior.
  - Targeted tests:
    `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts src/voice/__tests__/voice-turn-stabilizer.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts --reporter=dot --silent`
    -> exit 0; 3 files passed; 171 tests passed.
  - Backend TypeScript:
    `cd backend; npx tsc --noEmit` -> exit 0.
  - Focused follow-up:
    `cd backend; npx vitest run src/demo/communicative-success.test.ts --reporter=dot --silent`
    -> exit 0; 1 file passed; 35 tests passed.
  - Full backend suite:
    `cd backend; npm test -- --reporter=dot --silent` -> exit 0; 67 files
    passed; 2162 tests passed.
  - `git diff --check` -> exit 0; CRLF warnings only.
  - Review gate -> PASS: backend, curriculum, kids safety, prompt tester, and
    QA ran; frontend not applicable; acceptance auditor not applicable before
    deploy/manual smoke.
  - No frontend UI, billing, auth, STT/TTS config, mic config,
    `docs/master-prompt.md`, or `.env` file changed.
  - Commit: no commit created yet for this repair.
  - Deployment: not deployed yet for this repair.

**Exact next step:**
  Stage only scoped backend, Teacher Brain docs, tests, and workflow evidence;
  commit; push `origin/main`; verify Railway backend/frontend deployments,
  backend `/health`, frontend `/demo/setup`, and recent HTTP/error logs.

**Current stop condition:**
  None until deployment finishes or an external credential/deploy failure blocks
  progress. After deploy, manual authenticated owner paid lesson section `1.1`
  smoke with real microphone will remain required.
