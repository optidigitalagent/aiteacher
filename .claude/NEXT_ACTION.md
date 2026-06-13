# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Phase 9 — Deployment
**Type:** DEPLOY (external — requires user confirmation: paid Railway account
  + production feature-flag changes are outside the autonomous-action boundary)
**Phase:** Phase 9 — Deployment
**Agent:** goal-executor → deploy-railway + production-log-analyzer + acceptance-auditor
**Description:**
  Ship Kids Personalization V2 to production and verify it. All 7 feature flags
  ship DEFAULT OFF, then are enabled one phase at a time with verification
  between each.

  Pre-deploy (no credentials needed — can run now):
  1. Final green gate on the deploy branch: npx tsc --noEmit → exit 0;
     full suite 2060 pass / 63 pre-existing STT failures.
  2. Confirm .env.example documents all 7 flags (KIDS_PERSONALIZATION_V2,
     KIDS_WARMUP_ENABLED, KIDS_INTEREST_EXAMPLES_V2, KIDS_INTEREST_PRAISE,
     KIDS_INTEREST_RECOVERY_V2, KIDS_MICRO_DIALOGUE_ENABLED,
     KIDS_TEACHER_PERSONA_V2) — values default OFF.
  3. Confirm Phase 8 work is committed and the branch is push-ready.

  Deploy (REQUIRES USER GO-AHEAD — secrets / paid account):
  4. Railway deploy via deploy-railway skill/agent.
  5. Production verification: no critical errors in first 10 min of logs
     (production-log-analyzer).
  6. Enable flags one phase at a time in production, re-verifying logs between
     each (master KIDS_PERSONALIZATION_V2 first, then per-tier).
  7. Acceptance auditor FINAL verdict → goal COMPLETE; tag the release.

**Inputs:**
  - GLOBAL_GOAL.md "Deployment (Phase 9)" acceptance criteria
  - docs/kids-personalization-v2.md rollback plan (7 feature flags)
  - .claude/agents/deploy-railway, production-log-analyzer, acceptance-auditor

**Success criterion:**
  - Railway deploy SUCCESS; all 7 flags tested in production; no critical
    errors in first 10 min; acceptance-auditor final verdict PASS.

**Blocker:**
  Phase 9 deploy steps (4–7) need a paid Railway account + production env
  access. Per GLOBAL_GOAL "HOW TO RUN", the autonomous executor must NOT
  self-authorize secrets / paid accounts / deploys — surface to the user.

**On PASS:** Tag release; mark Phase 9 ✅ and the global goal COMPLETE.
**On FAIL:** Roll back via feature flags (set to OFF); diagnose; re-deploy.

---

### Phase-advance rule (ALWAYS included after REVIEW tasks)
After a REVIEW PASS, Goal Executor MUST:
1. Mark phase ✅ in `GLOBAL_GOAL.md` phase table
2. Append completion entry to `GOAL_PROGRESS.md`
3. Detect next `🔲 NEXT` or `🔲 PENDING` phase from `GLOBAL_GOAL.md`
4. Write that phase's CODE task here
5. Continue immediately — no user confirmation required
