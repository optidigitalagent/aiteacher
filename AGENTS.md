# Codex Repository Instructions

## Purpose

This repository uses **Codex Automation V2**. Codex owns intake, planning,
phase execution, testing, review, repair, tracking, recovery, and automatic
phase advancement. The user supplies outcomes, approvals, and unavailable
credentials; the user is never a prompt courier between roles or phases.

Codex-owned workflow files live under `.codex/`. The `.claude` directory is an
unchanged source reference and must not be rewritten by Codex maintenance.

## Authority

Apply instructions in this order:

1. The user's current request.
2. This `AGENTS.md`.
3. Relevant architecture and product documentation.
4. `.codex/workflow/GLOBAL_GOAL.md` and reconstructed active-goal state.
5. The selected role skill under `.codex/skills/`.
6. `.codex/rules/`.

Follow the higher authority when documents conflict. Record material workflow
or architecture decisions in `.codex/workflow/DECISIONS.md`.

## Automation V2 Entry Points

The normal user inputs are:

- `Continue.` — reconstruct state and resume the single correct next action.
- A rough idea — run `.codex/workflow/IDEA_INTAKE.md`, turn the idea into a
  concrete goal, acceptance criteria, phases, risks, and one next action, then
  begin execution.
- An explicit scoped request — reconcile it with active state, update the goal
  if needed, and execute it.

No launch prompt, reviewer prompt, role-output copy, or phase handoff is
required from the user. Codex reads role skills directly and persists handoffs
in `.codex/workflow/`.

## Mandatory Session Reconstruction

Before planning, editing, testing, reviewing, deploying, or responding to
`Continue.`, follow `.codex/workflow/RECOVERY_AFTER_INTERRUPTION.md`:

1. Inspect `git status --short --untracked-files=all`.
2. Inspect recent commits and the current branch/HEAD.
3. Read, in order:
   - `.codex/workflow/GLOBAL_GOAL.md`
   - `.codex/workflow/GOAL.md`
   - `.codex/workflow/GOAL_PROGRESS.md`
   - `.codex/workflow/NEXT_ACTION.md`
   - `.codex/workflow/RISK_REGISTER.md`
   - `.codex/workflow/DECISIONS.md`
   - `.codex/workflow/REVIEW_REPORT.md`
4. Inspect relevant source, tests, diffs, and commit evidence before trusting a
   tracking claim.
5. Reconcile stale tracking against repository evidence. Code and git prove
   what exists; tests and reviews prove what is verified; acceptance criteria
   determine completion.
6. Write a recovery checkpoint when state was stale, interrupted, or
   ambiguous. Never repeat completed work merely because a prior session ended.

## Idea Intake and Planning

Use `.codex/workflow/IDEA_INTAKE.md` for a rough idea. Codex must:

1. Reconstruct current state and inspect relevant code and documentation.
2. Create or update `GLOBAL_GOAL.md` and `GOAL.md`.
3. Write observable, testable acceptance criteria.
4. Plan ordered, independently verifiable phases.
5. Record risks, constraints, dependencies, and material decisions.
6. Write exactly one concrete task to `NEXT_ACTION.md`.
7. Continue into the autonomous loop without asking the user to write a
   technical prompt.

## Autonomous Phase Loop

Follow `.codex/workflow/AUTONOMOUS_LOOP.md`:

```text
reconstruct → intake/plan if needed → execute → test → review
→ fix failures → retest → rereview → checkpoint → mark phase complete
→ select next phase → continue
```

Use the smallest relevant skill. Execute role checklists sequentially in the
current Codex session unless the user explicitly requests delegation or
parallel agents. Role transitions happen through repository evidence and
tracking files, never through user copy/paste.

After every state transition, update `GOAL_PROGRESS.md` and
`NEXT_ACTION.md`. Update `RISK_REGISTER.md`, `DECISIONS.md`,
`REVIEW_REPORT.md`, and `DEPLOYMENT_CHECKLIST.md` when affected. Keep exactly
one next action, including when blocked.

## Mandatory Review Gates

Follow `.codex/workflow/REVIEW_GATE.md`. Every phase gate must assess each of
these roles and record either `RUN` or `NOT APPLICABLE` with a concrete reason:

- backend reviewer
- frontend reviewer
- curriculum reviewer
- kids safety monitor
- QA tester
- acceptance auditor

QA is mandatory after implementation. The acceptance auditor is mandatory
before goal completion. Other roles are mandatory when their surface is
affected; applicability may not be silently omitted. A failing gate returns to
the repair loop and is rerun after fixes.

## Stop Rules

Continue automatically until one of these conditions is true:

1. Required credentials or secrets are unavailable.
2. A paid deployment or paid-service mutation needs approval not already
   granted by the current request.
3. A destructive action needs explicit approval.
4. Manual production verification is required.
5. The same task has failed three materially different repair attempts.
6. The acceptance auditor verifies the goal complete.

Phase completion, test failure, review failure, a dirty worktree, missing
non-secret context that can be discovered locally, or a session boundary are
not stop conditions. Preserve unrelated user changes and work around them.

## Work Rules

- Inspect relevant code and tests before planning or editing.
- Keep changes within the user's requested scope.
- Do not claim completion without direct evidence.
- Record exact commands, exit codes, counts, and material output.
- Distinguish verified facts, assumptions, pre-existing failures, and
  unverified production state.
- Treat deployment and production mutations according to
  `.codex/workflow/DEPLOYMENT_GATE.md`.
- Never commit secrets or `.env` files.
- Never force push, destructively reset, or use broad staging such as
  `git add .`.
- Do not use web search unless the user explicitly authorizes external
  research. Prefer repository files and installed local documentation.

## User Operating Preferences

When making project changes, work autonomously end to end within the current
request.

- After changes, run all necessary tests and checks. Use the repository agents
  or role skills when the workflow provides them.
- If checks pass and deployment is in scope, deploy without waiting for a
  separate reminder, subject to the stop rules and deployment gate.
- After deployment, verify that the new version is running and has no observed
  startup or health-check errors.
- Keep final responses short. Include only what was done, files changed, tests
  and results, deployment target and status, what the user must manually check,
  and known remaining issues.
- Assume future requests may arrive in a new chat or terminal. At the end of
  every completed task, include a compact handoff report for the next chat.

Use this handoff format:

```text
### Отчёт для следующего чата

**Задача:**
<кратко, что требовалось сделать>

**Что сделано:**
<краткий список изменений>

**Изменённые файлы:**
<точные пути основных изменённых файлов>

**Важные технические решения:**
<как реализовано и что важно не сломать>

**Тесты и проверки:**
<команды, результаты тестов и ручных проверок>

**Деплой:**
<платформа, сервис, ветка, commit и результат деплоя>

**Текущий статус:**
<что полностью работает>

**Что осталось:**
<незавершённые задачи, проблемы или ручные проверки>
```

## Autonomous Product Delivery V3

For product-facing work, Codex must treat the Telegram intake-orchestrator and
`.codex/workflow/ORCHESTRATION_BRIEF.md` as the front door for new rough ideas.
The user should talk to one orchestrator; Codex owns the downstream specialist
chain.

Before implementation, Codex must ensure the goal has:

- a scenario matrix with happy, negative, adversarial, live-evidence, and
  failure-definition paths;
- explicit affected surfaces and protected surfaces;
- a developer-reminder checkpoint before CODE tasks;
- blocking QA, adversarial product critic, live QA, failure analysis when
  failures occur, and final acceptance audit.

If production/manual smoke reveals defects outside the active goal or if the
current next action proves behavior not listed in acceptance criteria, rebase
the goal before repairing code. A deployment health check or local unit test
does not prove a user-facing outcome without running-product evidence.

## Product Guardrails

- Do not touch billing, payment, or authentication logic unless explicitly in
  scope.
- Do not touch Kids Brain behavior unless explicitly in scope.
- Do not touch STT/TTS configuration unless explicitly in scope.
- Do not edit `docs/master-prompt.md` directly; follow the prompt-change
  workflow and its review requirements.
- Preserve curriculum authority: personalization may affect presentation, not
  target content, accepted answers, scoring, progression, or escalation.
- Apply `.codex/rules/backend.md` to backend TypeScript work.
- Apply `.codex/rules/ai-prompts.md` to prompt-related work.

## Validation and Completion Evidence

Choose checks proportionate to the affected area. For backend TypeScript
changes, the default gates are:

```text
npx tsc --noEmit
npm test
```

Do not describe pre-existing failures as new. When deployment is in scope,
follow `DEPLOYMENT_GATE.md` and `DEPLOYMENT_CHECKLIST.md`.

Every phase-complete, blocked, or goal-complete report must include:

- files changed and the purpose of each change;
- exact tests/checks run and exact results;
- review roles, applicability, verdicts, and findings;
- commit SHA(s), or explicitly `no commit created`;
- remaining risks and unverified production state;
- the exact next action, or the exact stop condition.

Before handing off:

1. Run `git status --short --untracked-files=all`.
2. Run `git diff --check`.
3. Review the changed-file list and confirm scope.
4. Persist the latest checkpoint so `Continue.` can resume without repetition.

## Workflow Maintenance

Run `.codex/scripts/sync-from-claude.ps1` from the repository root only after
intentional `.claude` workflow changes. The script never modifies `.claude` or
product code and preserves Automation V2-owned workflow contracts and skills.
