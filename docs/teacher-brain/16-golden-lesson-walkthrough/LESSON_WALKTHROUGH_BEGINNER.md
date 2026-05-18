# Golden Lesson Walkthrough — Beginner Student

> Realistic pedagogical runtime example for a beginner-level student (low confidence, some confusion).
> Section 1.2 — Grammar 1: Present Simple. Student: Anya, age 14.

See also: [[STUDENT_STATE_OVERVIEW]] · [[GRAMMAR_FILL_PROTOCOL]] · [[DEMONSTRATION_PROTOCOL]] · [[FRONTEND_SYNC_DOCTRINE]]

---

## Legend

```
[FRONTEND]     — What is visible on the student's screen
[BACKEND]      — Backend state changes
[TEACHER]      — What teacher says (voice + chat)
[STUDENT]      — What student says (voice transcript)
[STT]          — Raw STT output
[INTERP]       — Interpretation runtime result
[VALIDATION]   — Validation result
[STATE]        — Student cognitive state inference
```

---

## Lesson Start — Greeting Phase

**[BACKEND]**
```
event: lesson_start
section: 1.2
student: { name: "Anya", level: "A2+", priorErrors: [], sessionCount: 1 }
```

**[FRONTEND]**
```
Panel: "Welcome — section 1.2, Grammar 1: Present Simple"
Teacher avatar: active
Mic button: visible
```

**[TEACHER]**
> "Hi Anya. Today we're doing section 1.2 — Present Simple. Quick question before we start: what do you usually do after school?"

**[STATE]** → NEUTRAL (first exchange)

**[STUDENT]**
> "Um... I watch TV... sometimes read."

**[STT]** `"um i watch tv sometimes read"`

**[INTERP]** → activation answer, no validation needed → pass through

**[TEACHER]**
> "Good — 'watch TV' and 'read'. Perfect. Let's look at Exercise 3."

**[BACKEND]**
```
event: exercise_start
exerciseId: "ex3_grammar_fill"
exerciseType: "grammar_fill"
items: 6
firstItem: "She ___ to school every day."
```

---

## Exercise 3 — Grammar Fill — First Item

**[FRONTEND]**
```
Exercise panel opens:
"Exercise 3 — fill in the correct form of the verb."
Sentence 1: "She ___ to school every day."
Item counter: 1 of 6
Input: mic active
```

**[TEACHER]** (demonstration — new exercise type)
> "Exercise 3 — fill in one word in each blank. For example: 'He ___ chess every week' → 'He plays chess every week.' Now your turn: 'She ___ to school every day.'"

**[STATE]** → LOW_CONFIDENCE (first attempt, new exercise)

**[STUDENT]**
> "She go to school every day?"

**[STT]** `"she go to school every day"`

**[INTERP]** → attempted fill: "go"

**[VALIDATION]**
```
expected: "goes"
submitted: "go"
result: INCORRECT
correctionState: TURN_A
allowProgression: false
```

**[BACKEND]** → cursor stays at item 1, correctionState = A

**[TEACHER]** (TURN A hint)
> "Almost — look at the subject: 'she'. What ending does the verb need with she/he/it? Try again: 'She ___ to school.'"

**[STATE]** → LOW_CONFIDENCE (hesitation after correction)

**[STUDENT]**
> "She... um... goes?"

**[STT]** `"she um goes"`

**[INTERP]** → filler "um" stripped → answer: "goes"

**[VALIDATION]**
```
submitted: "goes"
result: CORRECT
allowProgression: true
```

**[BACKEND]**
```
event: item_submitted_correct
cursor advances: item 2
item2: "I ___ to school by bus."
correctionState: reset
```

**[FRONTEND]**
```
Item 1: ✓ "She goes to school every day."
Item 2 activates: "I ___ to school by bus."
```

**[TEACHER]**
> "Good — 'goes'. With she/he/it, we add -s. Next: 'I ___ to school by bus.'"

**[STATE]** → LOW_CONFIDENCE → slight improvement (got item 1)

---

## Item 2 — Student Gets It Right First Try

**[STUDENT]**
> "I go to school by bus."

**[STT]** `"i go to school by bus"`

**[VALIDATION]**
```
submitted: "go"
expected: "go"
result: CORRECT
allowProgression: true
```

**[BACKEND]** → item 3 activates: "She ___ French at school."

**[TEACHER]**
> "Right. 'I go' — no -s with I. Next: 'She ___ French at school.'"

**[STATE]** → LOW_CONFIDENCE → building slightly ("you're getting it" implicit)

---

## Item 3 — Spelling Challenge (studies)

**[FRONTEND]**
```
Item 3: "She ___ French at school."
```

**[STUDENT]**
> "She studys... um... studies?"

**[STT]** `"she studys um studies"`

**[INTERP]** → self-correction detected: "studys" → "studies" → extract final form "studies"

**[VALIDATION]**
```
submitted: "studies"
result: CORRECT
allowProgression: true
```

**[TEACHER]**
> "Good — and you caught yourself. 'Studies' — not 'studys'. Y changes to I and adds -ES with she/he/it. Right."

**[STATE]** → SELF_CORRECTION successfully resolved → LOW_CONFIDENCE improving

**[BACKEND]** → item 4 activates: "We ___ to school on Saturdays."

---

## Item 4 — Negative Form (Confusing for Beginner)

**[FRONTEND]**
```
Item 4: "We don't ___ to school on Saturdays."
```

**[BACKEND]** cursor: item 4, expected answer: "go"

**[TEACHER]**
> "Look at item 4: 'We don't ___ to school on Saturdays.'"

**[STUDENT]**
> "We don't goes to school on Saturdays."

**[STT]** `"we don't goes to school on saturdays"`

**[INTERP]** → answer extracted: "goes"

**[VALIDATION]**
```
submitted: "goes"
expected: "go"
result: INCORRECT
correctionState: TURN_A
```

**[TEACHER]** (TURN A — new angle)
> "Not quite. After 'don't', we always use the base verb — no -s. Think: 'don't + go', not 'don't + goes'. Try again: 'We don't ___...'"

**[STUDENT]**
> "We don't go to school on Saturdays."

**[VALIDATION]**
```
submitted: "go"
result: CORRECT
allowProgression: true
```

**[BACKEND]** → item 5 activates: "He ___ like football."

**[TEACHER]**
> "Right — 'don't go'. After don't, always base verb. Good."

---

## Item 5 — Negative with He (doesn't)

**[FRONTEND]**
```
Item 5: "He ___ like football."
Hint visible below: [use doesn't or don't]
```

**[STATE]** → CONFUSION signal (Anya pauses > 5 seconds)

**[TEACHER]** (soft re-prompt after silence)
> "Take your time — 'He ___ like football.' Is it don't or doesn't with 'he'?"

**[STUDENT]**
> "He don't like football."

**[VALIDATION]**
```
submitted: "don't"
expected: "doesn't"
result: INCORRECT
correctionState: TURN_A
```

**[TEACHER]** (TURN A — targets doesn't/don't distinction)
> "Good try. 'Don't' is for I/you/we/they. 'He' needs 'doesn't'. Try: 'He doesn't...'"

**[STUDENT]**
> "He doesn't like football."

**[VALIDATION]** → CORRECT

**[TEACHER]**
> "Right — 'doesn't'. He/she/it always uses 'doesn't' in negatives."

**[BACKEND]** → item 6 activates: "They ___ do homework on weekends."

---

## Item 6 — Final Item, Student Correct First Try

**[STUDENT]**
> "They don't do homework on weekends."

**[VALIDATION]** → CORRECT

**[BACKEND]**
```
event: exercise_complete
exerciseId: "ex3_grammar_fill"
status: "complete"
nextExercise: "ex4_freer_practice"
```

**[FRONTEND]**
```
Exercise 3: ✓ Complete
Exercise 4 panel loads: "Freer Practice — Speaking"
```

**[TEACHER]**
> "Good — that's Exercise 3 done. Six sentences, you got them all. Exercise 4 is different — now you speak freely. Tell me 3 things you do every week and 1 thing you don't do. Take your time."

**[STATE]** → LOW_CONFIDENCE → noticeably improved (successful exercise completion)

---

## Post-Exercise Speaking — Freer Practice

**[BACKEND]**
```
exerciseType: "soft_speaking"
instruction: "Tell me 3 things you do every week and 1 thing you don't do."
requiredSlots: ["subject", "activity", "frequency"]
```

**[STUDENT]**
> "Um... I watch TV every day. I read books. And... I don't play football."

**[STT]** `"um i watch tv every day i read books and i don't play football"`

**[INTERP]** → 3 activities present, frequency "every day" present, negative "don't play" present → all slots found

**[VALIDATION]**
```
issueType: "accepted"
allowProgression: true
```

**[TEACHER]**
> "Good — 'watch TV every day', 'read books', 'don't play football'. Nice. That's the lesson for today."

---

## Lesson End

**[BACKEND]**
```
event: lesson_end
billingFinalizeUsage: called
```

**[TEACHER]**
> "Great work today, Anya. You learned to use Present Simple with different subjects — I, she, he, they — and the negatives don't and doesn't. You caught yourself on 'studies' — that was good. See you next time."

**[FRONTEND]**
```
Lesson end banner: "Section 1.2 Complete"
Duration: [time]
```

---

## Analysis — What Made This Lesson Good

1. **Lead-in question** activated prior knowledge before exercise (Teacher Book pattern)
2. **Demonstration** on first item — format shown before student attempted
3. **TURN A** gave new information (subject agreement), not just "try again"
4. **Self-correction** detected and rewarded ("you caught yourself")
5. **Silence handled** with soft re-prompt, not escalation
6. **Pacing adjusted** — item transitions were fast when student succeeded
7. **Correction kept specific** — one grammar point per correction
8. **Exercise completion** acknowledged briefly, not celebrated excessively
9. **Freer practice** included — student produced language in personal context
10. **Lesson end** named ONE specific win (the self-correction)
