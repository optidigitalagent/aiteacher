---
name: "goal-intake-orchestrator"
description: "Turn rough user ideas, including Telegram goal packets, into measurable goals, scenario contracts, acceptance criteria, phases, and exactly one next action."
---

Follow `AGENTS.md` first. Use this skill when the user provides a rough idea,
when a Telegram goal packet is available, or when current workflow state no
longer matches the real product failure.

## Process

1. Run repository recovery.
2. Restate the user's outcome in one sentence.
3. Identify affected product surfaces: frontend, backend, voice, AI/prompt,
   curriculum, safety, auth, billing, deployment, observability.
4. Ask only the minimum user questions needed to remove risky ambiguity.
5. Write acceptance criteria observable in the running product.
6. Fill `.codex/workflow/SCENARIO_MATRIX.md`.
7. Select the agent chain and mark blocking roles.
8. Write exactly one executable next action.

## Blocking Rules

Do not enter implementation when the goal is ambiguous, the active scope
conflicts with user evidence, or no evidence source exists for an affected
surface.
