# Pedagogical Retry Policy

> Retry philosophy, max-attempts rules, and anti-loop safeguards.

See also: [[AI_TEACHER_DOCTRINE]] · [[SOFT_SPEAKING_PROTOCOL]] · [[KNOWN_RUNTIME_FAILURES]]

---

## Core Principle

**Retries are pedagogical, not robotic.**

A robotic retry: same prompt repeated until student gives exact answer.
A pedagogical retry: targeted repair of one missing element, then accept and move forward.

**Loops are a failure of pedagogy, not a sign of rigor.**

---

## Retry Hierarchy

```
Attempt 1: Original prompt (from instruction)
Attempt 2: Targeted repair prompt (one missing slot / one specific error)
Attempt 3: Soft accept if content is substantive, correct with note
Attempt 4+: NEVER. Accept and move forward.
```

**After 3 genuine attempts: accept with repair note and advance.**

---

## Repair One Thing at a Time

Never correct multiple issues simultaneously.

Example — student answer has:
- Missing reason slot
- Broken grammar ("he inspire me")

Do NOT:
> "You need to use the correct verb form 'inspires' and also add a reason with 'because'."

DO:
> "Good idea. Now say it like this: 'He inspires me because ...' Now you try."

Fix the structure first. If reason still missing after fix, then address reason.

---

## Soft Speaking Max Attempts Policy

| Condition | Result |
|-----------|--------|
| `attemptCount >= 3` AND all required slots present AND `semWords >= 2` | `acceptable_with_repair` → advance |
| `attemptCount >= 3` AND pure filler | `acceptable_with_repair` → advance |
| Missing required slots at any attempt count | BLOCK progression (no slot bypass) |

The max-attempts soft-accept is an **anti-loop** safeguard, not a reward for failure.
It fires ONLY when required slots are present.
Students cannot bypass slot requirements by attempting 3 times.

---

## Deterministic Exercise Retry

The correction ladder A/B/C/D is the retry policy for deterministic exercises.
It is driven by backend CORRECTION STATE, not attempt count.

| Turn | Hint Intensity |
|------|---------------|
| A | Light hint — different angle than presentation |
| B | Stronger hint |
| C | Partial answer given |
| D | Full answer + explanation + ask to repeat |

After TURN D repeat:
- Confirm once ("Right.")
- Advance immediately
- Never ask to repeat again

See [[GRAMMAR_FILL_PROTOCOL]] for full correction ladder.

---

## Anti-Loop Rules

| Loop Type | Prevention Rule |
|-----------|----------------|
| Same wrong answer twice | Change hint framing — different angle |
| Speaking exercise third attempt | Accept after second attempt unconditionally |
| Generic discussion loop | Accept response ≥ 3 semantic words |
| Readiness intent loop | Guard in lesson-ws before validation — never reaches retry |
| Post-transition retry | Completed exercises are hard-closed — no retry possible |

---

## Retry Language

**Forbidden retry language:**
- "That's wrong, try again."
- "No, that's incorrect."
- "Try again." (without any hint)

**Required retry language:**
- "Not quite. [one specific hint]. Try again — [item text]."
- "Good start. [repair for missing slot]."
- "Almost. [different angle hint]. Try again — [item text]."

Every retry must:
1. Be non-punitive in tone
2. Target one specific issue
3. End with "Try again — [item text]" for deterministic exercises

---

## When to Accept Despite Imperfection

| Situation | Action |
|-----------|--------|
| All slots present + broken grammar | Accept + grammar repair note |
| All slots present + pronunciation approximation | Accept + pronunciation note (optional) |
| Attempt ≥ 3 + all slots present | Accept + "well done for trying" |
| Attempt ≥ 3 + filler only | Accept (soft) + move on |
| Correct semantic content + minor grammar | Accept + correct grammar once |

**The goal is progression with learning, not blocking until perfect.**

---

## What Never Justifies an Extra Retry

- Teacher preference for more elaborate answer
- Pronunciation accuracy (unless it's the explicit exercise goal)
- Grammar accuracy in soft speaking (unless breaks communication)
- Accent or regional variation
- Student anxiety / slow response time

When in doubt: accept and move forward.
