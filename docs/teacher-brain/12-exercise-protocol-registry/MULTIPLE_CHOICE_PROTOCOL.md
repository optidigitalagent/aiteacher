# Multiple Choice Protocol

> Deterministic selection exercises with rendered frontend options (A/B/C/D).
> Teacher must reference visible options naturally without reading them all aloud.

Applies to: `multiple_choice`, `options`, `choice_select`

See also: [[AI_TEACHER_DOCTRINE]] · [[GRAMMAR_FILL_PROTOCOL]] · [[FRONTEND_SYNC_DOCTRINE]] · [[DEMONSTRATION_PROTOCOL]]

---

## 1. Goal of Exercise

The student selects the correct answer from a fixed set of options displayed on screen.
The exercise tests recognition — not free production.
Correctness is deterministic: one option is correct per item.

---

## 2. Expected Student Behavior

Student says or selects:
- The letter: "A", "B", "C"
- The option text: "goes to school"
- Or a partial match: "the second one", "the last option"

All forms are acceptable. Interpretation runtime maps to correct option.

---

## 3. Frontend Rendering Requirements

Frontend MUST display:
- Options A, B, C (and optionally D) as visible clickable/selectable elements
- Current item question text
- No answer revealed until student submits

Teacher MUST NOT read all options aloud — they are visible on screen.
Teacher references them by letter only when guiding: "Think about option B."

---

## 4. Demonstration Policy

First item of a new multiple choice exercise: teacher demonstrates format only — not content.

> "Exercise 2 — you'll see options A, B, C on screen. Pick the one that correctly completes the sentence. Look at the first sentence and choose."

Do NOT demonstrate by choosing an answer for item 1.
Do NOT explain what each option means before the student attempts.

---

## 5. Hint Policy

| Turn | Hint |
|------|------|
| A | Conceptual hint — what to look for (verb tense, subject agreement, etc.) |
| B | Eliminate one wrong option explicitly: "Option A has a grammar problem — which is it?" |
| C | Narrow to two: "It's either B or C. Think about [specific clue]." |
| D | Reveal correct answer + brief reason + ask student to say it |

Never hint by describing the correct option's content before TURN D.

---

## 6. Retry Policy

After wrong selection:
- Do NOT re-read all options
- Do NOT list which options are wrong
- Hint at the distinguishing feature of the correct answer

> Student selects A (wrong). Teacher: "Not A — think about the subject. We have 'she' — what ending does the verb need? Try again."

---

## 7. Correction Policy

After wrong answer:
- Never say "A is wrong" on first attempt unless TURN B+
- Never explain what ALL wrong options have in common
- One specific grammar/vocabulary focus point per correction

After correct answer:
- One brief confirmation
- Move immediately to next item

---

## 8. Transition Policy

At end of multiple choice exercise:
- No summary of all answers
- No review of which ones were hard
- Announce next exercise briefly: "Good — Exercise 3 is next."

---

## 9. Loop Prevention Rules

| Trigger | Response |
|---------|----------|
| Student gives same wrong answer twice | Explicitly eliminate that option: "Not A — let me rule that out. Now choose between B and C." |
| Student says "I don't know" | Count as attempt. Apply correction turn. |
| Student asks "what are the options?" | Options are visible on screen — redirect: "Look at the options on screen and choose." |
| Student gives non-option answer | Interpret closest match. If unclear, ask: "Do you mean A, B, or C?" |

---

## 10. Voice / STT Tolerance Rules

Common STT confusions for option selection:

| Student says | Interpret as |
|-------------|-------------|
| "A" / "ay" / "the first" | Option A |
| "B" / "be" / "the second" | Option B |
| "C" / "see" / "sea" / "the third" | Option C |
| "D" / "de" / "the fourth" | Option D |
| "[reads option text aloud]" | Match to option containing that text |

If ambiguous between two options: ask once for clarification letter only.

---

## 11. Progression Conditions

`allowProgression = true` when:
- Correct option selected (from Validation System)
- OR backend TURN D reached — student repeats correct answer

`allowProgression = false` when:
- Wrong option selected
- No clear option detected in transcript

---

## 12. Failure Patterns

| Pattern | Root Cause | Fix |
|---------|-----------|-----|
| Teacher reads all 4 options aloud | Teacher ignores that frontend renders them | Only reference letters |
| Teacher reveals answer at TURN A | Hint ladder skipped | Follow ladder strictly |
| Student loops on same wrong answer | Teacher gave identical hint | Change framing, eliminate option |
| Student confused about format | No format demonstration | Always demonstrate format on first item |

---

## 13. Humanization Rules

- Reference what the student can SEE: "Look at option B on screen."
- Vary acknowledgment: "Good", "Right", "Yes" — not always "Correct."
- Do not celebrate every correct answer identically — vary warmth by confidence level.
- For confident students: brief acknowledgment only.
- For hesitant students: warmer acknowledgment + "You're on the right track."
