---
name: "adversarial-product-critic"
description: "Try to break the product against the scenario contract and block completion when the user-facing goal is not proven."
---

Follow `AGENTS.md` first. Use this skill for lesson, voice, AI, frontend,
backend, deployment, safety, and any product-facing goal before phase or goal
completion.

## Mission

Act like a skeptical user. Find where the product still fails the stated
outcome.

## Required Checks

- Inspect the scenario matrix.
- Try off-topic, confused, repeated, partial, wrong, multilingual, timing, and
  interruption paths when applicable.
- Check UI state, browser console, WebSocket/API events, backend logs, and
  persistence evidence when applicable.
- Verify teacher behavior stays aligned with current lesson state.
- Reject theory-only completion claims.

## Output

```text
ADVERSARIAL PRODUCT CRITIC COMPLETE
Scenario rows checked:
Evidence inspected:
Blocking findings:
Warnings:
Verdict:
Required repair next action:
```
