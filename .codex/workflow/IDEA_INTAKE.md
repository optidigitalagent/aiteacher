# Idea Intake — Codex Automation V2

## Trigger

Run this workflow when the user provides an outcome, problem, or rough idea
without a technical implementation plan. The user is not required to name
files, phases, tests, reviewers, or agents.

## Intake Procedure

1. Run `RECOVERY_AFTER_INTERRUPTION.md` before changing active state.
2. Restate the idea as one outcome with a clear scope boundary.
3. Inspect relevant architecture, source, tests, git history, and current
   workflow evidence. Do not plan from assumptions.
4. Determine whether the idea continues, refines, replaces, or is independent
   of the active goal.
   - Continue/refine: update the active goal without erasing valid evidence.
   - Replace: preserve the prior goal and checkpoint in `GOAL_PROGRESS.md`,
     record the change in `DECISIONS.md`, then activate the new goal.
   - Independent: order it after the active goal unless the user explicitly
     made it the current priority.
5. Create or update:
   - `GLOBAL_GOAL.md`: outcome, scope, constraints, acceptance criteria, phase
     table, and completion rule.
   - `GOAL.md`: implementation-oriented goal brief and discovered context.
   - `GOAL_PROGRESS.md`: intake checkpoint and phase plan.
   - `RISK_REGISTER.md`: concrete open risks and mitigations.
   - `DECISIONS.md`: only material interpretation or architecture decisions.
   - `NEXT_ACTION.md`: exactly one immediately executable task.
6. Enter `AUTONOMOUS_LOOP.md`. Do not stop after producing the plan.

## Goal Quality Rules

Acceptance criteria must be observable and independently verifiable. Include,
as applicable:

- required behavior and negative behavior;
- scope and non-goals;
- regression and compatibility expectations;
- security, privacy, curriculum, and child-safety constraints;
- build, test, and review requirements;
- deployment and production-verification requirements;
- rollback or recovery requirements.

Plan two to six phases by default. Each phase must have:

- a concrete outcome;
- dependencies;
- scoped implementation tasks;
- targeted and regression checks;
- applicable review gates;
- an explicit completion condition.

Unknowns that can be resolved locally become a `RESEARCH` next action. Missing
credentials, paid deployment approval, destructive actions, or required manual
production checks use the stop rules in `AGENTS.md`.

## Required Intake Checkpoint

Record:

```text
Idea received:
Goal interpretation:
Repository evidence inspected:
Goal files updated:
Acceptance criteria count:
Phases planned:
Risks opened/updated:
First next action:
Assumptions:
```

The intake is complete only when `NEXT_ACTION.md` contains one executable task
and the executor immediately begins it.
