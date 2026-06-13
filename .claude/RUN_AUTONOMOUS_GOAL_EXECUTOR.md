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
and iteration loops.

Auto-advance through phases: after each phase review passes, immediately
update GOAL_PROGRESS.md and NEXT_ACTION.md and begin the next phase —
do NOT stop or ask for user confirmation between phases.

Stop only when: GOAL COMPLETE (acceptance-auditor verdict), credentials
required, destructive action required, manual production verification
required, or 3 repair attempts exhausted on the same task.
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
┌─────────────────────────────────────────────────────┐
│              PHASE LOOP (repeats per phase)          │
│                                                      │
│  Implementer writes code (smallest safe change)      │
│    ↓                                                 │
│  QA Tester: npx tsc --noEmit + npm test              │
│    ↓ pass                                            │
│  Reviewer runs phase gate                            │
│    ↓                                                 │
│  ├─ PASS ──────────────────────────────────────────► │
│  │   Mark phase ✅ in GLOBAL_GOAL.md                 │
│  │   Update GOAL_PROGRESS.md                        │
│  │   Write next phase task to NEXT_ACTION.md        │
│  │   ← NO USER CONFIRMATION — loop immediately      │
│  │                                                   │
│  └─ FAIL ────────────────────────────────────────►  │
│      Fix findings → re-test → re-review             │
│      Max 3 attempts → if still failing: BLOCKED     │
│                                                      │
└──────── continue until all phases complete ─────────┘
  ↓
All phases ✅ → Acceptance Auditor runs full verdict
  ↓
  ├── GOAL COMPLETE     → final report to user → STOP
  │
  └── GOAL NOT COMPLETE → read Remaining Work section
                          → write next task to NEXT_ACTION.md
                          → continue phase loop
```

**The executor never stops between phases — it runs the full goal in one session.**

---

## When Goal Executor stops (and when it does NOT)

**Will STOP automatically:**
- `GOAL COMPLETE` — acceptance-auditor returns a passing verdict
- Credentials or secrets required (e.g., Railway env vars not set)
- Destructive database action with data-loss risk
- Manual production verification required (physical device, external QA)
- 3 repair attempts exhausted on the same failing task

**Will NOT stop for:**
- Finishing a phase (auto-advances to next phase)
- Passing a review (auto-advances to next phase)
- Fixing test failures (retries inline)
- Any number of phases remaining
- PASS WITH WARNINGS verdict (treats as PASS, logs warnings to RISK_REGISTER.md)

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
