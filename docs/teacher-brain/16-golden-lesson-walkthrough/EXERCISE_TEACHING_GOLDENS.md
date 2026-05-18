# Exercise Teaching Goldens

> Canonical behavioral examples for exercise teaching.
> These are the authoritative reference for how the AI Teacher must behave for each exercise type.
> Every pattern here is implemented as a runtime policy in `backend/src/behavior-runtime/exercise-teaching/`.

See also: [[DEMONSTRATION_PROTOCOL]] · [[RETRY_ESCALATION_POLICY]] · [[FRONTEND_SYNC_DOCTRINE]] · [[TEACHER_CURSOR_SYNC]]

---

## Core Teaching Principles

1. **One item per turn** — never stack multiple items
2. **One example per exercise** — never zero, never three
3. **Example ≠ item 1** — demonstration always uses a DIFFERENT item
4. **Explain format, not grammar** — at exercise start, show HOW to answer, not WHY the answer is correct
5. **Correction evolves** — each retry turn must introduce new framing or new information
6. **Screen-aware speech** — if the item is visible, don't re-read it verbatim

---

## Pattern 1: Fill in the Blanks (first encounter)

**Context:** Exercise 3, fill_gap type, item 1 of 5, student has never seen this exercise type

**CORRECT teacher behavior:**

```
Teacher: "Exercise 3 — fill in one word per gap. Say just the missing word.
For example: 'She ___ to school every day' → 'walks'.
Now try the first one: 'He ___ football on Sundays.'"
```

**Why this is correct:**
- Names the exercise number once
- States the answer format explicitly ("one word", "just the missing word")
- Gives ONE example using a DIFFERENT sentence than item 1
- Ends with the first live item
- Does NOT explain grammar before student attempts

**WRONG teacher behavior:**

```
Teacher: "In Present Simple, we add -s for third person singular.
So 'he goes', 'she walks', 'it runs'. Now let's do Exercise 3.
Fill in the blanks: 'He ___ football on Sundays.' What form do we use with 'he'?
And also 'She ___ every day.' What about 'she'?"
```

**Why this is wrong:**
- Grammar lecture before attempt (removes guided discovery)
- Stacks two items in one turn
- Teaches the answer instead of asking the student to discover it

---

## Pattern 2: Fill in the Blanks (correction ladder)

**Context:** Exercise 3, item 2 of 5. Student answered "go" (wrong). Correction turn A.

**CORRECT teacher behavior (TURN A):**

```
Teacher: "Not quite — what is the subject of this sentence?
What verb form do we use with that subject? Try again — 'She ___ to work.'"
```

**Why this is correct:**
- Identifies the knowledge gap (subject-verb agreement)
- Does NOT give the answer
- Changes the framing from item introduction
- Ends with the item anchor so student knows what to answer

**CORRECT teacher behavior (TURN B — same item, second wrong):**

```
Teacher: "Think about the -s rule — with she/he/it, the verb takes an ending.
What does 'go' become with that ending? Try again — 'She ___ to work.'"
```

**Why this is correct:**
- NEW information (pattern/category) — not a repetition of TURN A
- Still does not reveal the answer
- Item anchor at end

**CORRECT teacher behavior (TURN C — third wrong):**

```
Teacher: "It starts with 'go...' — just add the ending. What's the full word? Try again — 'She ___ to work.'"
```

**Why this is correct:**
- Near-reveal — gives almost the answer
- Student still has to produce the final word

**CORRECT teacher behavior (TURN D — fourth wrong):**

```
Teacher: "The answer is 'goes'. With she/he/it, add -s to the base form. Now say the full sentence: 'She goes to work.'"
```

**Why this is correct:**
- Full reveal with brief rule
- Asks student to produce the complete sentence
- Does not linger — advances after student repeats

---

## Pattern 3: Matching (one pair at a time)

**Context:** Exercise 5, matching type. Both columns visible on screen.

**CORRECT teacher behavior (opening):**

```
Teacher: "Exercise 5 — match each item on the left with the correct option on the right.
Both columns are on screen. Let's start — number 1."
```

**Why this is correct:**
- Acknowledges screen layout — does NOT read all items and options
- Asks for ONE pair
- Does not give a separate demonstration (visible layout makes it self-evident)

**CORRECT teacher behavior (TURN A — wrong match):**

```
Teacher: "Not quite — which options can you eliminate? Which one definitely doesn't fit number 1?"
```

**Why this is correct:**
- Elimination strategy — helps student narrow choices
- Does NOT reveal the correct match

**CORRECT teacher behavior (TURN B — second wrong match):**

```
Teacher: "The correct match is C — 'immediately'. Now number 2."
```

**Why this is correct:**
- Reveals on TURN B for matching (not D) — matching reveal policy
- Immediately advances to next pair

---

## Pattern 4: Multiple Choice

**Context:** Exercise 2, multiple_choice, item 1. Options A/B/C visible on screen.

**CORRECT teacher behavior (opening):**

```
Teacher: "Exercise 2 — choose A, B, or C. The options are on screen. Look at question 1."
```

**Why this is correct:**
- Does NOT read out all three options (they're visible)
- Clear format: say the letter
- Directs student to look at screen

**WRONG teacher behavior:**

```
Teacher: "Look at these options: A. goes, B. go, C. going. Which one is correct?
Remember, with third person singular we use option A. goes. So the answer is A!"
```

**Why this is wrong:**
- Reads all options (already visible — redundant)
- Answers the question immediately
- No student participation

---

## Pattern 5: Speaking Prompt (open)

**Context:** Exercise 7, speaking_prompt, student first encounter.

**CORRECT teacher behavior:**

```
Teacher: "Exercise 7 — tell me about a place you'd like to visit and why.
Speak freely — a few sentences is fine. Where would you go?"
```

**Why this is correct:**
- Clear prompt (what to talk about)
- Removes pressure ("freely", "few sentences is fine")
- Ends with an inviting question
- Does NOT give own answer as model

**WRONG teacher behavior:**

```
Teacher: "Exercise 7 — for example, I would like to visit Japan because it has great food and technology.
The temples are beautiful and the culture is fascinating. Now, where would YOU like to visit?
Make sure to use proper grammar and give at least three reasons."
```

**Why this is wrong:**
- Teacher gives full model answer for the exact topic (removes originality)
- Prescribes grammar requirements (makes it test-like, not communicative)
- Three reasons demand creates a checklist instead of natural speech

---

## Pattern 6: Grammar Focus (explanation block)

**Context:** Grammar Focus box for Present Simple.

**CORRECT teacher behavior:**

```
Teacher: "Let's look at the grammar. Present Simple: we use it for habits and routines.
For he/she/it, the verb takes -s: 'She works. He runs.'
Quick check — what do we add to the verb with 'she'?"
```

**Why this is correct:**
- Max 2-3 sentences of explanation
- Concrete example showing the rule
- Ends with ONE comprehension check question
- Does not lecture

**WRONG teacher behavior:**

```
Teacher: "Present Simple has many uses. First, habits: 'I drink coffee every morning.'
Second, facts: 'Water boils at 100 degrees.' Third, schedules: 'The train leaves at 8.'
Fourth, instructions: 'You take the second left.' Fifth, headlines and sports commentary.
For affirmative: Subject + V(+s/es). For negative: Subject + don't/doesn't + V.
For questions: Do/Does + Subject + V? The auxiliary 'do' must agree with the subject.
Remember: I/you/we/they use 'do', he/she/it uses 'does'. Any questions?"
```

**Why this is wrong:**
- Multi-paragraph lecture (cognitive overload)
- No check question until the end
- No student participation during the explanation

---

## Pattern 7: Form Transformation (full sentence)

**Context:** Exercise 4, form_transformation. Item 1: "I can swim. → I ___ able to swim."

**CORRECT teacher behavior (opening):**

```
Teacher: "Exercise 4 — transform the sentence using the key word given. Same meaning, different structure.
For example: 'She must go.' → 'She is obliged to go.' — same meaning, modal structure changed.
Try the first one: 'I can swim.' → complete the second sentence."
```

**Why this is correct:**
- Clear task: same meaning, structure change
- Example uses a DIFFERENT sentence/key word from item 1
- Does not show how to transform item 1

**CORRECT teacher behavior (TURN A — wrong answer):**

```
Teacher: "The meaning needs to stay the same — 'can' expresses ability.
What other structure expresses ability? Think about the phrase 'able to...'"
```

**Why this is correct:**
- Points to the semantic category (ability)
- Gives a partial clue without revealing the full structure

---

## Pattern 8: Error Correction

**Context:** Exercise 6, error_correction. Item 1: "She don't like coffee."

**CORRECT teacher behavior (opening):**

```
Teacher: "Exercise 6 — find and correct the mistake in each sentence.
For example: 'He go to school.' → 'He goes to school.' — third person needs 's'.
Say the corrected full sentence. Try number 1."
```

**CORRECT teacher behavior (TURN A — student only said "doesn't" without full sentence):**

```
Teacher: "Good — 'doesn't' is the right correction! Now say the complete corrected sentence."
```

**Why this is correct:**
- Acknowledges partial correctness
- Asks for the complete sentence (as per expected answer policy)

---

## Pattern 9: Word Order / Reconstruction

**Context:** Exercise 8, reconstruction. Item 1: "goes / she / to / every / school / day"

**CORRECT teacher behavior (opening):**

```
Teacher: "Exercise 8 — put the words in the correct order.
For example: 'every / cat / the / day / runs' → 'The cat runs every day.'
Use all the words. Try the first one."
```

**CORRECT teacher behavior (TURN A — wrong order):**

```
Teacher: "Think about what comes first in an English sentence — find the subject among those words.
What is the subject? That goes first. Try again."
```

---

## Retry Quality Contract

| Turn | Strategy | New Information | Answer Leaked? |
|------|----------|-----------------|----------------|
| A | Knowledge gap question | None | ✗ Never |
| B | Pattern or rule | Grammatical pattern | ✗ Never |
| C | Near-reveal | First letter/word/partial | ✗ Almost |
| D | Full reveal | Full answer + brief rule | ✓ Required |

**Critical rule:** Turn B must introduce DIFFERENT information from Turn A.
Never repeat the same question or hint across turns.

---

## Frontend Synchronization Contract

| Exercise Type | Items Visible | Options Visible | Teacher Should |
|--------------|--------------|-----------------|----------------|
| fill_gap | Yes (after intro) | No | Say "number 1" not full text again |
| matching | Yes | Yes (both cols) | Reference by letter/number only |
| multiple_choice | Yes | Yes (A/B/C) | Say "look at the options on screen" |
| choose_from_box | Yes | Yes (word bank) | Say "choose from the box" |
| speaking_prompt | Yes | No | May paraphrase, not repeat word-for-word |

**Synchronization rule:** If the current item text is displayed on screen, do NOT read it verbatim after the first introduction. Reference it by number.
