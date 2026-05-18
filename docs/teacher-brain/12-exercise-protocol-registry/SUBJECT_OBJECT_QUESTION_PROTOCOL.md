# Subject/Object Question Protocol

> Question formation exercises are the most commonly misunderstood exercise type.
> Students confuse subject questions (no auxiliary) with object questions (needs auxiliary).

Applies to: `question_formation`, `subject_question`, `object_question`, `wh_question`

See also: [[AI_TEACHER_DOCTRINE]] · [[GRAMMAR_FILL_PROTOCOL]] · [[DEMONSTRATION_PROTOCOL]] · [[TEACHER_BOOK_PEDAGOGICAL_ANALYSIS]]

---

## 1. Goal of Exercise

Student forms a grammatically correct WH-question, either:
- **Subject question**: "Who plays chess?" (the WH-word IS the subject — no auxiliary)
- **Object question**: "What does she play?" (the WH-word asks about the object — needs auxiliary)

This is one of the most common grammar error points at B1 level.

---

## 2. Expected Student Behavior

Student says or writes a complete question.
Not a fragment. Not a statement. A question with:
- WH-word (who/what/where/when/why/how)
- Correct word order
- Correct verb form

For subject questions: `Wh-word + verb + (object)?`
For object questions: `Wh-word + auxiliary + subject + base verb + ?`

---

## 3. Frontend Rendering Requirements

Frontend displays:
- Sentence to transform (e.g., "Someone plays chess every day." → "Who ___?")
- Exercise instruction (e.g., "Form a subject question about the underlined word.")
- Input field for student's typed/voiced answer

Teacher must NOT read the target sentence structure — let the student discover it.

---

## 4. Demonstration Policy

**Critical: Always demonstrate format before the first item.**

Student confusion on this exercise type is nearly universal without a model.

**Subject question demonstration:**
> "Exercise 4 — forming questions. Here's an example:
> Statement: 'Someone phoned you.' Subject question: 'Who phoned you?' — notice: no 'did', no auxiliary.
> Now your turn with the first sentence."

**Object question demonstration:**
> "Different type — object question. Statement: 'She plays something.' Object question: 'What does she play?' — notice: 'does' is needed here.
> Now your turn."

**ONE example only. Do not give two examples.**
Do not explain the grammatical rule behind the demonstration before the attempt.

---

## 5. Hint Policy

Subject question hints (student used auxiliary unnecessarily):
| Turn | Hint |
|------|------|
| A | "Subject questions don't need 'did' — the WH-word is the subject itself. Try again." |
| B | "Compare: 'Someone phoned you' → 'Who phoned you?' — same verb form. Try your sentence." |
| C | "Start with 'Who' and use the same verb: 'Who [verb] ...?' Try it." |
| D | Reveal: "It's 'Who phoned you?' — no 'did'. Say that." |

Object question hints (student omitted auxiliary):
| Turn | Hint |
|------|------|
| A | "Object questions need 'does/did' — think about the subject. Try again." |
| B | "Pattern: What + does/did + subject + base verb? Try that structure." |
| C | "Start: 'What does she...' — finish the question." |
| D | Reveal: "It's 'What does she play?' Say that." |

---

## 6. Retry Policy

Most common student errors:

| Error | Example | Fix |
|-------|---------|-----|
| Subject Q with auxiliary | "Who did phone you?" | "No auxiliary needed — subject questions skip 'did'. Try: 'Who phoned'..." |
| Object Q without auxiliary | "What she plays?" | "Object questions need 'does' — 'What does she play?'" |
| Wrong word order | "What plays she?" | "Word order: What + does + she + play?" |
| Statement instead of question | "She plays chess." | Show expected output format — this is task format confusion, not grammar error |

---

## 7. Correction Policy

Never correct word order AND auxiliary error simultaneously.
Pick ONE issue per correction turn.

Priority order:
1. Missing/wrong auxiliary (most impactful structural error)
2. Wrong word order
3. Verb form error (base vs. -s vs. -ed)

After correction: always end with "Try again — [item prompt]."

---

## 8. Transition Policy

Subject/object question exercises often have multiple items alternating between the two types.
Teacher must signal type change:
> "This one is an object question — notice the underlined word is the object. Different structure."

Do NOT let student carry over subject-Q pattern into object-Q items silently.

---

## 9. Loop Prevention Rules

| Trigger | Response |
|---------|----------|
| Three wrong attempts, same error | At TURN D: reveal correct question, ask student to repeat |
| Student gives statement instead of question | This is task format confusion — explain format, then retry |
| Student says "I don't know how to form it" | Give the WH-word + ask student to complete: "Start with 'Who' — who [verb]...?" |
| Student produces correct content wrong form | Accept content, repair form: "'Who phoned?' — almost. Say it exactly: 'Who phoned you?'" |

---

## 10. Voice / STT Tolerance Rules

| STT issue | Solution |
|-----------|----------|
| Rising intonation lost in text | Accept grammatically correct question even if punctuation missing |
| "did" vs "does" misheard | Interpret contextually — past vs. present tense of main statement |
| Auxiliary dropped in fast speech | If full question intent clear, accept with repair note |
| Student self-corrects mid-question | Extract final form after "I mean" / correction marker |

---

## 11. Progression Conditions

`allowProgression = true`:
- Validation System confirms correct question structure
- OR TURN D: student repeats correct form after revelation

`allowProgression = false`:
- Wrong question type (subject vs. object confusion)
- Missing auxiliary in object question
- Statement given instead of question

---

## 12. Failure Patterns

| Pattern | Cause | Prevention |
|---------|-------|-----------|
| Student stuck in subject-Q pattern for all items | Teacher didn't signal type change | Announce type before each item |
| Student gives correct words wrong order | Word order not targeted in hint | Target word order specifically in correction |
| Same error after TURN D | Student didn't process correction | Slow down, repeat revelation, ask to say it aloud |

---

## 13. Humanization Rules

Subject/object questions are genuinely hard. Acknowledge the difficulty.
> "This is a tricky distinction — even advanced learners get these confused."

Do not imply the student is slow for struggling.
After successful correction: warmer acknowledgment than usual.
> "Good — you got it. Subject question. No 'did' needed."
