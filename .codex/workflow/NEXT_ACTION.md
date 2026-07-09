# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Deploy Kids STT teacher-echo target correction and run production verification
**Type:** DEPLOY-VERIFY
**Phase:** Phase 9 - Deployment
**Agent:** goal-executor -> deploy-railway + production-log-analyzer + QA tester

**Why this is next:**
  User live production evidence showed the Kids mic/STT pipeline was active, but
  target recognition failed when Deepgram returned `Say again. Blue.` for target
  `blue`. The local fix is implemented and validated; production still runs the
  old behavior until the new backend commit is pushed and Railway deploys it.

**Current evidence:**
  - Production session `0abe0557-75f0-4902-adac-eb3fc55313cf`:
    STT provider `deepgram`, `utterance_end_ms=1000`, transcripts received,
    warmup fired with interest `roblox`; no Deepgram HTTP 400, no
    `voice_unavailable`, no backend crash.
  - Failure mode: `Say again. Blue.` reached Kids Brain and classified as
    `social_speech` via `timeout_fallback`, so no progression.
  - Local fix:
    `backend/src/ws/kids-stt-correction.ts` extracts target only from confirmed
    `say again` + trailing target word(s), preserving the broad multi-word guard.
  - Tests:
    `cd backend; npx vitest run src/ws/__tests__/phase-21-kids-stt-target-word-correction.test.ts --reporter=dot --silent`
    -> exit 0; 34 tests passed.
    `cd backend; npx tsc --noEmit` -> exit 0.
    `cd backend; npx vitest run src/kids-brain src/ws/__tests__/phase-21-kids-stt-target-word-correction.test.ts src/voice/__tests__/kids-stt-config-parity.test.ts src/voice/__tests__/stt-deepgram-options.test.ts --reporter=dot --silent`
    -> exit 0; 45 files passed; 1544 tests passed.
    `cd backend; npm test -- --reporter=dot --silent`
    -> exit 0; 64 files passed; 2127 tests passed.

**Steps:**
  1. Commit the product fix plus workflow evidence with targeted `git add`.
  2. Push `main` to `origin/main`.
  3. Wait for Railway backend service `aiteacher` to deploy the new commit to
     `SUCCESS`.
  4. Verify `/health` returns HTTP 200 with PostgreSQL and Redis OK.
  5. Inspect production logs for startup errors and for the correction marker
     `method=teacher_echo_target_suffix` after the user/manual retest.
  6. Ask for or run live Kids mic retest: say `blue` after the retry prompt and
     verify the lesson progresses instead of looping on warm redirect.
  7. Update workflow evidence. If production is clean but manual mic retest is
     still required, stop under AGENTS stop rule 4 with exact retest steps.

**Success criterion:**
  New commit deployed on Railway backend; health OK; no critical production
  startup/log errors; live retest either verifies `Say again. Blue.` normalizes
  to `blue` and progresses, or the remaining manual verification step is
  explicitly recorded as the only blocker.

**Rollback criterion:**
  If deploy causes critical backend errors, revert the product commit and push,
  or deploy previous known-good commit per Railway rollback procedure.

---

### Phase-advance rule (ALWAYS included after REVIEW tasks)
After a REVIEW PASS, Goal Executor MUST:
1. Mark phase complete in `GLOBAL_GOAL.md` phase table
2. Append completion entry to `GOAL_PROGRESS.md`
3. Detect next NEXT or PENDING phase from `GLOBAL_GOAL.md`
4. Write that phase's CODE task here
5. Continue immediately - no user confirmation required
