# Grammar Fill Protocol

> Deterministic fill-in exercises. Correction ladder A/B/C/D. Backend owns correctness.

Applies to: `deterministic_sequential`, `fill_in_blank`, `gap_fill`, `grammar_transformation`

See also: [[AI_TEACHER_DOCTRINE]] · [[RUNTIME_AUTHORITY_MAP]] · [[PEDAGOGICAL_RETRY_POLICY]] · [[SOFT_SPEAKING_PROTOCOL]]

---

## Core Principle

Grammar fill exercises have **one correct answer** per item.
Correctness is determined by the Validation System — not by the Teacher Brain.
The Teacher Brain reads the validation result and responds with the appropriate correction turn.

**AI never decides correctness.**
**AI never decides which correction turn to use.**

---

## Item Presentation Contract

1. Name the exercise number on first introduction only — not on every item
2. State the answer format once at exercise start (e.g., "one word", "full sentence")
3. Present one item per turn — never stack multiple items
4. Use exact item text from backend context — never paraphrase or simplify
5. Do not add grammar commentary before student attempts the item

**Example introduction:**
> "Exercise 3 — grammar practice. Fill in each blank with one word. First: 'She ___ to school every day.'"

**Example item re-presentation (after wrong answer):**
> "Not quite. Try again — 'She ___ to school every day.'"

---

## Correction Ladder

| Turn | What AI Does | Answer Revealed? |
|------|-------------|-----------------|
| A | Hint from a different angle — no answer | No |
| B | Stronger / more specific hint | No |
| C | Explicit partial answer, student completes | Partial |
| D | Full answer + brief explanation + ask student to repeat | Yes |

TURN is determined EXCLUSIVELY by the backend CORRECTION STATE block.
**Never re-derive correction turn from conversation history.**
**Never restart at TURN A after backend has advanced to B, C, or D.**

After TURN D student repeats correctly:
> "Right." → immediately present next item (no re-explanation)

---

## Post-Correction Retry Requirement

After every correction turn (A, B, or C):
End your response with: `"Try again — [item text]"`

This tells the student exactly what to say next.
Omitting this leaves the student uncertain whether to answer or wait.

---

## Same Wrong Answer Twice

If student gives identical wrong answer on second attempt:
- Change the framing — approach hint from a different angle
- Do NOT repeat the same hint verbatim

Example:
- Attempt 1: "Not quite. Think about verb tense here. Try again — 'She ___ to school.'"
- Attempt 2 (same wrong): "Still not quite. Remember, we need a verb that matches 'every day' — a habitual action. Try again — 'She ___ to school.'"

---

## Partial Answers

Partial answers in deterministic exercises are treated as **incorrect**.
Apply correction ladder from current CORRECTION STATE.
Do not praise partial answers for being "on the right track" — proceed with correction.

---

## Forbidden in Grammar Fill

- Saying "Wrong" or "Incorrect" (use guiding language only)
- Revealing answer before TURN D
- Repeating the same hint twice
- Skipping correction turns (A before B before C before D, always)
- Asking student to repeat after TURN D when they already got it right
- Going back to a previous item once cursor has advanced

---

## Grammar Explanation Rule

During exercise: max 2 sentences of grammar explanation.
Then redirect back to the item immediately.

Grammar lectures belong in dedicated grammar explanation sections.
Not during exercise correction turns.

---

## Exercise Completion

When backend confirms all items complete:
- One brief acknowledgment
- Immediately introduce next exercise

Do NOT:
- Summarize all completed items
- Lecture on grammar patterns from the exercise
- Ask student if they want to review
