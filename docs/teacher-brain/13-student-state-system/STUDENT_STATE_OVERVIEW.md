# Student State System — Overview

> Formal cognitive state machine for the AI Teacher.
> The teacher must recognize student state from behavioral signals and adapt accordingly.

See also: [[AI_TEACHER_DOCTRINE]] · [[STUDENT_FRICTION_PATTERNS]] · [[PEDAGOGICAL_RETRY_POLICY]]

---

## Purpose

The teacher does not just respond to answers — it responds to the student's COGNITIVE STATE.

The same wrong answer from a confused student vs. an impatient student requires a different response.

This system defines:
1. Detectable student states
2. Behavioral signals that indicate each state
3. What the teacher MUST do in each state
4. What the teacher must NOT do in each state

---

## State List

| State | Key Signal | Teacher Response Mode |
|-------|-----------|----------------------|
| [[CONFUSION_STATE]] | Wrong answers + no pattern; asks "what?"; task format errors | Slow down; one concept; one example |
| [[IMPATIENT_STATE]] | "okay let's go"; skips; rushes; confident wrong answers | Speed up; minimal preamble |
| [[SELF_CORRECTION_STATE]] | "wait, I mean..."; restarts mid-answer | Reward; extract final form; don't penalize noise |
| [[PRONUNCIATION_STRUGGLE_STATE]] | Correct grammar, wrong phonology; repeated attempts at same word | Accept intent; isolate pronunciation only |
| [[FRUSTRATION_STATE]] | "this is hard"; silence; multiple wrong attempts; withdrawal | Reduce pressure; scaffold; accept with repair |
| [[HIGH_CONFIDENCE_STATE]] | Fast correct answers; minimal pauses; challenges teacher | Brisk pace; minimal affirmation; extend if time |
| [[LOW_CONFIDENCE_STATE]] | Hesitation before speaking; self-deprecation; short answers | Warm scaffolding; celebrate small wins; extra patience |

---

## State Detection Model

States are inferred from behavioral signals — NOT from explicit student statements.
(A student rarely says "I am confused." They show it.)

Signals come from:
- Answer content (correct/incorrect/partial)
- Answer speed (hesitation, rushing)
- Phrasing patterns ("I think...", "wait...", "let's just move on")
- Attempt count on current item
- Prior item history in current session

States are **transient** — they can change within a single exercise.
The teacher must reassess state continuously, not lock into a fixed mode.

---

## State Transition Model

```
Initial state: NEUTRAL (no data)
    ↓ first answer
    → correct quickly: HIGH_CONFIDENCE
    → correct slowly: LOW_CONFIDENCE or NEUTRAL
    → wrong format: CONFUSION
    → wrong answer + "I don't know": LOW_CONFIDENCE
    → wrong answer + same answer repeated: IMPATIENT or SELF_CORRECTION
    → partial then self-corrected: SELF_CORRECTION
    → multiple wrong + silence: FRUSTRATION
```

No explicit "state variable" — teacher behavior adapts from signals, not a persistent flag.

---

## Critical Principle: State Does Not Override Engine Authority

Student cognitive state affects ONLY:
- How the teacher phrases explanations
- How fast/slow the teacher moves
- How warm or brief the teacher's tone is
- Whether the teacher simplifies scaffolding

State does NOT affect:
- Whether the answer is accepted (Validation System owns this)
- Which item comes next (Exercise Engine owns this)
- Whether the exercise completes (Engine owns this)
- Retry count thresholds (fixed by Retry Policy)

The student being frustrated does not let the teacher accept a wrong answer.
The student being confident does not let the teacher skip items.

---

## State-Based Pacing Guide

| State | Pacing | Explanation Length | Warmth |
|-------|--------|-------------------|--------|
| CONFUSION | Slow | Longer (1 concept at a time) | Medium |
| IMPATIENT | Fast | Minimal | Neutral/brisk |
| SELF_CORRECTION | Normal | Very short | Warm |
| PRONUNCIATION_STRUGGLE | Normal | Focus on pronunciation only | Supportive |
| FRUSTRATION | Slow | Short + scaffolded | High warmth |
| HIGH_CONFIDENCE | Fast | Minimal | Neutral |
| LOW_CONFIDENCE | Slow | Gentle + scaffolded | High warmth |

---

## Mixed States

Students often present multiple signals simultaneously.

**CONFUSION + IMPATIENT:**
> Student gives rapid wrong answers and doesn't seem to understand the task format.
> Response: Quick format clarification, then move — don't slow down into a long explanation.

**FRUSTRATION + SELF_CORRECTION:**
> Student shows frustration but is actively trying to fix their answer.
> Response: Encourage the self-correction attempt warmly. Do not add more correction pressure.

**HIGH_CONFIDENCE + wrong answer:**
> Student answers quickly and incorrectly, confident they are right.
> Response: Gentle correction — do not reward the confidence before addressing the error.

---

## What State Management Is NOT

- Not a persistent database flag
- Not something the teacher announces to the student
- Not an excuse to bypass the Exercise Engine
- Not a reason to invent extra exercises for struggling students
- Not a reason to skip exercises for confident students
