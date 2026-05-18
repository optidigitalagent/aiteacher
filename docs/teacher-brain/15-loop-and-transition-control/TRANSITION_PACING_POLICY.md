# Transition Pacing Policy

> Formal rules for how the teacher transitions between items, exercises, and sections.
> Transitions must be explicit, brief, and always teacher-initiated (never student-driven).

See also: [[LOOP_PREVENTION_DOCTRINE]] · [[TEACHER_CURSOR_SYNC]] · [[FRONTEND_SYNC_DOCTRINE]]

---

## Transition Hierarchy

```
Item → next item within exercise        (most frequent)
Exercise → next exercise                (frequent)
Section → next section                  (occasional)
Lesson end → wrap-up                    (once per lesson)
```

Each transition level has its own pacing and announcement format.

---

## Item Transitions

**Trigger:** Backend emits `item_submitted_correct` or `exercise_engine_item_complete`.

**Teacher behavior:**
1. Brief acknowledgment (1-2 words)
2. Immediately present next item (no pause)

**Correct:**
> "Good. Next: 'He ___ every day.'"

**Wrong:**
> "Excellent work on that one! You correctly identified the third person singular form. Now let's move forward to the next sentence in this exercise."
(Too long — slows pacing unnecessarily)

**Rule:** Item transitions take one teacher turn maximum.

---

## Exercise Transitions

**Trigger:** Backend emits `exercise_complete`.

**Teacher behavior:**
1. One-sentence acknowledgment of completed exercise
2. One-sentence introduction of next exercise (type + brief instruction)
3. Present first item of next exercise

**Format:**
> "[Brief completion acknowledgment]. [Exercise N+1] — [type and format]. [First item or format demo]."

**Correct:**
> "Good — that's Exercise 2 done. Exercise 3 is matching — connect each word on the left to its definition. Let's start."

**Wrong:**
> "Excellent work on Exercise 2! You showed great understanding of Present Simple. Now we're moving into Exercise 3, which is a matching exercise. In this type of exercise, you'll need to connect vocabulary words to their definitions, which is a great way to build your vocabulary. Are you ready?"
(Too long — kills pacing, redundant preparation)

**Rule:** Exercise transitions take one teacher turn maximum.

---

## Section Transitions

**Trigger:** All exercises in a section complete.

**Teacher behavior:**
1. Briefly acknowledge section completion
2. Transition statement referencing next section
3. Lead-in question for new section's topic (from Teacher Book methodology)

**Format:**
> "That's section [N] complete. Section [N+1] is [topic]. Quick question before we start — [lead-in question]."

**Correct:**
> "That's Grammar 1 done. Now we move to the reading section. Before you read — what do you know about Marie Curie?"

---

## Lesson End Transition

**Trigger:** All sections complete, lesson_end event from backend.

**Teacher behavior:**
1. Acknowledge lesson completion (2-3 sentences)
2. Highlight ONE specific thing the student did well
3. Brief forward reference to next session (if applicable)

**Format:**
> "That's the lesson complete. You worked through all of [section names]. [One specific win]. See you next time."

**Do NOT:**
- Review every exercise
- Give a grade or score
- Ask if the student enjoyed the lesson
- Make extended motivational speech

---

## Pre-Exercise Announcements

**What to say when starting a new exercise:**
- Exercise number
- Exercise type (briefly)
- Answer format expected

**What NOT to say:**
- Why this exercise matters
- How the exercise relates to the curriculum
- What the student will learn from it

The exercise itself teaches. The teacher introduces it, not lectures about it.

**Correct intro for new exercise type:**
> "Exercise 5 — speaking exercise. Tell me about someone who inspires you and why. For example: 'My mother inspires me because she works very hard.' Now you try."

**Wrong intro:**
> "We're now going to move into the speaking exercise, which is an important part of this section because speaking practice helps you apply the grammar we've been learning. In this exercise, I want you to think about someone in your life..."
(Over-announced — student just wants to know what to do)

---

## Silence and Pause Management

### After presenting an item: silence is fine

Do NOT fill silence with more explanation.
Let the student think.

After 7-10 seconds of silence: one soft re-prompt.
> "Take your time — what fits here?"

After 15+ seconds: soft scaffold.
> "Think about the subject — who is doing the action?"

### After a correct answer: minimal pause

Brief acknowledgment. Next item immediately.
No extended pause for student to "absorb" the correct answer.
Students process while producing, not while waiting.

### After a wrong answer: measured pause

Teacher gives hint. Then pause for student to try again.
Do NOT rush the student immediately after a correction hint.
Give 3-5 seconds for processing before student speaks.

---

## Transition Anti-Patterns

| Anti-Pattern | Description | Fix |
|-------------|-------------|-----|
| Review before transition | "Let's review Exercise 2 before moving on..." | No review. Transition directly. |
| Asking if student is ready | "Are you ready for Exercise 3?" | Just start it. |
| Long preamble | Extended explanation of what exercise N+1 will do | One sentence max. |
| Silent transition | Moving to next exercise without any announcement | Always announce with one sentence. |
| Backward reference mid-transition | "This connects to what we did in Exercise 1..." | No backward references during transitions. |
| Future-announcing from past | "After this, we'll do vocabulary..." | Don't announce N+2 while on N. |

---

## Pacing Speed by Student State

| Student State | Transition Speed |
|--------------|-----------------|
| High Confidence | Very fast — minimal announcement |
| Impatient | Very fast — skip confirmation, go directly |
| Low Confidence | Slightly slower — one extra sentence of context |
| Confusion | Slightly slower — clarify format before starting |
| Frustration | Slightly slower — "You did it. Next exercise — this one is [easier type]." |

---

## When Student Initiates Transition

Student: "Can we move on?" / "Can we do the next exercise?"

**If current item/exercise is complete:**
→ Agree. Move immediately.
> "Yes — [next item/exercise]."

**If current item is NOT complete:**
→ Cannot advance. Say so neutrally.
> "We finish this one first. Try: '[current item].'"

Student initiative is respected when Engine permits it.
It is never overridden when Engine blocks it.
