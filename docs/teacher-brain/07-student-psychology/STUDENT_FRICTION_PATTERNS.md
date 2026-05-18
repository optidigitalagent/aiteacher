# Student Friction Patterns

> Common student behaviors that create interaction friction. How the Teacher should respond.

See also: [[AI_TEACHER_DOCTRINE]] · [[PEDAGOGICAL_RETRY_POLICY]] · [[VOICE_PEDAGOGY_DOCTRINE]]

---

## Core Principle

Friction is normal. The Teacher must recognize friction patterns and route to the correct pedagogical response without getting stuck.

**Friction must not cause loops.**
**Friction must not cause the Teacher to invent workarounds.**

---

## Pattern 1: Readiness Intent as Answer

**What happens:**
Student says "I'm ready", "let's go", "start", "yes" when on an exercise that requires an answer.

**Why it happens:**
Student does not realize the exercise has already started.
Student is anxious and signaling readiness before engaging.

**Correct handling:**
lesson-ws intercepts before validation.
Teacher responds: "First answer this: [instruction]"

**Wrong handling:**
Treating "I'm ready" as an exercise answer → validation fails → correction turn A → student confused.

Pattern guard: `READINESS_PATTERNS` regex in `lesson-ws`.
See [[VOICE_RUNTIME_ARCHITECTURE]].

---

## Pattern 2: One-Word / Filler Response

**What happens:**
Student says "ok", "yes", "Jordan", "good" in response to an open question.

**Why it happens:**
- Misunderstood the task format
- Anxious about being wrong
- Testing what the system expects

**Correct handling:**
Issue type `too_short` → one soft reprompt with instruction.
After one reprompt: accept any second response.

**Wrong handling:**
Multiple consecutive reprompts → student feels interrogated → abandons.

---

## Pattern 3: Topic Deflection / Side Question

**What happens:**
Student asks a side question during an exercise:
- "What does 'inspire' mean?"
- "Can you give me an example?"
- "What's the difference between 'inspire' and 'motivate'?"

**Why it happens:**
Genuine vocabulary gap or curiosity.
Not avoidance — legitimate question.

**Correct handling:**
Action: `side_question_answered`
- Answer the side question briefly (1-2 sentences)
- Return to the EXACT CURRENT ITEM (not item 1)
- "Now back to our exercise: [current item text]"

**Wrong handling:**
- Answering side question then moving to next item
- Answering side question then starting exercise from beginning
- Starting a vocabulary teaching session

Anti-chaos rule 13: After answering a side question, return to the exact current item.

---

## Pattern 4: Incomplete Answer / Trailing Off

**What happens:**
Student gives an answer that starts correctly but stops short:
- "Jordan inspires me be..." → stops
- "I like reading because..." → stops

**Why it happens:**
- Student ran out of vocabulary
- Student lost confidence
- Microphone cut off early

**Correct handling:**
For soft speaking: slot detection catches missing reason → `missing_reason` → targeted repair
Teacher: "Good start. Now add why: 'Jordan inspires me because ...'"

**Wrong handling:**
Treating incomplete answer as wrong → correction ladder → student confused about what was expected.

---

## Pattern 5: Repeated Same Answer

**What happens:**
Student gives the same wrong answer twice.

**Why it happens:**
- Student believes their answer is correct
- Student does not understand the error
- Student is guessing and repeating

**Correct handling:**
Change hint framing — approach from a different angle on second attempt.
Do NOT repeat the same hint verbatim.

**Wrong handling:**
Repeating "Not quite, try again" with no new information → student stuck in loop.

See [[PEDAGOGICAL_RETRY_POLICY]] — same wrong answer twice → different framing.

---

## Pattern 6: "I Don't Know"

**What happens:**
Student explicitly says "I don't know", "idk", "no idea".

**Why it happens:**
- Genuine vocabulary gap
- Student avoiding failure
- Student wants teacher to reveal answer

**Correct handling:**
For deterministic exercises: this counts as an attempt. Apply correction turn ladder.
For soft speaking: `issueType: 'off_task'` → reprompt with instruction.
If `attemptCount >= 3`: soft accept and move forward.

**Wrong handling:**
Treating "I don't know" as a legitimate soft speaking answer → `isPartiallyAcceptable = true` → incorrect acceptance.

PURE_FILLER detection catches "idk", "i don't know" before soft-speaking validation.

---

## Pattern 7: Rambling / Over-Answering

**What happens:**
Student gives a very long answer with multiple ideas, partially correct.

**Why it happens:**
Student is trying to say something correct by covering multiple bases.

**Correct handling:**
Slot detection runs — if all required slots are present, accept regardless of length.
Do NOT penalize for verbosity.
Keep feedback brief: acknowledge + move on.

**Wrong handling:**
Asking student to "be more concise" — this is not a teaching goal.
Spending time summarizing what the student said — wastes session time.

---

## Pattern 8: Anxiety Silence / No Response

**What happens:**
Student doesn't respond at all, or there's a long pause after item presentation.

**Why it happens:**
- Thinking
- Nervous about being wrong
- Technical issue with microphone

**Correct handling:**
After significant pause: re-state the item once, softly.
Do NOT interpret silence as wrong answer.
Do NOT advance to next item.

**Wrong handling:**
Treating silence as attempt → incrementing attempt counter.
Moving to next item after silence → student missed the item entirely.

---

## Pattern 9: Task Format Confusion

**What happens:**
Student understands the vocabulary but misunderstands what to DO.
Example: "form a question" task → student gives a statement answer.

**Why it happens:**
Task format instruction was not clear enough.
Student mapped the question to a different mental model.

**Correct handling:**
Explain task format FIRST (what to produce, not the grammar rule).
One example of the expected format.

Example:
- Student gives "My dad works hard" for a "form a question" task
- Teacher: "This exercise asks you to make a question. For example: 'Who works hard in your family?' Now you try."

**Wrong handling:**
Applying correction ladder (A/B/C/D) to a task format misunderstanding.
Grammar explanation before showing the expected output format.
