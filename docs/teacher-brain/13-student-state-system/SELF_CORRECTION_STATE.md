# Self-Correction State

> Student notices their own error and corrects it mid-production.
> This is a high-value learning behavior. Teacher must REWARD it, not penalize or ignore it.

See also: [[STUDENT_STATE_OVERVIEW]] · [[SELF_CORRECTION_PATTERNS]] · [[STT_NOISE_PATTERNS]]

---

## Behavioral Signals

| Signal | Example |
|--------|---------|
| "I mean..." | "Jordan... wait, I mean my father inspires me." |
| "No wait..." | "She go... no, she goes every day." |
| Restarts mid-sentence | "He... he... he works every day." |
| Explicit correction marker | "Actually, I should say..." |
| Phonetic approximation then fix | "goez... goes" |
| Trails off then restarts cleaner | "She... she goes to school." |

---

## Core Principle

Self-correction is evidence of active grammatical monitoring.
It is one of the most important learning behaviors a student can develop.

**The teacher must:**
1. Extract the FINAL form (after the correction)
2. Evaluate the FINAL form
3. Acknowledge the self-correction warmly
4. Move forward

**The teacher must NOT:**
1. Penalize the hesitation or restart
2. Re-present the item as if no answer was given
3. Count the initial wrong form as the attempt
4. Ignore the self-correction and respond to the initial wrong form

---

## Teacher Response Protocol

### Case 1: Self-correction produces correct final form

Student: "She go... wait, she GOES to school every day."

Teacher:
> "Good — and you caught yourself. Right."

Then move to next item. No extended praise. No re-explanation.

**Correction count: 0 (self-corrected = no teacher correction needed)**

---

### Case 2: Self-correction produces incorrect final form (still wrong)

Student: "She... she don't goes to school."

The student corrected "don't" from something else, but the correction is still wrong.

Teacher applies correction TURN A normally:
> "Almost — 'don't' is for I/you/they. She needs 'doesn't'. Try again — 'She ___ to school.'"

Do NOT punish the self-correction attempt. Address the remaining error only.

---

### Case 3: STT captures self-correction as noise

Student intended: "She goes to school."
STT output: "she go she goes to school"

Interpretation runtime should detect this as a self-correction pattern.
Teacher evaluates "she goes to school" — the final valid form.

If interpretation runtime fails to detect it:
Teacher may ask once: "Did you say 'she goes'?" → accept confirmation.

---

## What NOT to Do in Self-Correction State

| Action | Why Wrong |
|--------|----------|
| "That was wrong at first" | Penalizes the self-correction process |
| Re-presenting item after self-correction | Implies the self-correction wasn't accepted |
| Evaluating the initial wrong form | Teacher should evaluate FINAL form only |
| Extended praise for self-correction | Breaks pace unnecessarily |
| Ignoring self-correction | Misses a pedagogically important moment |

---

## STT Interaction with Self-Correction

Self-corrections produce noisy STT output. Common patterns:

| What student said | What STT outputs | Correct interpretation |
|------------------|-----------------|-----------------------|
| "She go- she goes" | "she go she goes" | Final form: "she goes" |
| "I mean my father" | "eye mean my father" | Correct: "my father" |
| "Wait no... Jordan" | "weight no Jordan" | Subject: Jordan |
| "Inspires... no, inspire me" | "inspires no inspire me" | Intent: "inspires me" |

See [[SELF_CORRECTION_PATTERNS]] for full phonetic pattern catalog.

---

## Acknowledgment Language

When a student self-corrects successfully:
- "Good — you caught that."
- "Right — and you fixed it."
- "Yes, exactly."

Do NOT use excessive praise: "Amazing self-correction!" → sounds robotic.
One short acknowledgment. Then continue.

---

## Self-Correction and Attempt Count

Self-corrections do NOT count as a full correction turn (A/B/C/D).
If student self-corrects to the correct answer:
- Correction turn = 0
- `allowProgression = true`

If student self-corrects to still-wrong answer:
- Correction turn = A (counts as attempt 1)
- Teacher gives TURN A hint normally

---

## Transition Out of Self-Correction State

Self-correction is momentary — not a sustained state.
After the correction resolves (successfully or not), return to normal flow.
