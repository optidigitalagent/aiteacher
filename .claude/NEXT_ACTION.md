# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** RUN ACCEPTANCE AUDIT
**Type:** REVIEW
**Agent:** acceptance-auditor
**Description:**
  The previous executor run declared "GOAL COMPLETE" without an independent
  acceptance-auditor verdict. That declaration is not valid.

  Run the acceptance-auditor agent against GLOBAL_GOAL.md and produce an
  evidence-based verdict before any GOAL COMPLETE claim can stand.

**Inputs:**
  - `.claude/GLOBAL_GOAL.md` — extract every acceptance criterion verbatim
  - `.claude/GOAL_PROGRESS.md` — history to cross-check claims
  - `.claude/RISK_REGISTER.md` — accepted risks that may affect criteria
  - `.claude/DECISIONS.md` — architectural decisions affecting scope
  - Relevant source files, test results, production logs, commit SHAs

**Invocation:**
  ```
  Read .claude/agents/acceptance-auditor/AGENT.md.
  Act as acceptance-auditor. Audit the current GLOBAL_GOAL against all evidence.
  Produce the full Acceptance Auditor Report. Update REVIEW_REPORT.md and
  NEXT_ACTION.md per your output rules. Return your final verdict.
  ```

**Success criterion:**
  REVIEW_REPORT.md contains a completed Acceptance Auditor Verdict section
  with either GOAL COMPLETE or GOAL NOT COMPLETE, each criterion rated
  individually with cited evidence.

**Blocker:**
  None expected — all evidence is local (files, git log, test output).

---

## INSTRUCTIONS FOR GOAL EXECUTOR

After completing any task:
1. Check all acceptance criteria in GLOBAL_GOAL.md
2. If criteria remain unsatisfied → write the next concrete task here
3. If all criteria satisfied → write "GOAL COMPLETE" and notify user
4. If blocked after 3 attempts → write "BLOCKED: <reason>" and notify user

---

## TEMPLATE FOR NEXT TASK ENTRY

```
## CURRENT NEXT ACTION

**Task:** <short name>
**Type:** CODE | TEST | REVIEW | DEPLOY | RESEARCH | PLAN
**Agent:** goal-executor | planner | implementer | backend-reviewer |
           frontend-reviewer | curriculum-reviewer | qa-tester |
           production-log-analyzer | deploy-railway
**Description:**
  <what exactly to do — concrete, not vague>

**Inputs:**
  - <files to read>

**Success criterion:**
  <how to verify the task is done — testable, not vague>

**Blocker:**
  <what could block this, or "None expected">
```
