# Self-Correction Patterns

> How to detect when a student is correcting themselves mid-answer, and how to interpret the intended content.

See also: [[STT_NOISE_PATTERNS]] · [[SOFT_SPEAKING_PROTOCOL]] · [[VOICE_PEDAGOGY_DOCTRINE]]

---

## Core Principle

Self-corrections are a sign of linguistic awareness, not incompetence.
When a student corrects themselves, the Teacher must:
1. Detect that a self-correction occurred
2. Extract the INTENDED (corrected) content
3. Evaluate the corrected content — not the abandoned content

**Never penalize the self-correction attempt itself.**

---

## Detection Signals

### Explicit Corrections (high confidence)

| Signal | Example | Extract |
|--------|---------|---------|
| "I mean ..." | "my mom... I mean, my dad" | "my dad" |
| "I meant ..." | "she inspire... I meant she inspires" | "she inspires" |

Detection logic (`hasSelfCorrection()`):
```
/i mean\b/
/i meant\b/
```

Extraction (`extractCorrectedPart()`):
```
match "i mean\s+(.+)$" → capture group 1
```

---

### Negative Reframe (medium confidence)

| Signal | Example | Interpretation |
|--------|---------|---------------|
| "not X" | "not my teacher... my dad" | Correcting from "my teacher" to "my dad" |

Detection: `/\bnot\s+\w+\b/`
Extraction: full string still contains intended content (correction follows the negation)

---

### Repeated Words / Restarts (implicit correction)

| Signal | Example | Interpretation |
|--------|---------|---------------|
| Duplicate consecutive words | "My my dad" | Stutter / restart — intended: "My dad" |
| Abandoned phrase + restart | "She... Jordan inspires me" | Restarted with "Jordan" as subject |

These are NOT detected by `hasSelfCorrection()` but:
- Duplicate words: normalize before slot detection
- Phrase abandonment: longer content takes precedence

---

## Interpretation Flow

```
Student transcript arrives
    ↓
hasSelfCorrection() → true?
    ↓ Yes
extractCorrectedPart() → correctedText
    ↓
Run detectAnswerSlots() on correctedText (not original)
    ↓
findSubjectGuess() on correctedWords
    ↓
If missingSlots:
    interpretedMeaning = "I understand — you mean [subjectGuess]"
    repairPrompt = buildPedagogicalRetry(instruction, missingSlots, subjectGuess)
    return pronunciation_or_stt (isPartiallyAcceptable = true)
    ↓
If all slots present:
    continue to standard acceptance path
```

---

## Teacher Response to Self-Correction

**When self-correction is detected and slots are missing:**

> "I understand — you mean [subjectGuess]. [targeted repair prompt]"

Example:
- Student: "my mum... I mean, my dad"
- Subject detected: "dad"
- Reason missing
- Teacher: "I understand — you mean your dad. Now add why: 'My dad inspires me because ...'"

**When self-correction is detected and all slots are present:**
- Respond as if the corrected answer was the only answer
- Do not reference the original abandoned phrase

---

## Two-Sentence Form (Implicit Reason)

Student: "Anita inspired me. She never gave up."

This is NOT an explicit "because" — but it IS a reason.
Detection: `hasSecondExplanatoryClause(rawTranscript)`

Logic:
1. Split transcript on [.!?]
2. Check if clause 2+ starts with a third-person pronoun (he/she/they/it)
3. Check if clause 2+ has ≥ 2 semantic words
4. If both: reason slot = PRESENT

This prevents false `missing_reason` for students who naturally express reasons as separate sentences.

---

## What Self-Correction Is NOT

Self-correction is NOT:
- An answer to a new question
- Permission to ignore slot requirements
- A reason to restart the attempt counter

It IS:
- Evidence the student knows the correction was needed
- A signal to extract the intended content
- A trigger to run validation on corrected content only

---

## Common Cases

| Raw Transcript | Detection | What to Validate |
|---------------|-----------|-----------------|
| "my mum I mean my dad inspires me because he works hard" | "I mean" → extract "my dad inspires me because he works hard" | "my dad inspires me because he works hard" |
| "not Jordan I think Michael inspires me" | "not X" → full string | "Michael inspires me" |
| "she... Jordan inspires me because she never gave up" | Restart | "Jordan inspires me because she never gave up" |
| "because because she works hard" | Repeated word stutter | "she works hard" (reason present) |
