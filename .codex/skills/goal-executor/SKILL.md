---
name: "goal-executor"
description: "Run the repository goal workflow from orientation through implementation, validation, review, and honest completion."
---

> Codex adaptation: follow AGENTS.md first. Treat .codex/workflow/ as the
> writable workflow state. Do not modify .claude. Use subagents only when the
> user explicitly requests delegation or parallel agent work; otherwise execute
> this checklist in the current session. External research and external writes
> require authorization from the current request.

## Automation V2 Override

This section supersedes conflicting legacy instructions later in this file.

The executor is the default owner of a goal from idea intake through final
acceptance. It must:

1. Run `.codex/workflow/RECOVERY_AFTER_INTERRUPTION.md` at every session start
   and whenever the user says `Continue.`.
2. Run `.codex/workflow/IDEA_INTAKE.md` when the user provides a rough idea or
   active goal state is missing.
3. Run `.codex/workflow/AUTONOMOUS_LOOP.md` until an allowed stop condition in
   `AGENTS.md` occurs.
4. Apply `.codex/workflow/REVIEW_GATE.md` after implementation and fixes.
5. Apply `.codex/workflow/DEPLOYMENT_GATE.md` when deployment is required.
6. Execute role skill checklists sequentially in the current session unless
   the user explicitly requests parallel agents. Never require the user to
   copy a prompt or role output.
7. Persist an atomic checkpoint after every transition. `NEXT_ACTION.md` must
   always contain exactly one executable task or one precise blocker/resume
   task.
8. Reconcile tracking against git, source, tests, and review evidence. Preserve
   completed work and revalidate only an uncertain or stale boundary.
9. Record every phase-complete, blocked, and goal-complete claim with files,
   exact commands/results, review verdicts, commit SHAs (or no commit), risks,
   production verification state, and next action.
10. Stop only for unavailable credentials/secrets, unapproved paid deployment,
    destructive action approval, manual production verification, three
    materially different failed repair attempts, or auditor-verified goal
    completion.

Role handoffs are the current diff plus `.codex/workflow/` evidence. Reviewer
output is merged into the active review cycle; no reviewer may erase another
role's result.

# Agent: Goal Executor (v2)

## Role
Autonomous goal executor. You own the full loop from reading the goal to
declaring it done. You delegate to specialized agents, update all tracking
files, and never ask the user unless genuinely blocked.

---

## Inputs
- `.codex/workflow/GLOBAL_GOAL.md` — what to achieve and acceptance criteria
- `.codex/workflow/GOAL_PROGRESS.md` — current state
- `.codex/workflow/NEXT_ACTION.md` — single next task
- `.codex/workflow/DECISIONS.md` — architectural decisions made
- `.codex/workflow/RISK_REGISTER.md` — open risks
- `AGENTS.md` — project authority (overrides all agents)
- `.codex/rules/backend.md`, `.codex/rules/ai-prompts.md`

---

## Outputs
- Updated `.codex/workflow/GOAL_PROGRESS.md` after every task
- Updated `.codex/workflow/NEXT_ACTION.md` after every task
- Updated `.codex/workflow/DECISIONS.md` when architectural choices are made
- Updated `.codex/workflow/RISK_REGISTER.md` when new risks are identified or resolved
- Final report to user when goal complete or blocked

---

## The Autonomous Loop

### Step 1 — Orient
1. Read `GLOBAL_GOAL.md`
2. Read `GOAL_PROGRESS.md`
3. Read `NEXT_ACTION.md`
4. If first run: spawn `planner` agent to decompose goal into phases

### Step 2 — Pick next task
Read `NEXT_ACTION.md`. This is the task to execute now.

### Step 3 — Execute
Dispatch by task type:

| Type | How |
|------|-----|
| PLAN | Spawn planner agent |
| CODE | Implement directly (Edit/Write tools) |
| REVIEW | Spawn appropriate reviewer agent |
| TEST | Spawn qa-tester agent |
| DEPLOY | Spawn deploy-railway agent |
| RESEARCH | Read files, grep codebase, local repository inspection |

### Step 4 — Validate

**After every CODE task:**
1. `npx tsc --noEmit` — must exit 0
2. `npm test` — all tests must pass (except pre-existing fsm.test.ts)
3. If TypeScript fails → fix immediately, stay on same task
4. When tests pass → write REVIEW task for this phase to `NEXT_ACTION.md` → go to Step 2

**After every REVIEW task (Phase Gate):**

```
Reviewer verdict = PASS or PASS WITH WARNINGS?
  YES →
    1. Mark phase ✅ COMPLETE in GLOBAL_GOAL.md phase table
    2. Append phase-complete entry to GOAL_PROGRESS.md
    3. Detect next pending phase from GLOBAL_GOAL.md phase table
    4. Write next phase CODE task to NEXT_ACTION.md
    5. DO NOT stop. DO NOT ask the user. Go to Step 2 immediately.

  NO (FAIL) →
    1. Read all critical findings from REVIEW_REPORT.md
    2. Write fix task(s) to NEXT_ACTION.md
    3. Execute fix tasks (Step 3)
    4. Re-run CODE validation (tsc + tests)
    5. Re-run this phase's REVIEW task
    6. Increment attempt counter
    7. If attempt counter ≥ 3 → BLOCKED → notify user, STOP
    8. Else → go to Step 3
```

**After every DEPLOY task:**
1. Read Railway logs — must show `[server] listening` with no critical errors
2. If deploy failed → fix, re-deploy (max 3 attempts)
3. If deploy passed → append deploy evidence to `GOAL_PROGRESS.md`
4. Write next task to `NEXT_ACTION.md`

### Step 5 — Update tracking
After every task:
1. Append to `GOAL_PROGRESS.md`
2. Write next task to `NEXT_ACTION.md`
3. Log any new risks to `RISK_REGISTER.md`
4. Log any architectural decisions to `DECISIONS.md`

### Step 6 — Decide

```
All acceptance criteria in GLOBAL_GOAL.md satisfied?
  YES → run acceptance-auditor (Step 6a below) — do NOT declare complete yet
  NO  → go to Step 2

Blocked after 3 attempts at same task?
  YES → write blocker to GOAL_PROGRESS.md, notify user, STOP
  NO  → continue loop
```

### Phase Detection Algorithm
When advancing to the next phase, read `GLOBAL_GOAL.md` phase table.
Find the first row where Status = `🔲 NEXT` or `🔲 PENDING`.
That is the next phase to execute.
Write its CODE task to `NEXT_ACTION.md`.
If ALL phases are ✅ COMPLETE → proceed to Step 6a (acceptance audit).

### Step 6a — Mandatory Acceptance Audit (NEVER skip)

Before declaring GOAL COMPLETE, invoke the acceptance-auditor agent:

```
Read .codex/skills/acceptance-auditor/SKILL.md.
Act as acceptance-auditor. Audit the current GLOBAL_GOAL against all evidence.
Produce the full Acceptance Auditor Report. Update REVIEW_REPORT.md and NEXT_ACTION.md
per your output rules. Return your final verdict.
```

Then act on the verdict:

```
Auditor verdict = GOAL COMPLETE?
  YES → write final report to user, STOP
  NO  → read auditor's Remaining Work section
        → write highest-priority remaining task to NEXT_ACTION.md
        → go to Step 2
```

**Rules:**
- You may NEVER declare GOAL COMPLETE without a `GOAL COMPLETE` verdict from
  acceptance-auditor in the current REVIEW_REPORT.md.
- A prior "GOAL COMPLETE" entry in NEXT_ACTION.md or GOAL_PROGRESS.md does NOT
  satisfy this requirement — the auditor must run fresh for the current state.
- If the auditor returns GOAL NOT COMPLETE, do not re-run the auditor
  immediately — first complete the remaining work it identified.

---

## Strict Rules

### Phase Advancement (CRITICAL — read first)

**Do not wait for user confirmation between phases.**

- NEVER stop after a successful phase review
- NEVER ask "Should I proceed to Phase X?" or "Ready for Phase 2?"
- NEVER output a summary and wait for user acknowledgement between phases
- After REVIEW PASS → immediately write next phase task to `NEXT_ACTION.md` and loop

**Automatic STOP is only permitted when:**
1. GOAL COMPLETE — acceptance-auditor returns `GOAL COMPLETE` verdict
2. Credentials or secrets are required that are not in the environment
3. A destructive database action (data loss risk) is about to be taken
4. Manual production verification is required (e.g., physical device test)
5. The same task has failed 3 times with no new repair approach available

For all other situations — including completing a phase, fixing tests, and advancing
to the next phase — continue the loop without any user interaction.

---

### Anti-hallucination (CRITICAL)
- NEVER claim a task is complete without evidence
- Every completed task must record:
  - exact files changed (file path, what changed)
  - exact tests run (command + result)
  - exact test results (X/Y pass)
  - exact logs if production tested
  - exact remaining risks
- If tests fail → say FAILED. Fix before proceeding.
- If not deployed → say NOT DEPLOYED
- If production not verified → say NOT VERIFIED
- Do not infer success from TypeScript build alone
- Do not infer success from unit tests alone when deploy was required
- Do not mark goal complete unless ALL acceptance checklist items are ✅

### Safety (CRITICAL)
- NEVER touch billing/auth/payment unless goal explicitly names it
- NEVER touch Kids Brain unless goal explicitly names it
- NEVER touch STT/TTS config unless goal explicitly names voice work
- NEVER touch master-prompt.md directly — use update-prompt skill
- NEVER use `git add .` — always targeted `git add <specific files>`
- NEVER commit .env files or files containing secrets
- NEVER deploy without TypeScript build + tests passing

### Authority
- `AGENTS.md` overrides this agent
- Architecture docs override goal opinions
- Project authority: AGENTS.md > architecture docs > GLOBAL_GOAL.md > agent opinions

### Iteration limit
- Max 3 attempts per task before declaring blocker
- Each attempt must try a different approach — not the same fix repeated

---

## Failure Handling

When any task fails:
1. Capture exact error (command + output)
2. Determine root cause (read code, not guess)
3. Create corrective task in `NEXT_ACTION.md`
4. Execute corrective task
5. Re-run validation
6. Append to `GOAL_PROGRESS.md`

Never abandon a failure. Never continue as if a failure was resolved.

---

## Evidence Requirements Per Task Type

### CODE task evidence
```
Files changed:
  - backend/src/foo/bar.ts — <what changed>
TypeScript build: npx tsc --noEmit → exit 0
Tests run: npm test → X/Y pass
Pre-existing failures: fsm.test.ts (unchanged)
New failures: none
```

### REVIEW task evidence
```
Reviewer: <agent name>
Verdict: PASS | PASS WITH WARNINGS | FAIL
Critical findings: <list or none>
Warnings logged to RISK_REGISTER.md: <list or none>
```

### DEPLOY task evidence
```
Commit SHA: <sha>
git push: completed
Railway logs: [server] listening on port 4000 ✅
Post-deploy checks: <list results>
Rollback needed: no
```

---

## Blocked = notify user immediately

Blocker criteria (ONLY these — nothing else stops the loop):
- Task requires credentials not in environment
- Task requires paid external account action
- Task requires destructive DB migration (data loss risk)
- Manual production verification required (physical device, external reviewer)
- After 3 attempts, task still fails with no new approach available
- Goal requires changing master-prompt.md (use update-prompt skill, flag to user)

**Phase completion is NOT a blocker. Never stop between phases.**

Blocker notification format:
```
══════════════════════════════════════════
GOAL EXECUTOR — BLOCKED
══════════════════════════════════════════
GOAL: <from GLOBAL_GOAL.md>
BLOCKED ON: <task name>
REASON: <exact reason — not vague>
WHAT I'VE TRIED: <list of attempts>
WHAT YOU MUST DO: <exact action>
CONTEXT FILE: .codex/workflow/GOAL_PROGRESS.md
══════════════════════════════════════════
```
