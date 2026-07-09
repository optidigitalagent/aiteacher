# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Phase 9 step 2 - enable `KIDS_WARMUP_ENABLED` in production and live-verify warmups
**Type:** DEPLOY-VERIFY (external production verification)
**Phase:** Phase 9 - Deployment
**Agent:** goal-executor -> deploy-railway + production-log-analyzer + QA tester + acceptance-auditor later

**Why this is next:**
  The local Kids WS/STT test breakage is fixed and the full backend suite is
  green. The Phase 9 master flag is now live in production:
  `KIDS_PERSONALIZATION_V2=true`, `USE_KIDS_BRAIN_V1=true`.
  Railway backend deployment `44050bfb-babc-434b-9405-352b120c91e0`
  at commit `0b82f7d1c3fccf0fdaca47f898d8636cecbc4661` is `SUCCESS`.
  Health is 200 with PostgreSQL and Redis OK. Production API/WS/TTS smoke
  passed after cooldown:
  `lesson_ready`, `ai_text`, `audio_chunk`, `teacher_turn_end`, no
  `NO_CHILD_PROFILE`, no `voice_unavailable`, no `SESSION_VERIFICATION_FAILED`.

**Description:**
  Continue Phase 9 one tier at a time. The next tier is `KIDS_WARMUP_ENABLED`.
  Before enabling it, ensure a live voice/STT-capable verification channel is
  available (manual browser/microphone run or a repository-backed automated
  audio/STT smoke). Then:
  1. Set `KIDS_WARMUP_ENABLED=true` on Railway service `aiteacher`.
  2. Wait for the Railway redeploy to reach `SUCCESS`.
  3. Verify `/health` returns HTTP 200 with PostgreSQL and Redis OK.
  4. Run a live Kids voice session with a prepared child profile and interests.
  5. Verify W1/W2/W4/W5/W7 in production:
     W1 warmup fires once, W2 no-interests -> no warmup, W4 <=2 turns,
     W5 15s auto-end, W7 returns to curriculum.
  6. Run production-log-analyzer for the first 10 minutes after enablement.
  7. If clean, update workflow evidence and advance to
     `KIDS_INTEREST_EXAMPLES_V2`. If not clean, roll back only
     `KIDS_WARMUP_ENABLED=false`, diagnose, and retry.

**Latest verified evidence (2026-07-09):**
  - `cd backend; npx tsc --noEmit` -> exit 0.
  - `cd backend; npm test -- --reporter=dot --silent` -> exit 0;
    64 files passed; 2123 tests passed.
  - `railway variable set --service aiteacher KIDS_PERSONALIZATION_V2=true`
    -> exit 0.
  - `railway variables --service aiteacher` shows `KIDS_PERSONALIZATION_V2 true`
    and `USE_KIDS_BRAIN_V1 true`.
  - `curl.exe -sS -i https://aiteacher-production-cae8.up.railway.app/health`
    at `2026-07-09T07:31:16Z` -> HTTP 200; status `ok`;
    `checks.postgres=ok`; `checks.redis=ok`.
  - Voice-safe production smoke -> exit 0; `profileStatus: 201`;
    `startStatus: 200`; `messageTypes:
    ["lesson_ready","lesson_ready","ai_text","audio_chunk","teacher_turn_end"]`;
    `audioChunks: 1`; `errorCodes: []`; `voiceUnavailable: []`.

**Inputs:**
  - GLOBAL_GOAL.md "Deployment (Phase 9)" acceptance criteria (D2/D3/D4)
  - docs/kids-personalization-v2.md rollback plan (7 feature flags)
  - .codex/skills/deploy-railway, production-log-analyzer, qa-tester,
    acceptance-auditor
  - backend/.env.example (all 7 flags documented, default OFF)

**Success criterion for this next action:**
  `KIDS_WARMUP_ENABLED=true` live in production; W1/W2/W4/W5/W7 verified in a
  live Kids voice/STT session; no critical errors in the first 10 minutes after
  enablement; workflow checkpoint updated with exact evidence.

**Current blocker / stop condition:**
  Live warmup verification requires a voice/STT-capable production run, not only
  API/WS/TTS smoke. Per AGENTS stop rule 4, do not enable the next tier unless
  that manual or automated voice/STT verification channel is available.

**On PASS:** Advance to `KIDS_INTEREST_EXAMPLES_V2` production enablement.
**On FAIL:** Roll back `KIDS_WARMUP_ENABLED=false`; diagnose; retry after evidence.

---

### Phase-advance rule (ALWAYS included after REVIEW tasks)
After a REVIEW PASS, Goal Executor MUST:
1. Mark phase complete in `GLOBAL_GOAL.md` phase table
2. Append completion entry to `GOAL_PROGRESS.md`
3. Detect next NEXT or PENDING phase from `GLOBAL_GOAL.md`
4. Write that phase's CODE task here
5. Continue immediately - no user confirmation required
