# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Manual production Kids mic retest for `Say again. Blue.` correction
**Type:** MANUAL-PROD-VERIFY
**Phase:** Phase 9 - Deployment
**Agent:** user live browser + goal-executor production-log-analyzer

**Why this is next:**
  The backend fix for the observed production target-recognition bug is
  committed, pushed, deployed, health-checked, and log-checked. The remaining
  evidence gap is the physical browser/microphone path: confirm that saying
  `blue` after the retry prompt now progresses instead of looping on
  `social_speech` / warm redirect.

**Completed evidence:**
  - Commit `ed10f8664c1772377b5c8e0fcf8f074a90ab54d6`
    (`fix(kids): recognize retry echo target word`) pushed to `origin/main`.
  - Railway backend `aiteacher` deployment
    `2e247e8d-508c-4f0e-a961-be16974a4e46` -> SUCCESS at commit `ed10f86`.
  - Railway frontend `aware-alignment` deployment
    `81bebd19-c2aa-4d84-b7d8-b8a1e7075e62` -> SUCCESS at commit `ed10f86`
    (auto-deploy; no frontend code changed).
  - `/health` at 2026-07-09T08:15:01Z -> HTTP 200, postgres ok, redis ok.
  - Backend logs: server listening, PostgreSQL ready, Redis ping OK/ready.
  - 10-minute post-deploy log check: no `HTTP 400`, `Unhandled`,
    `ECONNREFUSED`, `Cannot find`, `Error:`, `voice_unavailable`,
    `SESSION_VERIFICATION_FAILED`, or `NO_CHILD_PROFILE` in checked tail.
  - Local validation:
    targeted correction suite -> 34/34 passed;
    `npx tsc --noEmit` -> exit 0;
    broader Kids/voice suite -> 45 files, 1544 tests passed;
    full backend suite -> 64 files, 2127 tests passed.

**Manual test steps:**
  1. Open `https://aware-alignment-production.up.railway.app/kids`.
  2. Start a Kids lesson with the existing child profile/interests.
  3. If the teacher asks a warmup/interests question, answer normally.
  4. When the lesson reaches the colour word `blue`, intentionally trigger the
     retry/recovery prompt if needed, then press the mic and clearly say
     `blue`.
  5. Expected browser behavior: transcript/student message appears, teacher
     accepts or advances, and the lesson does not keep redirecting as if the
     answer was social/off-task speech.
  6. Send the new console snippet or just report whether the lesson advanced.
     Goal Executor will then inspect Railway logs for
     `method=teacher_echo_target_suffix` and classification/progression.

**Success criterion:**
  Live production browser/mic path verifies target `blue` is accepted/progresses
  after the retry prompt; production logs show no critical errors.

**Current stop condition:**
  AGENTS stop rule 4 - manual production verification is required.

---

### Phase-advance rule (ALWAYS included after REVIEW tasks)
After a REVIEW PASS, Goal Executor MUST:
1. Mark phase complete in `GLOBAL_GOAL.md` phase table
2. Append completion entry to `GOAL_PROGRESS.md`
3. Detect next NEXT or PENDING phase from `GLOBAL_GOAL.md`
4. Write that phase's CODE task here
5. Continue immediately - no user confirmation required
