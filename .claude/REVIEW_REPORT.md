# REVIEW_REPORT.md — Internal Review Output Template

> This file is overwritten by reviewer agents after each review cycle.
> Goal Executor reads it to decide whether to proceed or fix.

---

## REVIEW METADATA

```
Review type:     BACKEND | FRONTEND | CURRICULUM | QA | FULL
Reviewer agent:  <agent name>
Reviewed at:     <timestamp>
Commit / branch: <SHA or branch name>
Files reviewed:  <list>
```

---

## VERDICT

```
OVERALL: ✅ PASS | ⚠️ PASS WITH WARNINGS | ❌ FAIL
```

> Goal Executor rule:
> - ✅ PASS → proceed to next task
> - ⚠️ PASS WITH WARNINGS → proceed but log warnings in RISK_REGISTER.md
> - ❌ FAIL → do NOT deploy, fix all ❌ items, re-run review

---

## FINDINGS

### Critical (❌ — must fix before proceeding)

| # | File | Line | Issue | Fix required |
|---|------|------|-------|--------------|
| — | — | — | — | — |

### Warnings (⚠️ — should fix, not blocking)

| # | File | Line | Issue | Recommendation |
|---|------|------|-------|----------------|
| — | — | — | — | — |

### Info (ℹ️ — no action needed)

| # | Observation |
|---|-------------|
| — | — |

---

## SECURITY CHECK

```
[ ] No API keys or secrets in changed files
[ ] No unauthenticated endpoints introduced
[ ] No billing/auth logic weakened
[ ] No raw SQL (parameterised queries used)
[ ] No console.log with sensitive data
```

---

## ARCHITECTURE CHECK

```
[ ] Backend remains authoritative (no client-side trust)
[ ] Kids Brain not bypassed
[ ] STT/TTS cost controls intact
[ ] Redis TTL set on all new lesson keys
[ ] WebSocket messages validated before processing
[ ] No new cost-leaking loops
```

---

## CURRICULUM CHECK (curriculum-reviewer only)

```
[ ] Kid's Box alignment preserved
[ ] Teacher never says "Wrong"
[ ] Socratic method intact (rule not given before student tries)
[ ] Every teacher turn ends with question or instruction
[ ] Child-friendly language (short, encouraging, simple)
[ ] Exercise completion logic correct
[ ] Escalation ladder fires on 2nd wrong answer
```

---

## TEST COVERAGE CHECK (qa-tester only)

```
TypeScript build:  <result>
Unit tests:        <X/Y pass>
New tests added:   <yes/no — what>
Regressions:       <none / list>
Pre-existing fail: <fsm.test.ts — unchanged>
```

---

## REVIEWER NOTES

> Free-form notes from the reviewer agent.

---

## NEXT STEPS FOR GOAL EXECUTOR

Based on this review:
- [ ] Fix critical findings (if any)
- [ ] Log warnings to RISK_REGISTER.md (if any)
- [ ] Proceed to deployment checklist (if PASS)
- [ ] Re-run review after fixes (if FAIL)
