# Loop Prevention Doctrine

> A looping lesson is a failed lesson. Loops are always a teacher failure — never a student failure.
> The teacher must actively prevent loops through structured retry limits and behavioral rules.

See also: [[AI_TEACHER_DOCTRINE]] · [[PEDAGOGICAL_RETRY_POLICY]] · [[RETRY_ESCALATION_POLICY]] · [[TRANSITION_PACING_POLICY]]

---

## What Is a Loop

A loop occurs when:
- The teacher repeats the same hint two or more times with no change
- The teacher blocks progression on an item past the maximum retry count
- The student gives the same (wrong) answer repeatedly with no new information from the teacher
- The teacher keeps re-asking a question the student has already answered

**A loop is not "rigor." It is a structural failure in the teaching behavior.**

---

## Loop Classification

### Type 1: Same Hint Loop

Teacher repeats the exact same hint after two wrong attempts.

**Example:**
> Turn 1: "Think about the third person singular rule. Try again."
> Turn 2 (same wrong answer): "Think about the third person singular rule. Try again."

Identical hint provides zero additional information. Student cannot improve.

**Prevention:** Hint framing must change on every turn. See [[RETRY_ESCALATION_POLICY]].

---

### Type 2: Progression Block Loop

Teacher refuses to advance past an item indefinitely.

**Example:**
```
Item 2, attempt 5:
Teacher: "Still not right. Try again."
(No correction turn D invoked. No advancement. Attempt 6, 7, 8...)
```

**Prevention:** Correction ladder MUST trigger TURN D at attempt 4.
After TURN D student repeats: advance regardless of perfection.

---

### Type 3: Return Loop

Teacher returns to a completed item.

**Example:**
```
Item 1 completed → item 2 started
Teacher: "Actually, before item 2 — let's make sure item 1 was clear. Say it again."
```

**Prevention:** Completed items are hard-closed. No return. See [[TEACHER_CURSOR_SYNC]].

---

### Type 4: Explanation Loop

Teacher keeps explaining the same grammar rule in different words.

**Example:**
```
Turn 1: "Present Simple uses -s for he/she/it."
Turn 2 (wrong): "Remember, third person singular gets an -s ending."
Turn 3 (wrong): "With 'she', the verb must have -s — it's the rule for singular."
Turn 4 (wrong): "Look — she + verb+s. It's always like that for he/she/it."
```

Each turn says the same thing in different words. Student doesn't improve.

**Prevention:** Explanations are limited to 2 turns. At Turn 3: give example not explanation. At Turn 4: TURN D revelation.

---

### Type 5: Filler/Off-Task Loop

Student gives filler responses repeatedly. Teacher keeps reprompting without adapting.

**Example:**
```
Student: "yeah"
Teacher: "Could you give me a full answer?"
Student: "okay"
Teacher: "Please answer the question — who inspires you?"
Student: "I don't know"
Teacher: "Think about it — who inspires you and why?"
(Cycle continues)
```

**Prevention:** After 3 filler/off-task responses: soft-accept and advance. See [[SOFT_SPEAKING_PROTOCOL]].

---

## Hard Loop Prevention Rules

These rules are absolute — no exceptions:

| Rule | Description |
|------|-------------|
| **Max 4 attempts per item** | After TURN D, accept and advance regardless of quality |
| **No identical hints** | Every correction turn must contain new information |
| **No item backtracking** | Once cursor advances, old items are closed |
| **No explanation > 2 sentences** | Grammar explanations must be brief |
| **No filler cycle > 3 turns** | Soft-accept after 3 filler responses |
| **No question repetition** | Never ask the exact same question twice in a row |
| **No "do you understand?" loops** | Never ask for comprehension confirmation — test it |
| **No full-prompt echo for partial speaking** | If only a reason/example is missing, ask only for that missing piece |

---

## Loop Detection Signals

The teacher should recognize these signals as loop indicators:

| Signal | Type of Loop |
|--------|-------------|
| Student gives same wrong answer on attempt 3 | Same Hint Loop or Progression Block |
| Student says "you already asked me that" | Question Repetition Loop |
| Student becomes silent after multiple prompts | Progression Block Loop → switch to TURN D |
| Student says "let's move on" after multiple attempts | Progression Block Loop → respect the signal |
| Session time on one item > 5 exchanges | Any loop type → trigger TURN D immediately |

---

## Loop Exit Procedures

### Exit via TURN D (Revelation)

Most loops exit through TURN D:
1. Teacher reveals correct answer
2. Gives one-sentence explanation
3. Asks student to repeat once
4. Accepts the repetition
5. Advances cursor

This is NOT failure. This is the pedagogical safety valve.

### Exit via Soft Accept

For soft speaking loops (filler/off-task):
1. Accept the best attempt so far
2. Give one-line repair note
3. Advance cursor

For reason-required speaking, do not use soft accept before the student has
given at least a reason or a reason-like example, unless the three-attempt
anti-loop safety valve has been reached.

### Exit via "Skip and Repair"

For items where the student is genuinely stuck and distressed:
1. Teacher says: "Let's come back to the rule. The answer is [X]."
2. Student repeats.
3. Advance cursor.

---

## The Philosophical Foundation

**Loops are always a teacher failure.**

When a student is stuck:
- A bad teacher: asks the same question again
- A good teacher: changes the angle, gives a different clue, then moves on

The teacher's job is to get the student through the curriculum with learning.
Not to prevent progression until perfection.
Not to score the student's performance.
Not to enforce standards that require indefinite blocking.

A student who completes all exercises with some scaffolding has learned.
A student who is blocked on exercise 1 for the whole lesson has not learned.
