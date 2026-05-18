# Soft Speaking Protocol

> The most complex exercise type. Requires slot-based validation, STT interpretation, and anti-loop safeguards.

Applies to: `discussion`, `personal_fill`, `pair_speaking`, `guided_speaking`, `any_response`

See also: [[AI_TEACHER_DOCTRINE]] · [[PEDAGOGICAL_RETRY_POLICY]] · [[STT_NOISE_PATTERNS]] · [[SELF_CORRECTION_PATTERNS]] · [[FORMAL_SPOKEN_INTERPRETATION_RUNTIME]]

---

## Core Principle

Soft speaking exercises have **no single correct answer**.
The Teacher guides quality, not correctness.
The backend Validation System gates progression via **slot detection**, not semantic scoring.

**AI does not decide if the answer is acceptable.**
The `validateSoftSpeakingAnswer()` function does — deterministically, no LLM calls.

---

## Task Kinds

| Task Kind | Required Slots | Example Instruction |
|-----------|---------------|---------------------|
| `reason_required` | `subject`, `reason` | "Who inspires you and why?" |
| `personal_answer` | `subject` | "Who is your favourite person?" |
| `preference` | `preference` (+ `reason` if "why") | "What kind of music do you like and why?" |
| `description` | `object` | "What are you reading at the moment?" |
| `question_answer_pair` | `question`, `answer` | "Ask and answer about hobbies" |
| `generic_discussion` | none | "Tell me about your weekend" |

Task kind is inferred deterministically from the instruction text.
No exercise number, no section ID — **instruction text only**.

---

## Required Slots

| Slot | Detection Logic |
|------|----------------|
| `subject` | Non-stopword, non-filler, non-grammar word present (length > 1) |
| `reason` | Causal connector: "because", "since", "due to", "that's why", causal "so", two-sentence form (He/She clause) |
| `preference` | Preference markers: "like", "love", "enjoy", "prefer", "favourite", "hate", "dislike", etc. |
| `object` | ≥ 2 semantic words present |
| `time` | Time markers: "now", "at the moment", "currently", "today", "right now", etc. |
| `place` | Place preposition + noun: "at school", "in London" |
| `question` | Question word at start OR contains "?" |
| `answer` | ≥ 2 semantic words |

**Missing required slots ALWAYS block progression.**
No override. No max-attempts exception for missing slots.

---

## Validation Flow

```
Student transcript arrives
    ↓
1. Readiness intent check → intercept "I'm ready" → reprompt with instruction
    ↓
2. Pure filler check → "ok", "yeah", "sure" → off_task → reprompt
    ↓
3. inferSoftSpeakingTask(instruction) → determine taskKind + requiredSlots
    ↓
4. detectAnswerSlots(transcript, requiredSlots) → presentSlots, missingSlots
    ↓
5a. missingSlots.length > 0:
    ├── broken grammar? → broken_grammar → guide toward full form
    ├── self-correction detected? → pronunciation_or_stt → acknowledge + repair
    ├── < 2 semantic words? → too_short → ask for more
    ├── some slots present? → missing_reason / missing_subject / etc. → targeted repair
    └── no slots detected? → unclear_subject → prompt to answer properly
    ↓
5b. missingSlots.length === 0 (all slots present):
    ├── attemptCount >= 3 AND semWords >= 2 → acceptable_with_repair (soft accept)
    ├── broken grammar → acceptable_with_repair + grammar hint (allow progression)
    └── clean → accepted (allowProgression = true)
```

---

## Slot Ordering Invariant

1. `detectAnswerSlots()` runs FIRST — always
2. `missingSlots.length > 0` ALWAYS blocks progression — no exceptions
3. `acceptable_with_repair` and max-attempts soft-accept only fire when ALL required slots present

This invariant prevents the teacher from accepting incomplete answers through soft-accept shortcuts.

---

## acceptable_with_repair

Triggered when:
- All required slots are present
- Broken grammar detected

Effect:
- `allowProgression = true`
- `isPartiallyAcceptable = true`
- `issueType = 'acceptable_with_repair'`
- Teacher delivers a grammar repair hint AFTER accepting

Example teacher response:
> "Good. Better: 'Jordan inspires me because he works hard.' Let's keep going."

**Not a retry. Teacher accepts, then repairs, then moves forward.**

---

## Missing Reason (Most Common Case)

Student: "Jordan" (subject present, reason absent)

Result:
- `issueType: 'missing_reason'`
- `allowProgression: false`
- `repairPrompt: "Good start. Jordan inspires you. Now add why: 'Jordan inspires me because ...'"`

Teacher delivers repairPrompt verbatim (or adapted).
Does NOT ask the student a new question. Targets the missing slot only.

---

## Broken Grammar Handling

Examples:
- "me inspire Jordan" → SOV inversion → `broken_grammar`
- "may inspire Jordan" → STT: "may" = "me" → `broken_grammar`
- "he inspire me" → missing -s → `broken_grammar`
- "Jordan inspire me" → missing -s → `broken_grammar`

When broken grammar AND missing slots:
```
allowProgression = false
repairPrompt = "Good idea — Jordan. Say it like this: 'Jordan inspires me because ...' Now you try."
```

When broken grammar AND all slots present:
```
allowProgression = true  (acceptable_with_repair)
teacherHint = "Good. Better: 'Jordan inspires me because ...'"
```

---

## STT Ambiguity Interpretation

See [[STT_NOISE_PATTERNS]] for full phonetic pattern catalog.

For soft speaking, STT artifacts are common for:
- "may" → "me" (SOV broken grammar path, not a modal verb)
- "is" → "ease" (ignored noise)
- "Viv" → subject detected via name-candidate heuristic

Self-correction detection:
- "I mean X" → extract X as intended answer
- "not X ... I mean Y" → extract Y

See [[SELF_CORRECTION_PATTERNS]] for full detection logic.

---

## Anti-Looping Safeguards

| Safeguard | Trigger |
|-----------|---------|
| Max-attempts soft-accept | `attemptCount >= 3` AND all required slots present AND `semWords >= 2` |
| Off-task filler max-attempts | `attemptCount >= 3` AND pure filler → `acceptable_with_repair` |
| Generic discussion length grace | `semWords < 3` only blocks for attempts < 3 |

**After 3 genuine attempts: accept and move forward.**
The teacher must not endlessly retry the same item with the same prompt.

Redis counter: `ss_attempts:{lessonId}:{exerciseId}` — TTL 4 hours.
Counter is reset when exercise completes.

See [[PEDAGOGICAL_RETRY_POLICY]] for retry philosophy.

---

## Teacher Behavior Contract

**One open prompt per speaking exercise.**
Never a numbered list of sub-questions.

**Wait for one student response before giving feedback.**
Do not stack questions.

**After one substantive response + brief feedback: mark exercise complete.**
Do not create interview flows.

**One-word or filler response**: ask ONCE for fuller answer.
If student gives ANY second response (however short): accept and complete.

**Never ask a third time.**

---

## Correction Language

Forbidden:
- "Wrong"
- "Incorrect"
- "That's not right"

Required (soft):
- "Good start..."
- "Almost..."
- "Not quite..."
- "Try to add..."
- "Say it like this..."

---

## Speaking Exercise Does NOT Use A/B/C/D

The correction ladder (A/B/C/D) applies to deterministic exercises only.
Soft speaking uses: reprompt → targeted slot repair → soft accept → complete.
See [[GRAMMAR_FILL_PROTOCOL]] for correction ladder.
