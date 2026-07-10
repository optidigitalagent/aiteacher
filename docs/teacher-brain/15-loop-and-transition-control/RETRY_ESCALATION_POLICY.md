# Retry Escalation Policy

> Formal policy for how correction turns must escalate in specificity, not repeat in content.
> Each retry turn must provide NEW information.

See also: [[LOOP_PREVENTION_DOCTRINE]] · [[PEDAGOGICAL_RETRY_POLICY]] · [[GRAMMAR_FILL_PROTOCOL]]

---

## Core Principle

Every retry turn must contain **new information** the student could not have inferred from the previous turn.

If a student gives the same wrong answer twice:
- They did not understand the previous hint
- The previous hint must be REPLACED, not repeated
- A different angle is required

**Escalation ≠ repetition. Escalation = new angle.**

---

## Escalation for Deterministic Exercises

### Turn A — Conceptual hint (different angle from item presentation)

Focus: the GRAMMATICAL CONCEPT without naming the answer.

Examples by concept:
- Person/number: "Think about the subject — is it I, she, or they?"
- Tense: "This sentence has 'yesterday' — what tense does that signal?"
- Negative: "This is a negative sentence — what auxiliary does 'she' need?"

**Must NOT:** State the correct answer. Mention the specific word needed.

---

### Turn B — Structural hint (narrows the answer space)

Focus: the STRUCTURE of the answer, narrowing options without revealing.

Examples:
- "The verb has two parts in this case — an auxiliary and a main verb."
- "The word ends in a specific suffix — think about '-s' or '-es'."
- "There's a time expression in the sentence — 'every day' — that signals one specific tense."

**Must NOT:** Give the first letter or sound of the answer. Name the tense directly.

---

### Turn C — Partial reveal (give beginning, student completes)

Focus: Give the START of the correct answer, student finishes.

Examples:
- "Start with 'doesn't' — she doesn't ___."
- "The verb form here is 'stud...' — complete it: 'She stud___'."
- "It begins with 'is' — she is ___ing."

**Must NOT:** Complete the full answer. This turn ensures the student still produces something.

---

### Turn D — Full reveal + repeat request

Focus: Give the complete correct answer. Brief explanation. Ask to repeat.

Format:
> "It's '[correct answer]'. [One sentence explanation]. Say that: '[correct answer].'"

Examples:
> "It's 'studies'. Y changes to I and adds -ES. Say that: 'she studies'."
> "It's 'doesn't go'. Negative Present Simple: doesn't + base verb. Say: 'she doesn't go'."

**After student repeats:** Accept immediately. Do NOT ask again.
**If student still says wrong form:** Accept anyway. Advance cursor.

---

## Escalation for Soft Speaking Exercises

Soft speaking does NOT use A/B/C/D ladder.
Soft speaking uses: reprompt → targeted slot repair → soft accept.

### Attempt 1 — Original prompt

Full instruction as stated.
> "Who inspires you and why?"

---

### Attempt 2 — Slot-targeted repair

Identify missing slot. Target ONLY that slot.
> "Good start. Now add the reason — why does [name] inspire you?"

**Must NOT:** Ask for multiple missing elements simultaneously.
**Must NOT:** Repeat the entire original speaking prompt when only the reason
or example is missing.

---

### Attempt 3 — Scaffold + soft accept ready

Add sentence starter for the missing slot.
> "Say: '[name] inspires me because...' — finish the sentence."

If student produces ANY content after the starter → `acceptable_with_repair` → advance.

For prompts that explicitly ask for two reasons, Attempt 3 may instead ask for:
one clear reason plus one real example, then recast the full answer and ask the
student to repeat it once.

---

### Attempt 4+ — Soft accept unconditionally

After 3 genuine attempts:
Accept with brief repair note. Advance.
> "Good. Better: '[model answer]'. Keep going."

**This is not lowering standards — this is completing the lesson.**

---

## Anti-Patterns in Escalation

### Anti-Pattern 1: Same hint, different words

Turn A: "Think about the verb ending for third person."
Turn B: "Remember — he/she/it needs a special ending."
Turn C: "The subject is 'she' — what does she need at the end of the verb?"

This is NOT escalation. All three turns say the same thing differently.

Fix: Each turn must narrow the student's search space. Turn B must eliminate options that Turn A didn't.

---

### Anti-Pattern 2: Jump to TURN D without escalating

Turn A: "Think about the verb tense."
Student (wrong): "She go."
Turn D immediately: "It's 'goes'."

This skips escalation entirely and reveals the answer prematurely.

Fix: Follow the escalation order. Do not skip turns.

Exception: Frustration state may accelerate to TURN D. See [[FRUSTRATION_STATE]].

---

### Anti-Pattern 3: Turn C partial answer too weak

Turn C: "The verb starts with a vowel."
("Studies" starts with 'st', not a vowel — this is wrong AND unhelpful)

Turn C partials must be:
- Factually correct
- Specific enough to constrain the answer
- Not so specific they reveal the full answer

---

## Correction Turn Counter

The correction turn counter (A/B/C/D) is maintained by the backend CORRECTION STATE.
Teacher must NEVER:
- Re-derive the turn from conversation history
- Reset the turn counter after a student says something
- Skip turns because "the student seems to understand"

The backend is authoritative. The correction state block in context determines turn.

---

## When Escalation Succeeds Mid-Sequence

If student gives correct answer between turns (e.g., correct at TURN B without needing C or D):
- Accept immediately
- Do NOT advance to TURN C "to confirm"
- Advance cursor

The student answered correctly. The sequence is over.
