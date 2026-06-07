# NEXT_ACTION.md

> This file always contains EXACTLY ONE next task.
> Goal Executor reads this before picking what to do.
> Update immediately when the task is picked up or completed.

---

## CURRENT NEXT ACTION

**Task:** Initialize autonomous goal loop
**Type:** PLAN
**Agent:** planner
**Description:**
  Read GLOBAL_GOAL.md. Decompose into phases with acceptance criteria.
  Write phase plan into GOAL_PROGRESS.md. Write first concrete task
  back into this file (NEXT_ACTION.md).

**Inputs:**
  - .claude/GLOBAL_GOAL.md
  - .claude/GOAL_PROGRESS.md
  - CLAUDE.md
  - docs/architecture.md (if exists)

**Success criterion:**
  GOAL_PROGRESS.md has a phase plan.
  NEXT_ACTION.md contains the first implementation task (not a planning task).

**Blocker:**
  None expected.

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
