# Phase 9 — Controlled Rollout Supervisor

Goal:
Safely enable USE_KIDS_BRAIN_V1 for internal testing and verify one controlled Kids Brain session.

Rules:
- Do NOT change code unless a critical config issue blocks testing.
- Do NOT touch adult runtime.
- Do NOT modify frontend.
- Do NOT deploy new code.
- Use feature flag only.
- If critical errors appear, set USE_KIDS_BRAIN_V1=false and report.

Steps:

1. Verify current backend health:
- /health returns 200
- Postgres OK
- Redis OK
- migrations 018–022 applied

2. Verify environment:
- USE_KIDS_BRAIN_V1 currently false
- backend latest commit includes Kids Brain validation commit

3. Enable:
USE_KIDS_BRAIN_V1=true

4. Start one internal kids lesson.

5. Observe:
- backend logs
- browser console
- WebSocket messages
- teacher messages
- TTS behavior
- Redis session behavior

6. Test scripted child responses:
- "cat"
- wrong answer: "banana"
- L1 answer: "кот" / "кіт"
- silence if possible
- "I don't know"
- refusal: "no"

7. Verify:
- correct answer is not RANDOM_NONSENSE
- teacher does not say "wrong"
- no {target}, undefined, null
- no duplicate TTS
- Redis errors absent
- WebSocket stays connected
- adult route not affected
- session can close safely

8. If any critical issue:
- set USE_KIDS_BRAIN_V1=false
- document issue
- do not continue testing

Output report:
docs/kids-brain-v1/implementation/phase-9-controlled-rollout-report.md

Include:
- flag status
- test session ID
- responses tested
- teacher replies observed
- backend log findings
- frontend console findings
- bugs found
- rollback performed yes/no
- verdict:
  SAFE FOR MORE INTERNAL TESTING
  or
  ROLLED BACK