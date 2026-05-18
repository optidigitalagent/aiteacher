# Reading Protocol

> Two-pass reading system: gist first, detail second.
> Teacher must not stack gist and detail in the same turn.

Applies to: `reading_comprehension`, `gist_reading`, `detail_reading`, `text_analysis`

See also: [[AI_TEACHER_DOCTRINE]] · [[TEACHER_BOOK_PEDAGOGICAL_ANALYSIS]] · [[DISCUSSION_PROTOCOL]]

---

## 1. Goal of Exercise

Reading exercises develop:
- Gist comprehension (main idea, general topic)
- Detailed comprehension (specific facts, sequence, true/false)
- Personalisation (connecting text to student's experience)

The sequence is always: PRE → GIST → DETAIL → POST.
Skipping or reordering this sequence is a pedagogical failure.

---

## 2. Expected Student Behavior

**Pre-reading:** Student answers one activation question. Any answer is acceptable.
**Gist:** Student gives one broad answer (topic, main idea). Not detailed.
**Detail:** Student answers specific comprehension questions. Exact or near-exact answer expected.
**Post-reading:** Student gives a personal opinion. No wrong answer.

---

## 3. Frontend Rendering Requirements

Frontend displays:
- Reading text (always visible during detail pass)
- Exercise questions (visible during detail pass)
- Gist task separately labeled

Teacher must NOT summarize the text for the student.
Text is visible — student reads independently.

---

## 4. Demonstration Policy

No demonstration needed for reading itself.
Demonstration applies to the TASK FORMAT for complex formats (T/F/NM, matching headings):

> "Exercise 5 — True, False, or Not Mentioned. 'Not Mentioned' means the text doesn't say — not that it's false. Read statement 1 and check."

One-sentence task format clarification. Then let student read.

---

## 5. Hint Policy

**Gist pass hints:**
| Turn | Hint |
|------|------|
| A | "Scan for the topic — what's the subject? People? Events? Places?" |
| B | "The first paragraph often states the main idea. What does it say?" |
| C | "Look at the title again — what does that suggest?" |
| D | "The main topic is [X]. Say that." |

**Detail pass hints:**
| Turn | Hint |
|------|------|
| A | "The answer is in the text — which paragraph might have it?" |
| B | "Look at paragraph [N]. What does it say about [specific element]?" |
| C | "Find the sentence with [key word from question]." |
| D | Reveal correct answer + ask student to locate it in text. |

---

## 6. Retry Policy

For comprehension questions with wrong answers:
- Redirect to the relevant paragraph
- Point to key word in the question to locate the answer
- Never reveal the paragraph number or line directly until TURN C

For True/False/Not Mentioned confusion:
- "Not Mentioned" is the most commonly confused — clarify: "The text doesn't say this at all — it's not there."

---

## 7. Correction Policy

Accept paraphrase of correct answer if meaning is preserved.
> Student: "He discovered it in 1905." Correct answer: "He made the discovery in 1905." → ACCEPT.

Do NOT penalize for different phrasing unless exactness is required (quotes, proper nouns).

---

## 8. Transition Policy

After gist pass: signal move to detail.
> "Good — now read more carefully and answer the detail questions."

After detail pass: signal post-reading.
> "Good. Last thing — your own opinion."

After post-reading: signal exercise complete.
> "That's the reading done. Let's move on."

---

## 9. Loop Prevention Rules

| Trigger | Response |
|---------|----------|
| Student gives gist answer for detail question | "This question wants a specific fact — find it in the text." |
| Student gives detail answer for gist | "That's a detail — I want the main topic first." |
| Student can't find answer | Direct to paragraph: "Check paragraph [N]." |
| Student gives correct meaning wrong words | Accept — paraphrase is fine for comprehension |

---

## 10. Voice / STT Tolerance Rules

Reading answers are text-based. Voice mode challenges:

| Issue | Solution |
|-------|----------|
| Student reads text aloud instead of answering | Interrupt gently: "I need your answer, not the text. What does it say?" |
| Student gives very long answer | Accept — extract gist from verbosity if meaning is correct |
| Proper nouns mispronounced | Accept phonetically close approximations for names/places |
| Student answers in L1 | Acknowledge understanding, ask for English: "Good — now say it in English." |

---

## 11. Progression Conditions

Gist task:
- Any answer showing general topic comprehension → progress to detail

Detail task:
- Correct specific answer → item advances
- TURN D reached → reveal answer + progress

Post-reading:
- Any substantive personal opinion → complete exercise

---

## 12. Failure Patterns

| Pattern | Cause | Prevention |
|---------|-------|-----------|
| Teacher summarizes text before student reads | Teacher helpfulness instinct overrides pedagogy | Never summarize. Text is visible. |
| Student skips gist, goes straight to detail | No PRE task executed | Always activate with one lead-in question first |
| Teacher stacks gist + detail in one turn | Efficiency instinct | Always one pass at a time |
| Student answers with page reference not content | Confusion about what to produce | "Tell me WHAT it says, not where it says it." |

---

## 13. Humanization Rules

- Acknowledge when a detail question is genuinely hard to find: "That one requires careful reading."
- Post-reading opinion questions: treat as discussion, not test. Respond to content, not just format.
- Don't rush the reading section — it is cognitively demanding. Allow processing time.
