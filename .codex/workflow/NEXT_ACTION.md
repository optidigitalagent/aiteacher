# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Phase 9 — Production flag enablement + live behavioral verification (one phase at a time)
**Type:** DEPLOY-VERIFY (external — REQUIRES USER GO-AHEAD: mutating production
  Railway env variables on a paid account is outside the autonomous-action
  boundary per GLOBAL_GOAL "HOW TO RUN")
**Phase:** Phase 9 — Deployment
**Agent:** goal-executor → deploy-railway + production-log-analyzer + acceptance-auditor

**Why this is next (acceptance-auditor verdict 2026-06-13):**
  GOAL NOT COMPLETE. Code, unit/integration tests, and the flags-OFF deploy are
  all verified (HEAD=origin/main=a637c55 deployed SUCCESS as `aiteacher`; tsc 0;
  V2 suite 284/284; full suite 2060/63 pre-existing, 0 new; /health 200; logs
  clean). The ONLY gating deficiency: all 7 KIDS_* V2 flags are OFF in production
  (verified via `railway variables --service aiteacher`), so NO V2 behavior has
  ever run in prod. This makes:
    - D2 "All feature flags tested in production" → NOT COMPLETE
    - D4 "Acceptance auditor final verdict: PASS" → NOT COMPLETE
    - D3 "no critical errors in first 10 min" → PARTIAL (only the no-op deploy)
    - all behavioral criteria (W*/E*/P*/R*/M*/T*) → PARTIAL (impl+tested, not
      prod-executed — conservatism rule).

**Description:**
  Enable the 7 feature flags ONE PHASE AT A TIME in production
  (`railway variables --service aiteacher --set KEY=true`), verifying logs +
  a live Kids voice session between each. Order (master first, then per-tier):
  1. KIDS_PERSONALIZATION_V2 (master) — verify curriculum unchanged, logs 10 min, /health.
  2. KIDS_WARMUP_ENABLED — live: W1 fires once, W2 no-interests→no-warmup,
     W4 ≤2 turns, W5 15s auto-end, W7 returns to curriculum.
  3. KIDS_INTEREST_EXAMPLES_V2 — live: E1 example in model turn, E2 ≤15 words.
  4. KIDS_INTEREST_PRAISE — live: P1 praise after CORRECT_*, P4 Lucy≠Tom.
  5. KIDS_INTEREST_RECOVERY_V2 — live ENCOURAGEMENT turn: R1/R2 + progression/
     counters unchanged (C1/C3/C4 confirmed in prod).
  6. KIDS_MICRO_DIALOGUE_ENABLED — live after ≥3 exercises: M1 fires, M3 one turn,
     M5 unscored, returns to curriculum.
  7. KIDS_TEACHER_PERSONA_V2 — live: T1/T2 distinct greeting (Lucy & Tom), T5
     same curriculum.
  After EACH enablement: production-log-analyzer confirms no critical errors in
  the first 10 min (D3). Then re-run acceptance-auditor for the FINAL verdict.

**Inputs:**
  - GLOBAL_GOAL.md "Deployment (Phase 9)" acceptance criteria (D2/D3/D4)
  - .codex/workflow/REVIEW_REPORT.md → Acceptance Auditor Verdict (revised roadmap, steps 1–10)
  - docs/kids-personalization-v2.md rollback plan (7 feature flags)
  - .codex/skills/deploy-railway, production-log-analyzer, acceptance-auditor
  - backend/.env.example (all 7 flags documented, default OFF)

**Success criterion:**
  All 7 flags enabled + live-verified in production; no critical errors in the
  first 10 min after each; every behavioral criterion (W*/E*/P*/R*/M*/T*) plus
  D2/D3/D4 verified live; acceptance-auditor FINAL verdict PASS.

**Blocker:**
  Production env mutation + live voice verification on a paid Railway account.
  The autonomous executor MUST NOT self-authorize this — surface to the user for
  go-ahead before touching prod variables.

**On PASS:** Tag release; mark Phase 9 ✅ and the global goal COMPLETE.
**On FAIL:** Roll back the offending flag to OFF (instant, no redeploy); diagnose; retry.

---

### Phase-advance rule (ALWAYS included after REVIEW tasks)
After a REVIEW PASS, Goal Executor MUST:
1. Mark phase ✅ in `GLOBAL_GOAL.md` phase table
2. Append completion entry to `GOAL_PROGRESS.md`
3. Detect next `🔲 NEXT` or `🔲 PENDING` phase from `GLOBAL_GOAL.md`
4. Write that phase's CODE task here
5. Continue immediately — no user confirmation required
