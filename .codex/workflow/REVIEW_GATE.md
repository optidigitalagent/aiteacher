# Review Gate — Codex Automation V2

## Gate Selection

Every phase review records all roles below. Each role is either `RUN` or
`NOT APPLICABLE`, with evidence:

| Role | Run when |
|---|---|
| backend reviewer | Backend, API, database, WebSocket, server config, or shared contract changed |
| frontend reviewer | UI, frontend state, browser behavior, accessibility, CSS, or client contract changed |
| curriculum reviewer | Curriculum, exercise, teaching behavior, prompt, progression, scoring, or Kids presentation changed |
| kids safety monitor | Child-facing behavior/data, Kids flows, prompts, content, voice, or safety boundaries changed |
| QA tester | Always after implementation; owns targeted and regression evidence |
| acceptance auditor | At final goal completion, and earlier when a phase claims acceptance criteria complete |
| adversarial product critic | User-facing lesson, voice, AI, UI, browser, curriculum, safety, auth, billing, or deployment behavior changed |
| live QA orchestrator | Running-product behavior, browser workflows, WebSocket flows, voice, STT/TTS, or deployment behavior changed |
| failure analyst | Any live QA, critic, production smoke, or repeated user-reported failure is present |

If a migration, prompt, deployment, RAG, voice, cost, or production-log surface
is affected, also run its specialized skill. Applicability may not be silently
omitted.

## Execution

1. Freeze the review target: base commit, current commit, working-tree diff,
   phase, and changed-file list.
2. Read each applicable skill directly.
3. Execute applicable checklists sequentially in the current session unless
   the user explicitly requested parallel agents.
4. Store every verdict and finding in one review-cycle section in
   `REVIEW_REPORT.md`. Reviewer roles append/merge into the active cycle and
   must not erase other role results.
5. Record `NOT APPLICABLE` decisions with the changed-file evidence supporting
   them.

The user never copies a reviewer prompt or result. `REVIEW_REPORT.md`,
`GOAL_PROGRESS.md`, and direct repository evidence are the role handoff.

## Verdict

- `PASS`: all applicable roles pass and no blocking finding remains.
- `PASS WITH WARNINGS`: no blocking finding remains; warnings are recorded in
  `RISK_REGISTER.md`.
- `FAIL`: at least one blocking finding or required test fails.

On `FAIL`:

1. Write the highest-priority finding as the single next fix task.
2. Diagnose and repair it.
3. Rerun affected tests.
4. Rerun the failed reviewer and any role whose evidence changed.
5. Stop only after three materially different failed repair attempts.

## Review-Cycle Evidence

```text
Cycle ID:
Phase:
Base/current commit:
Changed files:
Role applicability:
Commands and results:
Role verdicts:
Blocking findings:
Warnings/risk IDs:
Overall verdict:
Next action:
```

Phase completion requires a passing current-cycle verdict. Goal completion
requires a fresh acceptance-auditor `GOAL COMPLETE` verdict.

For user-facing product goals, `PASS` also requires the scenario matrix and
live evidence required by `.codex/workflow/SCENARIO_MATRIX.md` and
`.codex/workflow/LIVE_QA_GATE.md`. A code review, unit test run, or deployment
health check alone is not sufficient.
