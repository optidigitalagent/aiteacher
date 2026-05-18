# STT Noise Patterns

> Real phonetic confusion patterns observed in production. Use these to calibrate Teacher Brain interpretation.

See also: [[SELF_CORRECTION_PATTERNS]] · [[VOICE_PEDAGOGY_DOCTRINE]] · [[SOFT_SPEAKING_PROTOCOL]]

---

## Core Rule

**STT output is an approximation, not a verbatim transcript.**

The validation system applies deterministic heuristics to interpret STT output.
The Teacher Brain must assume the same: phonetically close ≠ wrong answer.

---

## Phonetic Confusion Patterns

### Names / Nouns

| Student Said | STT Heard | Correct Interpretation |
|-------------|-----------|----------------------|
| "Viv" | "weave" | Subject name — "Viv" |
| "Viv" | "we've" | Subject name — "Viv" |
| "Viv" | "wave" | Subject name — "Viv" |
| "Anita" | "Anita" | Usually correct |
| "Jordan" | "Gordon" | Subject name — check context |

**Rule**: Short names (3-4 chars) are high-risk for STT substitution. Detect via `findSubjectGuess()` heuristic — any non-stopword, non-filler, non-grammar word ≥ 4 chars.

---

### Function Words

| Student Said | STT Heard | Effect |
|-------------|-----------|--------|
| "me" | "may" | Broken grammar detection: `^may (inspire|admire)` → SOV pattern |
| "is" | "ease" | Noise — ignored in semantic analysis |
| "I'm" | "I am" | Equivalent — normalized |
| "they're" | "there" | Handled by normalization |
| "we've" | "weave" | Contraction confusion |
| "she's" | "she is" | Equivalent — normalized |

**Rule**: Modal word "may" at sentence start followed by a verb → likely "me" (non-native STT artifact). See `detectBrokenGrammar()`.

---

### Grammar Structure Artifacts

| Student Said | STT Heard | Pattern |
|-------------|-----------|---------|
| "He inspires me" | "He inspire me" | Missing -s — common for non-native speakers |
| "Me inspire Jordan" | "May inspire Jordan" | SOV inversion + "may" STT for "me" |
| "Jordan inspires me" | "Jordan inspire me" | Missing -s — `\bJordan inspire me\b` |
| "She inspires me" | "She inspire me" | Missing -s — `\bshe inspire\b` |

Patterns handled by `detectBrokenGrammar()`:
```
^me (inspire|inspires|admire|admires)\b
^may (inspire|inspires|admire|admires)\b
\b(he|she) inspire\b (no -s)
\b\w{3,} inspire me\b (no -s)
```

---

### Partial Restarts

Student: "My... my dad... I mean, my dad works hard"

STT: "My my dad I mean my dad works hard"

Detection:
- Repeated words ("my my") → self-correction signal
- "I mean" → extract post-"I mean" as intended content

Teacher response: respond to the final corrected content only.
See [[SELF_CORRECTION_PATTERNS]].

---

### Repeated Words

| Raw STT | Interpretation |
|---------|---------------|
| "my my teacher" | Stutter — intended: "my teacher" |
| "because because" | Restart — intended: reason clause follows |
| "she she never" | Stutter — intended: "she never gave up" |

**Rule**: Repeated identical words at phrase boundary = stutter/restart.
Normalize by deduplicating before slot detection.

---

### Fragmented Answers

Student stops mid-sentence: "Jordan inspires me be—"

STT: "Jordan inspires me be"

Result:
- Subject present: "Jordan" ✓
- Reason marker partial: "be" → NOT matched by REASON_MARKERS
- `missingSlots: ['reason']`
- Teacher: "Good start. Jordan inspires you. Now add why: 'Jordan inspires me because ...'"

Student does NOT need to restart the full answer.
Teacher prompts for the missing fragment only.

---

### Short Answers / Near-Miss

| Student Said | STT | Intended | Handling |
|-------------|-----|---------|---------|
| "Cause he works" | "Cause he works" | "Because he works" | `cause` → reason marker (check) |
| "'Cause of him" | "Cause of him" | "Because of him" | Ambiguous — semantic content check |
| "He never stopped" | "He never stopped" | Reason (explanatory clause) | `hasSecondExplanatoryClause()` check |

**Rule**: "cause" (informal "because") may not be in REASON_MARKERS. When checking, `hasSecondExplanatoryClause()` provides a fallback for two-sentence answers.

---

### Student Pronunciation Recovery

Student mispronounces, self-corrects:
1. "Wanna... want to say..." → fragmented → refocus signal
2. "Spe... special" → stutter → detected as self-correction in progress

Teacher does NOT penalize for the stutter.
Teacher responds to the final word if it completes a slot.

---

## What the Validator Does NOT Handle

- Homophones that happen to be correct words ("to" / "two" / "too")
- Severe accents that produce completely unrelated phonemes
- Multi-word substitution (entire phrase replaced by STT)
- Names not in the subject-guess heuristic's detection range (very short names < 4 chars)

When validator cannot resolve: `issueType: 'pronunciation_or_stt'` with targeted reprompt.
Teacher responds: "I understand — you mean [interpretedMeaning]. [repair prompt]"

---

## Teacher Calibration

When STT produces an unlikely output:
1. Check if it matches any known noise pattern
2. Check if subject-guess detected a plausible name
3. Check if semantic word count still meets threshold
4. Check if required slots are present despite noise

Only if ALL checks fail → conclude the student did not answer the exercise.
