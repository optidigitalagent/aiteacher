# Failure Analysis Contract

## Rule

When a product smoke, user report, QA test, critic, or auditor finds a failure,
Codex must run failure analysis before implementing another repair.

## Required Analysis

```text
Failure id:
Original user symptom:
Reproduction path:
Expected behavior:
Actual behavior:
Affected surfaces:
Evidence inspected:
Root cause hypothesis:
Rejected hypotheses:
Repair options:
Chosen repair:
Tests to add/update:
Live QA to rerun:
Acceptance criteria to update:
```

## Repair Loop Guard

Do not perform a third consecutive repair for the same product area without
rebasing the goal, scenario matrix, and root-cause model. Repeated "almost
fixed" reports mean the active goal is underspecified or the evidence gate is
too weak.
