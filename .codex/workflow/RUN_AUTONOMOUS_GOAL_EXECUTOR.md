# RUN_AUTONOMOUS_GOAL_EXECUTOR.md

## Automation V2 Entry Point

This section supersedes conflicting legacy launch instructions below.

No launch prompt or workflow-file editing is required.

To resume:

```text
Continue.
```

To start or change work, provide a rough idea in ordinary language:

```text
Add a student progress dashboard.
```

Codex follows `RECOVERY_AFTER_INTERRUPTION.md`, `IDEA_INTAKE.md`,
`AUTONOMOUS_LOOP.md`, `REVIEW_GATE.md`, and `DEPLOYMENT_GATE.md`. It owns
planning, implementation, testing, review, repair, tracking, and phase
advancement. The user never copies prompts or reviewer output between roles.

The only automatic stop conditions are those listed in `AGENTS.md`.

## What happens after either minimal input

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
| `.codex/workflow/GOAL_PROGRESS.md` | Full progress log |
| `.codex/workflow/NEXT_ACTION.md` | Current task |
| `.codex/workflow/DECISIONS.md` | Architectural decisions |
| `.codex/workflow/RISK_REGISTER.md` | Open risks |
| `.codex/workflow/REVIEW_REPORT.md` | Latest reviewer output |
| `.codex/workflow/DEPLOYMENT_CHECKLIST.md` | Deploy gate status |

---

## How to stop

Type in Codex:
```
Stop. Write current state to GOAL_PROGRESS.md and summarize what is done and what remains.
```

---

## How to change the goal mid-run

State the new outcome in ordinary language. Codex preserves the prior
checkpoint, updates goal state through `IDEA_INTAKE.md`, and continues. The
user does not edit workflow files or compose a technical handoff prompt.
