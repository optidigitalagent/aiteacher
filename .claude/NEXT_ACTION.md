# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Phase 7 Implementation — Safety
**Type:** CODE
**Phase:** Phase 7 — Safety
**Agent:** goal-executor (implementer role)
**Description:**
  Verify and enforce the design Section 4 boundary contract across ALL
  personalization tiers; close the gaps the contract requires but the code
  does not yet enforce. No new features — hardening + safety tests only.

  1. Budget enforcement audit (Section 4.2) — verify each rule is enforced
     in code, add a test where missing: warmup ≤2 turns, ≤15s, once/session;
     micro-dialogue cooldown 3 / 1-per-3; 1 interest sentence per turn;
     ≤15 words per interest sentence.
  2. Fallback chain (Section 4.3) — verify per tier: no interest → null,
     no template → null, throw → catch+log(no PII)+null, budget exceeded →
     skip. Add the "result > 15 words → truncate at word boundary" fallback
     if not implemented (check whether any current template path can exceed
     it; persona open/close are exempt — they use a 20-word budget per tests).
  3. Defensive name-length cap in substituteChildName (safety-monitor note:
     name.slice(0, 100) keeps the guarantee local to the engine, today only
     enforced at the profile API).
  4. Template safety sweep: no PII, no copyrighted characters, all 5 tiers
     (warmup, example, praise, recovery, micro-dialogue) + persona texts.
  5. Error-catch tests S1–S5 for every public engine function not yet
     covered.

**Inputs:**
  - docs/kids-personalization-v2.md Section 4 (4.1 contract, 4.2 budgets,
    4.3 fallback chain)
  - personalization-engine.ts (all tiers), teacher-personas.ts
  - REVIEW_REPORT.md Phase 6 warnings (W-022..W-025 are Phase 8 scope —
    do NOT pull integration tests into Phase 7)

**Constraints:**
  - Engine + tests only; do NOT touch lesson-ws wiring unless a budget rule
    can only be enforced there (and then helper-extract — RISK-016 window
    has ~400 chars headroom).
  - No curriculum/scoring/STT/TTS changes. Flags stay default OFF.

**Success criterion:**
  - npx tsc --noEmit → exit 0; new safety tests pass; no new failures in
    full suite (baseline: 2016 pass / 63 pre-existing STT failures)

**Blocker:**
  None expected.

**On PASS (tests green):** Write Phase 7 REVIEW task here → run review gate.
**On FAIL:** Fix findings, re-test (max 3 attempts). BLOCKED only after 3 failures.

---

### Phase-advance rule (ALWAYS included after REVIEW tasks)
After a REVIEW PASS, Goal Executor MUST:
1. Mark phase ✅ in `GLOBAL_GOAL.md` phase table
2. Append completion entry to `GOAL_PROGRESS.md`
3. Detect next `🔲 NEXT` or `🔲 PENDING` phase from `GLOBAL_GOAL.md`
4. Write that phase's CODE task here
5. Continue immediately — no user confirmation required
