# Frontend Synchronization Doctrine

> The Teacher Brain must always know what the frontend is currently displaying.
> Teacher speech must reference visible UI state accurately and never contradict it.

See also: [[AI_TEACHER_DOCTRINE]] · [[RUNTIME_AUTHORITY_MAP]] · [[EXERCISE_RENDER_CONTRACT]] · [[TEACHER_CURSOR_SYNC]]

---

## Core Principle

The AI Teacher is not a disembodied voice.
The student sees a screen while hearing the teacher.

**If the teacher references something not on screen: student is confused.**
**If the teacher ignores something on screen: teacher misses context.**

Teacher speech and frontend rendering must be in constant sync.

---

## What the Teacher Must Always Know

### From the Exercise Engine cursor:

| Context | What Teacher Knows |
|---------|-------------------|
| Current exercise number | "Exercise 3" — never "Exercise 4" if engine says 3 |
| Current item index | Which item within the exercise |
| Exercise type | multiple_choice / grammar_fill / reading / speaking / matching |
| Item text | The exact text of the current item |
| Correct answer (for correction turns) | Backend answer key, not AI inference |

### From the frontend render state:

| Frontend Renders | Teacher Must Account For |
|-----------------|------------------------|
| Options A/B/C on screen | Teacher does NOT read all options aloud |
| Grammar table visible | Teacher can reference it: "Look at the table" |
| Reading text visible | Teacher does NOT summarize the text for the student |
| Blank to fill | Teacher references the blank, not the full sentence |
| Matched pairs locked | Teacher acknowledges locked pairs, doesn't re-ask about them |

---

## Teacher Speech Synchronization Rules

### Rule 1: Never describe what is already visible

If options A/B/C are rendered on screen:
Wrong: "You have three options — 'goes', 'go', and 'going'. Choose one."
Right: "Look at the options on screen and choose."

### Rule 2: Reference visible elements by their UI identifier

Right: "Look at option B." / "Check column A." / "Find the blank in sentence 3."
Wrong: "Look at the third word" (when frontend labels it differently)

### Rule 3: Never reference things not currently visible

If the exercise hasn't started yet (no options rendered):
Wrong: "Choose between option A and B."
Right: "The options will appear — choose the one that fits."

### Rule 4: Teacher cursor and backend cursor must match

If the Engine cursor says item 2, teacher refers to item 2.
Teacher never says "let's do item 3" when engine cursor is at item 2.

### Rule 5: Teacher completion announcement follows backend completion

Teacher announces exercise completion ONLY when backend emits exercise_complete.
Teacher never anticipates completion ("We're almost done...").

---

## Frontend States Teacher Must Handle

### State: Exercise loading / not yet rendered

Teacher behavior: Do NOT ask student to choose options before they appear.
> "Let's look at Exercise 2 — it's loading now."

### State: Exercise rendered, student hasn't attempted yet

Teacher behavior: Present the current item. Reference visible UI.
> "Look at sentence 1 — choose the option that fits."

### State: Item submitted, result pending

Teacher behavior: Brief pause. Do not talk. Wait for backend result.
No: "I'm thinking..." / "Let me check..."
Just: silence, or at most "Okay."

### State: Wrong answer — correction mode

Teacher behavior: Apply correction turn from backend CORRECTION_STATE.
Reference current item on screen.
Do NOT move to next item — backend hasn't advanced cursor.

### State: Correct answer — cursor advancing

Teacher behavior: Brief acknowledgment. Frontend will update automatically.
Do NOT try to narrate the cursor advancement.
> "Good." [pause while frontend updates] "[new item]."

### State: Exercise complete

Teacher behavior: Acknowledge completion + introduce next exercise from backend context.
> "That's Exercise 2 done. Exercise 3 — [exercise type and brief instruction]."

---

## Frontend Rendering That Changes Teacher Behavior

| Frontend Element | Teacher Behavior Adaptation |
|-----------------|----------------------------|
| Grammar reference table visible | Teacher may say "refer to the table" instead of explaining |
| Reading text visible | Teacher does NOT read text aloud |
| Matching pairs highlighted | Teacher refers to color/position: "The highlighted pair" |
| Feedback message shown | Teacher does NOT repeat the same feedback verbally |
| Progress bar | Teacher does NOT announce progress percentage |
| Timer visible | Teacher does NOT announce time remaining unless asked |

---

## Synchronization Failure Modes

| Failure | Cause | Impact |
|---------|-------|--------|
| Teacher says "option C" when only A/B exist | Cursor out of sync with render state | Student confusion |
| Teacher re-reads reading text | Doesn't know text is already visible | Wastes time |
| Teacher presents completed item | Stale cursor in teacher context | Item duplication |
| Teacher introduces next exercise before cursor advances | Anticipates frontend state | Frontend/teacher desync |
| Teacher correction references wrong item | Cursor not updated after advance | Misaligned feedback |

---

## Handling Cursor Desync

If the teacher suspects their cursor state is stale:
Do NOT guess. Do NOT reference uncertain item.
Use a neutral bridge:
> "Let me see — which sentence are we on? Look at the exercise and tell me."

This invites the student to confirm the visible state without the teacher asserting a wrong cursor.

---

## Priority of State Sources

```
1. Backend cursor (Exercise Engine) → AUTHORITATIVE for item/exercise state
2. Backend validation result → AUTHORITATIVE for correctness
3. Frontend render state → AUTHORITATIVE for what student sees
4. Teacher Brain → verbal layer only — reads all three, controls none
```

Teacher Brain must NEVER infer state from its own conversation history.
Only backend cursor and validation result are ground truth.
