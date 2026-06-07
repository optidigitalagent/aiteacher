# RUN_AUTONOMOUS_GOAL_EXECUTOR.md

## How to launch the autonomous goal executor

Copy and paste the prompt below into Claude Code.
Claude will work autonomously until the goal is achieved or it is blocked.

---

## LAUNCH PROMPT (paste this exactly)

```
Read .claude/GLOBAL_GOAL.md and .claude/agents/goal-executor/AGENT.md.
Act as autonomous Goal Executor. Work until the global goal is achieved
or genuinely blocked. Use all internal agents, tests, reviews, logs,
and iteration loops. Do not ask for confirmation unless secrets, paid
accounts, destructive actions, or external credentials are required.
```

---

## Before you launch

1. **Update the goal** — edit `.claude/GLOBAL_GOAL.md` if the current goal
   is outdated or you want a new objective.

2. **Check current state** — read `.claude/GOAL_PROGRESS.md` to see what
   is already done. Goal Executor will pick up where it left off.

3. **Check blockers** — read `.claude/GOAL_PROGRESS.md` for any open blockers
   that need your input before the executor can proceed.

4. **Verify env** — confirm Railway env variables are set if a deploy is
   expected. Goal Executor will flag missing env vars as a blocker.

---

## What happens when you launch

```
Goal Executor reads GLOBAL_GOAL.md
  ↓
Planner decomposes goal into phases and tasks
  ↓
Goal Executor picks first task from NEXT_ACTION.md
  ↓
Implementer writes code (smallest safe change)
  ↓
QA Tester runs: npx tsc --noEmit + npm test
  ↓
Backend/Frontend/Curriculum Reviewer reviews changes
  ↓
  ├── PASS → Deploy Railway agent checks deployment gates
  │          → git commit → git push → verify Railway logs
  │          → Production Log Analyzer checks post-deploy logs
  │          → Update GOAL_PROGRESS.md
  │          → Pick next task → repeat
  │
  └── FAIL → Fix failures → re-test → re-review → retry (max 3)
             → If still failing → BLOCKED → notify user
```

---

## What Goal Executor will NOT do without your permission

- Change `docs/master-prompt.md`
- Touch billing/auth/payment logic
- Touch Kids Brain unless goal requires it
- Run SQL migrations with data loss risk
- Change Railway env variables
- Force push to main
- Commit .env files

---

## Tracking files (read these to monitor progress)

| File | Purpose |
|------|---------|
| `.claude/GOAL_PROGRESS.md` | Full progress log |
| `.claude/NEXT_ACTION.md` | Current task |
| `.claude/DECISIONS.md` | Architectural decisions |
| `.claude/RISK_REGISTER.md` | Open risks |
| `.claude/REVIEW_REPORT.md` | Latest reviewer output |
| `.claude/DEPLOYMENT_CHECKLIST.md` | Deploy gate status |

---

## How to stop

Type in Claude Code:
```
Stop. Write current state to GOAL_PROGRESS.md and summarize what is done and what remains.
```

---

## How to change the goal mid-run

1. Edit `.claude/GLOBAL_GOAL.md`
2. Type: `Read the updated GLOBAL_GOAL.md and adjust the plan accordingly.`
3. Goal Executor will re-read, update the phase plan, and continue.

---

## Recommended Claude launch command

```
claude --dangerously-skip-permissions
```

Or in standard mode — Claude will prompt for approval on file writes,
shell commands, and git operations. Approve each category once.
