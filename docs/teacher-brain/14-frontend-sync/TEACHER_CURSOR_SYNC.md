# Teacher Cursor Sync

> How the Teacher Brain cursor stays synchronized with the Exercise Engine.
> Cursor drift is the source of most "teacher references wrong item" failures.

See also: [[FRONTEND_SYNC_DOCTRINE]] · [[RUNTIME_AUTHORITY_MAP]] · [[EXERCISE_RENDER_CONTRACT]]

---

## What Is the Teacher Cursor

The teacher cursor is the teacher's current view of:
- Which exercise is active
- Which item within the exercise
- Which correction turn (A/B/C/D) is active
- Whether the exercise is complete

**The teacher cursor is derived from backend state — not maintained independently.**

---

## Cursor State Sources

| State Element | Source | Teacher Action |
|---------------|--------|---------------|
| Exercise number | Engine `exerciseId` | Read and reference |
| Item index | Engine `itemIndex` | Read and reference |
| Item text | Engine manifest | Read verbatim |
| Correction turn | Engine `correctionState` | Read and apply ladder |
| Exercise complete | Engine `status === 'complete'` | Acknowledge and transition |
| Next exercise | Engine manifest (next exercise) | Announce and intro |

---

## Cursor Synchronization Events

The teacher cursor updates at these events:

### Event: `exercise_start`
Teacher receives: exercise type, item count, first item text
Teacher action: Demonstrate format (if new type). Present item 1.

### Event: `item_submitted_correct`
Teacher receives: updated cursor with new item index + new item text
Teacher action: Brief acknowledgment. Present new item immediately.
Critical: Do NOT present the OLD item. Cursor has advanced.

### Event: `item_submitted_incorrect`
Teacher receives: correction state (A/B/C/D) + item text (unchanged)
Teacher action: Apply correction turn. Present same item with hint.
Critical: Do NOT advance to next item. Cursor has NOT moved.

### Event: `item_complete_after_turn_d`
Teacher receives: updated cursor with new item index
Teacher action: Same as `item_submitted_correct`.

### Event: `exercise_complete`
Teacher receives: completion signal + next exercise context
Teacher action: Acknowledge completion. Introduce next exercise.

---

## Cursor Drift Failure Modes

### Failure 1: Teacher uses stale item after cursor advance

**Cause:** Teacher uses cached item text from before Engine advanced cursor.

**Symptom:**
```
Engine: cursor at item 3
Teacher: "Now try sentence 2 again..." 
```

**Prevention:**
Teacher must use only item text from current backend context block.
Never cache item text across turns.

---

### Failure 2: Teacher advances to next item without backend signal

**Cause:** Teacher infers "the student got it right" and presents next item before validation.

**Symptom:**
```
Student: "She goes to school." (correct)
Teacher: "Good. Now sentence 2..." (before backend confirms)
Backend: (arrives with incorrect result from validator edge case)
Teacher is now at item 2, backend is at item 1
```

**Prevention:**
Wait for backend validation result before presenting next item.
Only `item_submitted_correct` event triggers cursor advance in teacher speech.

---

### Failure 3: Teacher goes back to previous item

**Cause:** Teacher decides student should "review" a completed item.

**Symptom:**
```
Engine: cursor at item 3
Teacher: "Actually, let's revisit sentence 1..." 
```

**Prevention:**
Completed items are hard-closed. Teacher NEVER revisits them.
If student asks to revisit: "That one's done — let's keep going with sentence 3."

---

### Failure 4: Teacher references exercise N+1 while on N

**Cause:** Teacher anticipates curriculum.

**Symptom:**
```
Engine: on Exercise 2
Teacher: "Good — Exercise 3 asks you to..."
```

**Prevention:**
Only reference the current exercise and the next exercise AT TRANSITION time.
Never announce future exercises mid-current-exercise.

---

## Cursor Verification Protocol

When teacher is uncertain about cursor state:
1. Do NOT guess current item number
2. Do NOT reference last-known item text
3. Use neutral bridge: "Which sentence are we on?"
4. Accept student's answer as context clue
5. Confirm with next backend event

This is the safe failure mode.

---

## Multi-Item Exercises

For exercises with multiple items (e.g., 8 gap-fill items):

**Correct behavior:**
- Present one item at a time
- Wait for student answer
- Wait for backend validation
- On correct: move to next
- On incorrect: correction turn for SAME item

**Wrong behavior:**
- Present multiple items at once
- Move on after student answer without waiting for validation
- Skip items because "they seem easy"

---

## Exercise Restart Prohibition

Under no circumstances may the teacher restart a curriculum exercise.
If student asks to redo an exercise: the answer is always NO.

> "We've moved past that exercise. Let's keep going."

The Exercise Engine does not support backward cursor movement.
Any teacher attempt to restart creates an irreconcilable state desync.
