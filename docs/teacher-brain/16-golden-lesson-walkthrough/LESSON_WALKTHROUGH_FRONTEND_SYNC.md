# Golden Lesson Walkthrough — Frontend Synchronization

> Detailed walkthrough showing exact frontend state at every moment.
> Demonstrates how teacher speech must reference what is visually rendered.

Exercise: Multiple Choice — Section 1.5, Exercise 5. Student: Sofia, age 14.

See also: [[FRONTEND_SYNC_DOCTRINE]] · [[EXERCISE_RENDER_CONTRACT]] · [[TEACHER_CURSOR_SYNC]] · [[MULTIPLE_CHOICE_PROTOCOL]]

---

## Legend (Extended)

```
[FRONTEND]     — Exact visual state of student's screen
[BACKEND]      — Backend state + cursor
[TEACHER]      — Teacher speech
[STUDENT]      — Student input (voice or click)
[STT]          — Raw STT output
[VALIDATION]   — Validation result
[SYNC CHECK]   — Is teacher speech synchronized with frontend? ✓/✗
```

---

## Setup

**[BACKEND]**
```
exercise: ex2_multiple_choice
exerciseType: "multiple_choice"
items: 4
item1: {
  sentence: "She ___ to school every day.",
  options: { A: "go", B: "goes", C: "going" },
  correct: "B"
}
```

**[FRONTEND]**
```
┌─────────────────────────────────────────┐
│ Exercise 2 — Multiple Choice            │
│                                         │
│ She ___ to school every day.            │
│                                         │
│  [A] go        [B] goes    [C] going    │
│                                         │
│ Progress: 1 of 4                        │
└─────────────────────────────────────────┘
```

---

## Item 1 — Format Demonstration (New Exercise Type)

**[TEACHER]**
> "Exercise 2 — multiple choice. You'll see options A, B, C on screen. Choose the one that fits the sentence. Look at question 1 and choose."

**[SYNC CHECK]** ✓ Teacher references "options A, B, C on screen" — they ARE on screen.
Teacher does NOT read all options aloud — they are visible.

**[STUDENT]**
> "B"

**[STT]** `"b"`

**[INTERP]** → option B selected → "goes"

**[VALIDATION]**
```
option: "B"
content: "goes"
expected: "B"
result: CORRECT
```

**[BACKEND]**
```
event: item_submitted_correct
cursor: item 2
item2: {
  sentence: "I ___ my homework at the moment.",
  options: { A: "do", B: "am doing", C: "does" },
  correct: "B"
}
```

**[FRONTEND updates]**
```
┌─────────────────────────────────────────┐
│ Exercise 2 — Multiple Choice            │
│                                         │
│ I ___ my homework at the moment.        │
│                                         │
│  [A] do    [B] am doing    [C] does     │
│                                         │
│ Progress: 2 of 4                        │
└─────────────────────────────────────────┘
```

**[TEACHER]**
> "Right. Look at question 2 and choose."

**[SYNC CHECK]** ✓ Teacher says "question 2" — frontend now shows question 2.
Teacher does NOT say "the options are: do, am doing, does" — they are visible.

---

## Item 2 — Wrong Answer, Hint References Visible Options

**[STUDENT]**
> "A"

**[STT]** `"a"`

**[VALIDATION]**
```
option: "A"
content: "do"
expected: "B"
result: INCORRECT
correctionState: TURN_A
```

**[FRONTEND state unchanged]** — options A/B/C still visible

**[TEACHER]** (TURN A hint — references visible options without listing them)
> "Not A. Look at the time expression — 'at the moment'. What does that signal? Check option B."

**[SYNC CHECK]** ✓ Teacher says "check option B" — option B ("am doing") is visible on screen.
Teacher does NOT say "option B is 'am doing'" — student can see it.
Teacher DOES reference the letter — directing student to look at visible option.

**[STUDENT]**
> "B"

**[VALIDATION]** → CORRECT

**[BACKEND]**
```
cursor: item 3
item3: {
  sentence: "He ___ like football.",
  options: { A: "doesn't", B: "don't", C: "isn't" },
  correct: "A"
}
```

**[FRONTEND updates]**
```
┌─────────────────────────────────────────┐
│ Exercise 2 — Multiple Choice            │
│                                         │
│ He ___ like football.                   │
│                                         │
│  [A] doesn't    [B] don't    [C] isn't  │
│                                         │
│ Progress: 3 of 4                        │
└─────────────────────────────────────────┘
```

**[TEACHER]**
> "Good — 'at the moment' = Continuous. Question 3."

**[SYNC CHECK]** ✓ Teacher references "question 3" — frontend now shows question 3.

---

## Item 3 — Student Asks About Options Already Visible

**[STUDENT]**
> "What are the options here?"

**[TEACHER]**
> "Look at your screen — options A, B, C are there. Choose the one that fits 'He ___...' — negative form."

**[SYNC CHECK]** ✓ Teacher says "look at your screen" — options ARE on screen.
Teacher does NOT read the options — student can see them.
Teacher gives a content clue ("negative form") without reading what's visible.

**[STUDENT]**
> "A"

**[VALIDATION]** → CORRECT

**[TEACHER]**
> "Right — 'doesn't'. He/she/it uses 'doesn't'."

---

## Item 4 — Teacher References Wrong Option (BAD EXAMPLE — What Not to Do)

**[BACKEND]**
```
cursor: item 4
item4: {
  sentence: "We ___ TV right now.",
  options: { A: "watch", B: "are watching", C: "watches" },
  correct: "B"
}
```

**[FRONTEND updates to show item 4 with new options]**

**[TEACHER (WRONG behavior example)]**
> "Question 4 — 'We ___ TV right now.' Options are: A: watch, B: are watching, C: watches. What do you choose?"

**[SYNC CHECK]** ✗ WRONG. Teacher read all options aloud when they are visible on screen.
This wastes time and creates a disconnect (student reading + hearing simultaneously → cognitive overload).

**[TEACHER (CORRECT behavior)]**
> "Question 4 — look at the time expression. 'Right now' — what does that tell you?"

**[SYNC CHECK]** ✓ CORRECT. Teacher gives a content hint. Student looks at screen and selects.

**[STUDENT]**
> "B — are watching."

**[VALIDATION]** → CORRECT

**[BACKEND]**
```
event: exercise_complete
exerciseId: "ex2_multiple_choice"
```

**[FRONTEND]**
```
┌─────────────────────────────────────────┐
│ Exercise 2 — Complete ✓                 │
│ 4 of 4 correct                          │
│                                         │
│ Loading Exercise 3...                   │
└─────────────────────────────────────────┘
```

**[TEACHER]**
> "Exercise 2 done. Good — you used the time expressions correctly. Exercise 3 is next."

**[SYNC CHECK]** ✓ Teacher announces completion after backend emits exercise_complete.
Teacher does NOT say "Exercise 2 done" before the frontend updates.

---

## Critical Frontend Sync Scenarios

### Scenario A: Teacher references item that hasn't rendered yet

**[BACKEND]** cursor at item 3
**[FRONTEND]** still showing item 2 (lag)

**[TEACHER (WRONG)]**
> "Item 3: 'He ___ like football.'" [before frontend updates]

**[SYNC CHECK]** ✗ WRONG — student sees item 2, teacher says item 3 → desync confusion

**[TEACHER (CORRECT)]**
Wait 1-2 seconds for frontend update, THEN present item 3.
Or: neutral bridge "Next sentence — look at the screen."

---

### Scenario B: Teacher presents item the student has already submitted

**[BACKEND]** cursor at item 4 (items 1-3 complete)
**[TEACHER]** accidentally references item 2 (stale context)

> "Let's try item 2 again."

**[FRONTEND]** shows item 4 — item 2 is locked/complete

This is a cursor desync error. The teacher's context is stale.
Correct behavior: teacher uses only backend cursor context for item text.
Never reference an item by memory — always from current backend context.

---

### Scenario C: Multiple choice only has 3 options but teacher says "A, B, C, or D"

**[FRONTEND]** shows options A, B, C (no D)

**[TEACHER (WRONG)]**
> "Choose between A, B, C, or D."

**[SYNC CHECK]** ✗ WRONG — student looks for D, doesn't find it → confusion

**[TEACHER (CORRECT)]**
> "Look at the options on screen." OR "Choose A, B, or C."

Teacher must match the actual number of options rendered.
Backend context includes option count — use it.

---

## Frontend Sync Summary

| Teacher Action | Correct | Wrong |
|----------------|---------|-------|
| Referencing options | "Look at option B" | "Option B says 'goes'" |
| Describing options count | "Choose A, B, or C" | "Choose one of the options" (vague) OR "A, B, C, or D" (adds D that doesn't exist) |
| Announcing item | Wait for frontend to update | Reference item immediately before render |
| Exercise completion | After event fires | Before event fires |
| Reading text visible | "Find the answer in the text" | "The text says..." [summarizes it] |
| Grammar table visible | "Look at the table" | [Explains table content verbally] |
