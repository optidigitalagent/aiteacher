# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Commit and deploy paid lesson AI intelligence repair after production approval
**Type:** DEPLOY-AFTER-APPROVAL
**Phase:** Phase 3 - Deploy and production owner smoke
**Agent:** deploy-railway + goal-executor

**Why this is next:**
  User reran paid lesson section `1.1` after the previous deployed repair and
  found additional AI/teaching behavior defects, not frontend or mic mechanics:
  `I'm ready. Hold Hobby.` and `Get it.` were treated as wrong, deterministic
  correct feedback sounded validator-like, wrong hints were too dry, Exercise 1
  to Exercise 2 was abrupt, and the speaking prompt was too instruction-heavy.
  The scoped backend intelligence repair is implemented and locally validated,
  but it is not committed, deployed, or production-smoked.

**Completed evidence:**
  - `backend/src/voice/voice-turn-stabilizer.ts` now normalizes short
    readiness/filler tails to the current backend expected answer and maps
    `get it` -> `get fit` only when the expected answer is `get fit`.
  - `backend/src/lesson/master-orchestrator.ts` now produces warmer
    backend-authored deterministic confirmations, concrete wrong-turn hints,
    and a warm bridge into soft-speaking after deterministic completion.
  - `backend/src/lesson/auto-section-manifest-builder.ts` now frames vocabulary
    Exercise 2 as a tutor-like question plus answer starter.
  - `backend/src/ai/teacher-brain/teacher-brain-rules.ts` and
    `backend/src/ai/teacher-brain/teacher-brain-builder.ts` clarify that warm
    bridging belongs in speaking/warmup, not personal follow-up inside
    deterministic gap-fill.
  - Targeted tests:
    `cd backend; npx vitest run src/voice/__tests__/voice-turn-stabilizer.test.ts src/lesson/__tests__/paid-vocab-flow.test.ts src/exercises/runtime-qa/pedagogical-behavior.qa.test.ts --reporter=dot --silent`
    -> exit 0; 3 files passed; 161 tests passed.
  - Backend TypeScript:
    `cd backend; npx tsc --noEmit` -> exit 0.
  - Full backend suite:
    `cd backend; npm test -- --reporter=dot --silent` -> exit 0; 67 files
    passed; 2152 tests passed.
  - `git diff --check` -> exit 0; CRLF warnings only.
  - Review gate -> PASS for backend, curriculum, kids safety, and QA; frontend
    and acceptance auditor not applicable.

**Exact next step:**
  If production deployment is approved, commit only the scoped backend product,
  test, and workflow files for this repair; push to `origin/main`; deploy to
  Railway; verify backend `/health`, frontend reachability if monorepo deploy
  also fires, and recent Railway logs; then rerun authenticated owner paid
  lesson section `1.1` with real microphone.

**Current stop condition:**
  Production deploy approval/live owner smoke is pending.
