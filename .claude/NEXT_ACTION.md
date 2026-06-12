# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Phase 8 Implementation — Testing
**Type:** CODE (tests only — no production-code changes unless a test
  exposes a real bug; helper-extract if lesson-ws must change, RISK-016)
**Phase:** Phase 8 — Testing
**Agent:** goal-executor (implementer role)
**Description:**
  Close the carried integration-test warnings and harden the safety sweeps.

  1. Integration tests through the Kids WS layer (mock ws/meta/Redis as the
     existing wiring guard suites do):
     - W-019: ENCOURAGEMENT-rung recovery injection (turn-processor path)
     - W-020: micro-dialogue fire→reply→return; exerciseCorrectCount
       unchanged after the dialogue turn
     - W-022: session start with persona flags on → first teacher_text
       packet carries persona openingPhrase; flags off → standard greeting
     - W-023: natural close → persona closing ai_text sent BEFORE lesson_end
     - W-027: one teacher turn never carries two interest sentences
  2. Curriculum integrity C1–C6 at integration level (C6 = Kids Brain V1
     suite still green — already evidenced by the full-suite runs; assert
     explicitly in the report).
  3. W-026: extend the S3/S4 sweep regexes (surname/birthday/grade/city;
     "you're <X>", "pretend you're", "act like").
  4. W-024: pin multi-placeholder [childName] substitution directly.
  5. W-025 decision: amend design Section 3.5 to match delivered Phase 6
     scope (persona styles for warmup/recovery/micro-dialogue deferred) OR
     implement the styles. Default: amend the doc — no new features in
     Phase 8.
  6. Q4 check: interest personalization suite ≥40 tests (already 200 — assert).

**Inputs:**
  - REVIEW_REPORT.md Phase 7 FINDINGS SUMMARY (W-019..W-027)
  - existing wiring-guard suites as integration-test templates:
    src/kids-brain/analytics/__tests__/session-analytics.test.ts,
    src/kids-brain/runtime/__tests__/phase-16b-runtime-safety.test.ts
  - docs/kids-personalization-v2.md Sections 3.5, 9.7, 9.9

**Success criterion:**
  - npx tsc --noEmit → exit 0; new integration tests pass; no new failures
    (baseline: 2028 pass / 63 pre-existing STT failures)

**Blocker:**
  None expected.

**On PASS (tests green):** Write Phase 8 REVIEW task here → run review gate.
**On FAIL:** Fix findings, re-test (max 3 attempts). BLOCKED only after 3 failures.

---

### Phase-advance rule (ALWAYS included after REVIEW tasks)
After a REVIEW PASS, Goal Executor MUST:
1. Mark phase ✅ in `GLOBAL_GOAL.md` phase table
2. Append completion entry to `GOAL_PROGRESS.md`
3. Detect next `🔲 NEXT` or `🔲 PENDING` phase from `GLOBAL_GOAL.md`
4. Write that phase's CODE task here
5. Continue immediately — no user confirmation required
