# GLOBAL_GOAL.md — Mentium AI Teacher

## ACTIVE GOAL

**Kids Personalization V2 — STARTED 2026-06-10**

Make Kids lessons feel personally tailored to each child while keeping
Kid's Box curriculum fully authoritative.

**Previous goal COMPLETE:** Kids Mode Onboarding V1 — all 23 ACs verified (2026-06-10)
**Previous goal COMPLETE:** Kids Brain V1 — 28/28 criteria verified (Run 5, 2026-06-09)
**Tags:** kids-brain-v1-complete, kids-onboarding-v1-complete

---

## CORE RULE (IMMUTABLE)

> **Curriculum controls everything that matters educationally.
> Interests control only how the teacher talks, not what the teacher teaches.**

### What curriculum controls (CANNOT be changed by personalization):
- progression
- correctness
- target words
- exercise order
- mastery
- escalation ladder
- scoring
- accepted answers

### What interests control (ALLOWED):
- examples (context phrases during teacher model)
- warmups (1-2 turns before lesson content)
- encouragement (at ENCOURAGEMENT tier)
- recovery prompts (at ENCOURAGEMENT tier)
- micro-dialogues (1 turn between exercises, ≥3 exercise cooldown)
- imagination prompts ("Imagine a blue Minecraft block!")
- contextual references in praise
- teacher greeting style (persona-based)

---

## PHASE SEQUENCE

| Phase | Name | Status |
|-------|------|--------|
| 0 | Design | ✅ COMPLETE — docs/kids-personalization-v2.md APPROVED |
| 1 | Interest-Aware Warmups | ✅ COMPLETE — review PASS 2026-06-10 |
| 2 | Interest-Aware Examples | ✅ COMPLETE — review PASS 2026-06-10 |
| 3 | Interest-Aware Praise | ✅ COMPLETE — review PASS 2026-06-10 |
| 4 | Interest-Aware Recovery | ✅ COMPLETE — review PASS 2026-06-10 |
| 5 | Micro-Dialogues | ✅ COMPLETE — review PASS 2026-06-10 |
| 6 | Teacher Personas | ✅ COMPLETE — review PASS 2026-06-12 |
| 7 | Safety | ✅ COMPLETE — review PASS 2026-06-12 |
| 8 | Testing | 🔲 NEXT |
| 9 | Deployment | 🔲 PENDING |

---

## ACCEPTANCE CRITERIA

The goal is NOT complete until ALL of the following are satisfied:

### Warmup (Phase 1)
- [ ] Warmup fires once per session when interests are set (W1)
- [ ] Warmup does NOT fire if no interests set (W2)
- [ ] Warmup max 2 turns enforced server-side (W4)
- [ ] Warmup auto-ends after 15s (W5)
- [ ] Warmup returns to curriculum after completion (W7)

### Interest-Aware Examples (Phase 2)
- [ ] Example context appears in teacher model when interests set (E1)
- [ ] Example is ≤ 15 words (E2)
- [ ] targetWord not modified by example function (E4)

### Interest-Aware Praise (Phase 3)
- [ ] Praise fires after CORRECT_* labels (P1)
- [ ] Lucy praise measurably different from Tom praise (P4/T4)

### Interest-Aware Recovery (Phase 4)
- [ ] Recovery fires at ENCOURAGEMENT tier (R1)
- [ ] Recovery ends with target word invitation (R2)

### Micro-Dialogues (Phase 5)
- [ ] Micro-dialogue fires after ≥3 exercises (M1)
- [ ] Micro-dialogue is 1 turn only (M3)
- [ ] Micro-dialogue does NOT score the child (M5)

### Teacher Personas (Phase 6)
- [ ] Lucy and Tom greeting phrases are distinct (T1, T2)
- [ ] Both personas use same curriculum (T5)

### Curriculum Integrity (all phases)
- [ ] targetWord not modified by any V2 function (C1)
- [ ] exerciseCorrectCount not modified (C3)
- [ ] escalationLadder not modified (C4)
- [ ] Adult flow unaffected (C5)
- [ ] Kids Brain V1 28/28 criteria still pass (C6)

### QA (Phase 8)
- [ ] TypeScript build: npx tsc --noEmit → exit 0 (Q1)
- [ ] npm test → all pass, no new failures (Q2)
- [ ] Interest personalization test suite: ≥40 tests green (Q4)

### Deployment (Phase 9)
- [ ] Railway deploy successful
- [ ] All feature flags tested in production
- [ ] No critical errors in first 10 min of production logs
- [ ] Acceptance auditor final verdict: PASS

---

## CONSTRAINTS (do NOT touch unless goal explicitly requires it)

- docs/master-prompt.md — only via update-prompt skill
- billing / payment / auth logic
- Adult lesson flow (non-Kids WebSocket path)
- STT/TTS configuration (Deepgram, ElevenLabs voice IDs)
- Railway env variables — only for feature flags specified in this goal
- Kids Brain V1 exercise logic — personalization adds to, never replaces
- Kids Onboarding V1 code — personalization integrates with, never replaces
- V1 interest-personalizer.ts — extend, do not remove

---

## PERSONALIZATION HARD RULES (NOT NEGOTIABLE)

Any code review must reject violations of these rules.

**FORBIDDEN:**
- changing `targetWord` in any exercise
- changing `acceptedAnswers[]`
- changing `completionRule.type`
- changing `exerciseCorrectCount`
- changing `exerciseAttemptCount`
- changing `escalationLadder[]` items or order
- skipping curriculum steps
- using copyrighted characters as core teaching characters
- using LLM to generate interest content (templates only)
- unauthenticated usage of any Kids resource
- warmup > 2 turns
- warmup > 15 seconds
- micro-dialogue responding to child as if in open chat
- micro-dialogue > 1 turn

---

## HOW TO RUN

Paste this into Claude Code:

> Read .claude/GLOBAL_GOAL.md and .claude/agents/goal-executor/AGENT.md.
> Act as autonomous Goal Executor. Work until the global goal is achieved
> or genuinely blocked. Use all internal agents, tests, reviews, logs,
> and iteration loops. Do not ask for confirmation unless secrets, paid
> accounts, destructive actions, or external credentials are required.
