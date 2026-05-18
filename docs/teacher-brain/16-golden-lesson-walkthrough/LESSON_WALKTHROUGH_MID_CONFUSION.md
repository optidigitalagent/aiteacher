# Golden Lesson Walkthrough — Mid-Exercise Confusion

> Student understands grammar in general but is confused about subject/object question format.
> Teacher detects format confusion (not content confusion) and responds correctly.

Student: Dima, age 15. Exercise: Subject/Object Questions (Section 2.2).

See also: [[CONFUSION_STATE]] · [[SUBJECT_OBJECT_QUESTION_PROTOCOL]] · [[DEMONSTRATION_PROTOCOL]] · [[LOOP_PREVENTION_DOCTRINE]]

---

## Legend

```
[FRONTEND]     — What is visible on the student's screen
[BACKEND]      — Backend state changes
[TEACHER]      — What teacher says (voice + chat)
[STUDENT]      — What student says (voice transcript)
[VALIDATION]   — Validation result
[STATE]        — Student cognitive state inference
```

---

## Context Setup

**[BACKEND]**
```
section: 2.2
exercise: ex5_question_formation
exerciseType: "question_formation"
items: 5
item1: { source: "Someone discovered radium.", questionFrame: "Who ___?", type: "subject_question" }
item2: { source: "Marie Curie discovered something.", questionFrame: "What ___?", type: "object_question" }
```

**[FRONTEND]**
```
"Exercise 5 — Form a question about the underlined word."
Sentence 1: "Someone discovered radium."
Underlined: "Someone"
Question frame: "Who ___?"
```

---

## Item 1 — Demonstration Needed (New Exercise Type)

**[TEACHER]** (format demonstration — new exercise type)
> "Exercise 5 — forming questions. The underlined word is what you're asking about. Example: 'Someone phoned' → 'Who phoned?' — notice: no 'did', just the verb from the sentence. Look at sentence 1: 'Someone discovered radium.' The underlined word is 'someone'. Form the question."

**[STATE]** → NEUTRAL

**[STUDENT]**
> "Who did discover radium?"

**[STT]** `"who did discover radium"`

**[VALIDATION]**
```
submitted: "Who did discover radium?"
expected: "Who discovered radium?"
type: subject_question
result: INCORRECT — unnecessary auxiliary "did"
correctionState: TURN_A
```

**[STATE]** → CONFUSION (format error — used auxiliary in subject question)

**[TEACHER]** (TURN A — target the auxiliary)
> "Good subject — 'Who'. But subject questions don't need 'did'. The verb from the sentence comes directly after 'Who': 'Who discovered...'. Try it."

**[STUDENT]**
> "Who discovered radium?"

**[VALIDATION]** → CORRECT

**[BACKEND]** → item 2 activates

**[TEACHER]**
> "Right — 'Who discovered radium?' No 'did'. Next sentence is different — watch carefully."

---

## Item 2 — Object Question (Confusion Deepens)

**[FRONTEND]**
```
Sentence 2: "Marie Curie discovered something."
Underlined: "something"
Question frame: "What ___?"
```

**[TEACHER]**
> "This one is different — the underlined word 'something' is the object, not the subject. Object questions DO need 'did'. Try: 'What did Marie Curie ___?'"

**[STATE]** → CONFUSION (switching from subject to object question rule)

**[STUDENT]**
> "What discovered Marie Curie?"

**[STT]** `"what discovered marie curie"`

**[VALIDATION]**
```
submitted: "What discovered Marie Curie?"
result: INCORRECT — wrong word order for object question
correctionState: TURN_A
```

**[STATE]** → CONFUSION (student applied subject-Q pattern to object-Q)

**[TEACHER]** (TURN A — address word order specifically)
> "The word order for object questions is: What + did + subject + base verb. Like: 'What did she eat?' Now try: 'What did Marie Curie ___?'"

**[STUDENT]**
> "What did Marie Curie discovered?"

**[VALIDATION]**
```
submitted: "What did Marie Curie discovered?"
result: INCORRECT — "discovered" should be base verb "discover"
correctionState: TURN_B
```

**[STATE]** → CONFUSION (persistent — now on verb form)

**[TEACHER]** (TURN B — narrow to verb form)
> "Almost — great structure. One fix: after 'did', always base verb. 'Discover', not 'discovered'. Say: 'What did Marie Curie discover?'"

**[STUDENT]**
> "What did Marie Curie discover?"

**[VALIDATION]** → CORRECT

**[BACKEND]** → item 3 activates

**[TEACHER]**
> "Exactly. Object question: What + did + Marie Curie + discover. Good."

**[STATE]** → CONFUSION → partially resolving

---

## Item 3 — Applying the Pattern (Testing Consolidation)

**[FRONTEND]**
```
Sentence 3: "Someone won the prize."
Underlined: "Someone"
Question frame: "Who ___?"
Type: subject_question
```

**[TEACHER]**
> "Back to 'who' — and 'someone' is underlined again. What type of question is this?"

**[STUDENT]**
> "Subject question... no did?"

**[TEACHER]**
> "Right — no 'did'. Go ahead."

**[STUDENT]**
> "Who won the prize?"

**[VALIDATION]** → CORRECT

**[TEACHER]**
> "Good — 'Who won the prize?' Right form."

**[STATE]** → CONFUSION → NEUTRAL (pattern consolidating)

---

## Item 4 — Student Overapplies the Subject Rule

**[FRONTEND]**
```
Sentence 4: "Marie Curie studied physics."
Underlined: "physics"
Question frame: "What ___?"
Type: object_question
```

**[STUDENT]**
> "What studied Marie Curie?"

**[VALIDATION]**
```
result: INCORRECT — object question requires auxiliary
correctionState: TURN_A
```

**[STATE]** → CONFUSION (subject-Q habit carrying over)

**[TEACHER]** (TURN A — pattern disambiguation)
> "'Physics' is the object — it's what she studied. Object question. Check: is 'what' the subject here, or the object? You need 'did'."

**[STUDENT]**
> "What did Marie Curie study?"

**[VALIDATION]** → CORRECT

**[TEACHER]**
> "Right. 'Physics' = object → 'did' is needed. The trick: if the WH-word replaces the SUBJECT, no 'did'. If it replaces the OBJECT, 'did' is required."

**[STATE]** → CONFUSION → NEUTRAL (rule stated and confirmed by student production)

---

## Item 5 — Final Item — Student Succeeds First Try

**[FRONTEND]**
```
Sentence 5: "Someone visited the museum."
Underlined: "Someone"
Question frame: "Who ___?"
Type: subject_question
```

**[STUDENT]**
> "Who visited the museum?"

**[VALIDATION]** → CORRECT

**[BACKEND]**
```
event: exercise_complete
exerciseId: "ex5_question_formation"
```

**[TEACHER]**
> "Perfect — 'Who visited the museum?' Subject question, no 'did'. You got it. That's Exercise 5 done."

**[STATE]** → NEUTRAL (confusion fully resolved)

---

## Analysis — What Made This Lesson Good

### What the teacher did right:

1. **Demonstration before item 1** — showed subject-Q format explicitly with a different example
2. **Detected format confusion** (not content confusion) — student knew vocabulary, not structure
3. **Signaled type change** at item 2 — "This one is different — watch carefully."
4. **Targeted ONE issue per TURN** — TURN A: word order. TURN B: verb form. Not both at once.
5. **Used pattern consolidation** — asked "what type of question is this?" on item 3 (not just "try it")
6. **Loop prevention** — escalated through A → B correctly, never repeated same hint
7. **Brief rule restatement** after item 4 — gave the explicit rule AFTER student produced it correctly

### What would have gone wrong with BAD behavior:

BAD turn A (repeating): "Don't use 'did' for subject questions — try again."
(Second occurrence of same hint — provides no new information)

BAD: Explaining subject vs. object BEFORE item 1 attempt:
"Subject questions don't use an auxiliary. Object questions do. Now try..."
(Removes guided discovery — student doesn't have to understand anything to answer)

BAD: Giving up after 2 wrong answers and moving to item 3:
"Let's just skip this one and move on."
(Item not completed through progression — Engine doesn't advance)

BAD: Correcting word order AND verb form simultaneously:
"You need 'did' AND 'discover' not 'discovered' — 'What did Marie Curie discover?'"
(Two corrections at once — student doesn't know which to apply next time)
