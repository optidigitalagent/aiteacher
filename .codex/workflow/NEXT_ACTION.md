# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Commit, push, and deploy paid private-tutor behavior repair
**Type:** DEPLOY
**Phase:** Phase 3 - Deploy and production owner smoke
**Agent:** goal-executor + deploy-railway

**Why this is next:**
  User reran paid lesson section `1.1` and found additional Teacher Brain
  behavior defects: `Okay` after the intro was graded as a wrong Exercise 1
  answer, there was no short personal warm-up, closed gap-fill feedback still
  sounded mechanical, clarification wording was dry, and open speaking
  completed after one short answer. The scoped backend repair is implemented,
  locally validated, and review-gated. It must now be committed, pushed, and
  deployed before production smoke can verify the behavior.

**Completed evidence:**
  - `backend/src/lesson/master-orchestrator.ts` intercepts intro readiness and
    one pending warm-up turn before Exercise 1 submission, then bridges back to
    the backend-authoritative first item.
  - `backend/src/validation/soft-speaking-validator.ts` adds bounded speaking
    depth checks: reason/example follow-up, natural recast, and repeat request
    before progression.
  - Teacher Brain prompt/rule/protocol files now describe private-tutor
    warm-up and context-aware speaking mini-dialogue behavior.
  - `backend/src/ws/lesson-ws.ts` uses more teacher-like soft-speaking retry
    and completion wording.
  - Targeted tests:
    `cd backend; npx vitest run src/lesson/__tests__/paid-vocab-flow.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts --reporter=dot --silent`
    -> exit 0; 2 files passed; 153 tests passed.
  - Backend TypeScript:
    `cd backend; npx tsc --noEmit` -> exit 0.
  - Full backend suite:
    `cd backend; npm test -- --reporter=dot --silent` -> exit 0; 67 files
    passed; 2156 tests passed.
  - `git diff --check` -> exit 0; CRLF warnings only.
  - Review gate -> PASS WITH WARNING: backend, curriculum, kids safety, prompt,
    and QA ran; frontend not applicable; acceptance auditor not applicable.

**Exact next step:**
  Stage only the scoped product/test files and workflow evidence, confirm no
  `.env` or unrelated files are staged, commit, push to `origin/main`, wait for
  Railway backend/frontend deployment success, verify `/health`, frontend
  `/demo/setup`, startup logs, and recent critical log windows.

**Current stop condition:**
  Manual authenticated owner paid lesson smoke with real microphone remains
  required after deployment.
