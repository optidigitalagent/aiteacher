# Demonstration Protocol

> Formal doctrine for how exercises must be demonstrated before student production.
> One clean example. Not zero. Not three.

See also: [[AI_TEACHER_DOCTRINE]] · [[TEACHER_BOOK_PEDAGOGICAL_ANALYSIS]] · [[GRAMMAR_FILL_PROTOCOL]] · [[SOFT_SPEAKING_PROTOCOL]] · [[FRONTEND_SYNC_DOCTRINE]]

---

## Core Principle

**Every new exercise TYPE requires exactly one demonstration before the student attempts.**

A demonstration:
- Shows the expected answer FORMAT
- Does NOT reveal the correct answer for item 1
- Does NOT lecture on grammar
- Does NOT show multiple examples
- Synchronizes with what the frontend is currently displaying

---

## What Triggers a Demonstration

| Trigger | Action |
|---------|--------|
| First item of a NEW exercise type in the session | Full format demonstration |
| First item of the same exercise type LATER in lesson | Brief reminder only ("Same format as before — fill in one word.") |
| Student gives wrong FORMAT (not wrong answer) | Format re-demonstration (counts as hint TURN A) |
| Student asks for an example | One clean example, different from current item |

---

## What Does NOT Trigger a Demonstration

| Non-trigger | Reason |
|-------------|--------|
| New item within same exercise type | Student already knows format |
| Student gives wrong answer (correct format) | Correction, not demonstration |
| Student asks "how?" after exercise has started | Give format hint within correction ladder, not full re-demo |

---

## Demonstration Structure

A valid demonstration has exactly three parts:

```
1. Exercise name + task instruction (one sentence)
2. One complete example (different item from the current one)
3. Return to the current item
```

**Example — Grammar Fill:**
> "Exercise 3 — fill in the correct verb form. For example: 'She ___ every day' → 'walks'. Now try the first one: 'He ___ football on Sundays.'"

**Example — Soft Speaking:**
> "Exercise 5 — tell me about someone who inspires you and why. For example: 'My sister inspires me because she never gives up.' Now you — who inspires you?"

**Example — Multiple Choice:**
> "Exercise 2 — choose A, B, or C to complete the sentence. Options are on screen. For example, if you see 'He ___ (A. go / B. goes / C. going)' — the answer is B. Now look at question 1 and choose."

**Example — Subject Question:**
> "Exercise 4 — form a question from the sentence. For example: 'Someone phoned' → 'Who phoned?' — no 'did' needed. Now your sentence."

---

## Critical Rules

### Rule 1: One Example, Not Zero

The teacher NEVER skips demonstration for a new exercise type.
Even if the exercise "looks obvious" from the frontend UI.

Rationale: The student may understand the topic but not the expected production format.

### Rule 2: One Example, Not Three

Three examples signal teacher uncertainty and create cognitive overload.
The student must distill the pattern from ONE model, not a set.

### Rule 3: Never Use Item 1 as the Example

The demonstration example must be a DIFFERENT item than item 1.
Otherwise the student never attempts item 1 independently.

### Rule 4: Example Must Match Frontend State

The demonstration example must match:
- The exercise type currently rendered
- The answer format (word / sentence / letter)
- The grammar target of the section

Never demonstrate with a different grammar structure than the current section's target.

### Rule 5: Don't Explain Grammar Before the Example

The example SHOWS the expected form.
Grammar explanation (if needed) comes AFTER the student attempts and gets it wrong.

Wrong:
> "In Present Simple, we add '-s' for third person singular. So 'He goes'. Now the exercise..."

Right:
> "Exercise 3 — fill in the verb. For example: 'She goes every day.' Now: 'He ___ football.'"

---

## Demonstration vs. Correction

| Situation | Response Type |
|-----------|--------------|
| Student hasn't tried yet — new exercise | DEMONSTRATION |
| Student tried, gave wrong format | CORRECTION TURN A (format hint) |
| Student tried, gave wrong answer (correct format) | CORRECTION TURN A (content hint) |
| Student says "can you give an example?" after attempts | One new example (different from item) — counts as TURN C context |

---

## Format Synchronization with Frontend

The demonstration must assume the student can see:
- For multiple choice: the options on screen — do NOT read all options aloud
- For fill-in: the sentence with blank — do NOT re-read the full item text
- For matching: both columns — reference by letter/number not full content

Example for multiple choice:
> "Look at the options on screen — choose the one that fits. For instance, if you had 'She goes / She go / She going', the answer is 'She goes'. Now choose for question 1."

---

## Anti-Patterns

| Anti-Pattern | Impact |
|-------------|--------|
| No demonstration for new exercise type | Student produces wrong format → format confusion, not content error |
| Demonstrating with item 1 directly | Student copies teacher, never attempts independently |
| Three+ examples | Cognitive overload — student can't distill pattern |
| Grammar lecture before example | Removes guided discovery → passive recall |
| Demonstration ignores frontend state | Teacher references things student can't see or misses things they can |
| Re-demonstrating on every wrong answer | Collapses demonstration into correction → student never learns format |
