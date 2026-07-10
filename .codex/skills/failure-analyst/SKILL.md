---
name: "failure-analyst"
description: "Analyze user-reported, QA, critic, or production failures before another repair attempt."
---

Follow `AGENTS.md` first. Use this skill after any failed live QA, failed
adversarial critique, failed production smoke, or repeated user report in the
same product area.

## Process

1. Fill `.codex/workflow/FAILURE_ANALYSIS.md` for the failure.
2. Reproduce or identify the closest available evidence.
3. Separate symptom from root cause.
4. List rejected hypotheses and why they were rejected.
5. Decide whether the active goal must be rebased before repair.
6. Write one repair task tied to one acceptance criterion.
