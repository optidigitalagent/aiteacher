# Mentium Kids Brain v1 — Phase 8.7: Real Child Readiness Audit

## Goal

Determine whether Mentium Kids Brain v1 is safe and behaviorally ready to test with a real child prototype.

This is an audit only.

Do NOT implement fixes.
Do NOT modify runtime.
Do NOT modify frontend.
Do NOT modify WebSocket.
Do NOT deploy.
Do NOT enable USE_KIDS_BRAIN_V1.

## Source of Truth

Read:

- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-spec.md
- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-patch-1.1.md
- docs/kids-brain-v1/implementation/phase-8.5-ai-qa-simulation-report.md if it exists
- docs/kids-brain-v1/implementation/phase-8.5-bug-analysis.md
- backend/src/kids-brain/
- backend/src/ws/lesson-ws.ts

## Audit Focus

Evaluate whether the current system is ready for a supervised real-child prototype using only synthetic animal content:

- cat
- dog
- lion
- monkey
- elephant
- tiger

Do NOT evaluate curriculum completeness.

There is no textbook yet.

Evaluate only:

- teacher behavior
- recovery logic
- emotional safety
- response quality
- progression stability
- session flow
- risks during real use

## Required Checks

### 1. Teacher Behavior

Check:

- Are responses short enough for 6–7?
- Are responses short enough for 8–9?
- Does the teacher avoid shame?
- Does the teacher avoid “wrong”?
- Does the teacher avoid grammar explanations?
- Does the teacher stay English-first?
- Are greetings and closings child-friendly?
- Are praise phrases varied enough?

### 2. Recovery Logic

Check:

- wrong answers
- repeated wrong answers
- silence
- “I don’t know”
- L1 answers
- refusal
- emotional shutdown
- unsafe input

For each, verify:

- recovery activates
- child is not punished
- teacher provides an easier path
- session does not advance incorrectly

### 3. Progression Logic

Check:

- correct answers advance appropriately
- repeated-after-teacher does not inflate mastery
- fast guessing does not inflate mastery
- L1-only responses do not count as English production
- lesson does not close after failure without easiest win

### 4. Real-Child Risks

Identify:

- teacher loops
- repetitive praise
- too much “try again”
- confusing prompts
- missing target word
- no visual fallback
- overuse of L1
- underuse of L1 rescue
- silence dead-ends
- forced-choice confusion
- unsupported activity transitions

### 5. Runtime Risks

Check:

- feature flag fallback
- Redis session persistence
- missing profile fallback
- no duplicate TTS
- no frontend-breaking WS messages
- old kids-runtime fallback remains available
- adult runtime untouched

### 6. QA Test Coverage

Review:

- kids-brain tests
- QA simulation test
- Phase 8.6 fixes

Identify missing tests that should exist before enabling the flag.

## Output

Create:

docs/kids-brain-v1/implementation/phase-8.7-real-child-readiness-audit-report.md

Include:

1. Executive Summary
2. Readiness Score 0–100
3. Ready / Not Ready Verdict
4. Top 10 Risks
5. Critical Blockers
6. Non-Blocking Issues
7. Required Fixes Before Real Child Test
8. Recommended Fixes After First Prototype
9. Missing Tests
10. Final Recommendation

Verdict must be one of:

- READY FOR SUPERVISED REAL-CHILD PROTOTYPE
- NOT READY FOR REAL-CHILD PROTOTYPE

## Commands

Run:

cd backend

npx tsc --noEmit

npx vitest run src/kids-brain

Do not require full global test suite because tests/fsm.test.ts has a known unrelated process.exit failure.

## Output Required In Chat

Report:

- files created
- commands run
- readiness score
- blockers
- final verdict