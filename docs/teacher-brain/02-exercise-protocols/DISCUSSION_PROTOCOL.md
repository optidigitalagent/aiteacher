# Discussion Protocol

> Free discussion exercises. No single correct answer. Teacher guides quality, not correctness.

Applies to: `generic_discussion`, `open_speaking`, `free_talk`, exercises with no required slots

See also: [[SOFT_SPEAKING_PROTOCOL]] · [[VOICE_PEDAGOGY_DOCTRINE]] · [[PEDAGOGICAL_RETRY_POLICY]]

---

## Core Principle

Discussion exercises are **open-ended**. There is no correct answer.
The Teacher does not evaluate content correctness.
The Teacher guides fluency and completeness.

**This is the lowest-friction exercise type.**
If the student gives any substantive response, the exercise should complete.

---

## Validation Threshold

`generic_discussion` task kind has no required slots.
Validation requires:
- ≥ 3 semantic words
- OR: student has already attempted once (attempt ≥ 1 → accept shorter responses)

If student gives < 3 semantic words on first attempt:
- `issueType: 'too_short'`
- One soft reprompt: "Try to give a fuller answer. [instruction]"

If student gives any second response:
- Accept unconditionally
- Complete the exercise

**Never ask a third time.**

---

## Teacher Script

**First prompt** (from backend context — exact instruction text):
> "Tell me about a person who has influenced you."

**If student gives minimal answer (one attempt)**:
> "Try to say a bit more. Who influenced you and why?"

**After any second response**:
> "Good. [brief acknowledgment]. Let's move on."

---

## Conversation Traps to Avoid

| Trap | Problem | Fix |
|------|---------|-----|
| Multiple sub-questions | Creates interview feel, overwhelms student | One prompt only |
| Asking for exact phrasing | Discussion ≠ deterministic exercise | Accept any substantive response |
| Prolonged follow-up | Delays curriculum progression | One follow-up max |
| Content evaluation | Teacher evaluates content accuracy | Teacher evaluates fluency only |
| Third attempt | Loop failure | Accept after second attempt always |

---

## Relationship to Soft Speaking

Discussion exercises are a subset of soft-speaking exercises with `requiredSlots = []`.
The slot-based validation still runs — but passes automatically when ≥ 3 semantic words present.
The same anti-loop safeguards apply.

See [[SOFT_SPEAKING_PROTOCOL]] for the full validation flow.

---

## When Validator Overrides Teacher Intuition

The validator may accept a response that the teacher considers weak.
**Accept the validator's decision.**

If `allowProgression = true`, move forward even if teacher would want more.
Pedagogy serves the student, not the teacher's standard of quality.
