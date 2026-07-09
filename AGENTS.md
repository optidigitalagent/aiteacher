# Codex Repository Instructions

## Purpose

This repository uses a Codex workflow adapted from the existing `.claude`
workflow. Codex-owned workflow files live under `.codex/`. The `.claude`
directory remains an unchanged source reference and must not be rewritten by
Codex workflow maintenance.

## Authority

Apply instructions in this order:

1. The user's current request.
2. This `AGENTS.md`.
3. Architecture and product documentation relevant to the task.
4. `.codex/workflow/GLOBAL_GOAL.md` and the active goal state.
5. The selected role skill under `.codex/skills/`.
6. `.codex/rules/`.

When documents conflict, follow the higher authority and record a material
workflow decision in `.codex/workflow/DECISIONS.md`.

## Repository Workflow

For goal-driven work, read these files in order:

1. `.codex/workflow/GLOBAL_GOAL.md`
2. `.codex/workflow/GOAL.md`
3. `.codex/workflow/GOAL_PROGRESS.md`
4. `.codex/workflow/NEXT_ACTION.md`
5. `.codex/workflow/RISK_REGISTER.md`
6. `.codex/workflow/DECISIONS.md`

Use the smallest relevant skill from `.codex/skills/`. The primary workflows
are:

- `goal-executor` for an explicitly requested autonomous goal run.
- `orchestrator` for selecting a review, QA, deploy, prompt, voice, RAG, cost,
  analytics, or kids-safety pipeline.
- `planner` for decomposing a goal without implementing it.
- `implementer` for an already-scoped code task.
- Reviewer and auditor skills for evidence-based verification.

Do not invoke multiple roles merely to simulate a pipeline. Use parallel agents
only when the user explicitly requests delegation or parallel agent work and
the runtime permits it. Otherwise, execute the role checklists sequentially in
the current Codex session.

## Work Rules

- Inspect the repository and current git status before changing files.
- Preserve unrelated user changes in a dirty worktree.
- Read relevant code and tests before planning or editing.
- Keep changes within the user's requested scope.
- Do not claim completion without direct evidence.
- Record exact commands and results when updating workflow evidence.
- Distinguish verified facts from assumptions and unverified production state.
- Treat deployment, external writes, secrets, paid services, destructive
  operations, and production environment mutations as user-gated unless the
  current request explicitly authorizes them.
- Never commit secrets or `.env` files.
- Never use force push, destructive reset, or broad staging such as
  `git add .`.
- Do not use web search unless the user explicitly authorizes external
  research. Prefer repository files and installed local documentation.

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

## Validation

Choose checks proportionate to the affected area. For backend TypeScript
changes, the default gates are:

```text
npx tsc --noEmit
npm test
```

Do not describe pre-existing failures as new failures. When deployment is in
scope, also follow `.codex/workflow/DEPLOYMENT_CHECKLIST.md` and verify startup,
health, logs, and rollback readiness.

Before handing off:

1. Run `git status --short`.
2. Review `git diff --check`.
3. Review the changed-file list and confirm it matches the requested scope.
4. Report files changed, checks run, results, and remaining risks.

## Workflow Maintenance

Run `.codex/scripts/sync-from-claude.ps1` from the repository root to refresh
the adapted snapshot after intentional `.claude` workflow changes. The script
updates only generated files under `.codex/workflow`, `.codex/rules`, and
`.codex/skills`; it does not modify `.claude` or product code.
