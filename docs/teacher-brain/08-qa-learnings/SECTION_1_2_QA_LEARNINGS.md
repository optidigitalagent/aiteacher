# Section 1.2 QA Learnings

> Bugs discovered during paid textbook lesson testing in section 1.2. Root causes and fixes.

See also: [[KNOWN_RUNTIME_FAILURES]] · [[SOFT_SPEAKING_PROTOCOL]] · [[RUNTIME_AUTHORITY_MAP]]

---

## Context

Section 1.2 is the first paid textbook section containing:
- Grammar fill exercises (deterministic_sequential)
- Soft speaking exercises (reason_required with subject + reason slots)
- Discussion exercises (generic_discussion)

Most runtime bugs were discovered here during structured QA testing.

---

## Bug 1: Readiness Intent Completing Exercise 1

**Symptom:**
Student says "I'm ready" at lesson start. Exercise 1 was marked as complete.

**Root cause:**
lesson-ws was routing "I'm ready" as an exercise answer to the Validation System.
Validation passed it (or failed silently) and the orchestrator advanced the cursor.

**Fix:**
Added `READINESS_PATTERNS` regex check in lesson-ws BEFORE answer routing.
"I'm ready" is intercepted → exercise flow signal → teacher prompts to start exercise.

**Rule derived:**
Readiness intent must be intercepted in lesson-ws before validation.
It must NEVER reach the Validation System as an exercise answer.

**See:** [[VOICE_RUNTIME_ARCHITECTURE]] — Readiness Intent Guard section.

---

## Bug 2: exerciseCursor Stale State After Correct Answer

**Symptom:**
Student gives a correct answer. Backend advances cursor. Teacher Brain reads OLD cursor and presents stale item as the next prompt.

**Root cause:**
Teacher Brain was invoked with the pre-validation cursor snapshot.
The cursor was fetched before `submitAnswer()` returned.

**Fix:**
Teacher Brain invocation moved to AFTER `submitAnswer()` completes and returns updated cursor.
Cursor passed to Teacher Brain is always the post-validation state.

**Rule derived:**
Teacher Brain must always use the cursor returned by submitAnswer(), not the cursor from before validation.

**Anti-chaos rule 13:** After answering correctly, return to the updated current item — not a stale one.

---

## Bug 3: Frontend Stale State on Incorrect Answer

**Symptom:**
Frontend shows correct exercise UI (item A) but Teacher Brain speaks about item B.

**Root cause:**
Frontend was inferring exercise state from Teacher Brain text instead of reading backend cursor events.
Teacher Brain occasionally referenced the next item while frontend was still on current item.

**Fix:**
Frontend strictly reads backend cursor from WebSocket events.
Teacher Brain forbidden from referencing exercise state that hasn't been confirmed by backend.

**Rule derived:**
Frontend must never infer exercise state from teacher text.
Frontend renders backend cursor — always.

---

## Bug 4: Progression Loop on Soft Speaking

**Symptom:**
Student answers soft speaking exercise. Teacher asks the same question again. Repeat indefinitely.

**Root cause:**
Soft speaking exercises were not resetting attempt counter after exercise completion.
Validator was re-running on new exercise without recognizing the exercise had changed.

**Fix:**
`resetSoftAttempts()` called on exercise completion.
Redis counter `ss_attempts:{lessonId}:{exerciseId}` keyed by exerciseId — unique per exercise.

**Rule derived:**
Soft speaking attempt counter is scoped to exerciseId, not exerciseType.
New exercise = fresh attempt counter.

---

## Bug 5: Missing Slot Bypassed by Max Attempts

**Symptom:**
Student says "Jordan" (subject only) for "Who inspires you and why?" three times.
After third attempt: validator accepted and allowed progression without reason slot.

**Root cause:**
Max-attempts soft-accept was firing before required-slot check.
Incorrect ordering in validation logic.

**Fix:**
Slot detection moved to run FIRST — always.
missingSlots gate checked BEFORE max-attempts check.
Max-attempts soft-accept only fires when missingSlots.length === 0.

**Rule derived:**
Required slots always block progression regardless of attempt count.
Max-attempts soft-accept is an anti-loop safeguard — not a slot bypass.

**See:** [[SOFT_SPEAKING_PROTOCOL]] — Slot Ordering Invariant section.

---

## Bug 6: Teacher Repetition Loop on Failed Validation

**Symptom:**
Validation returns `needsRetry: true` with repairPrompt. Teacher delivers repairPrompt. Student responds. Validation runs again with same repairPrompt. Teacher repeats identical message three times.

**Root cause:**
repairPrompt was built without considering attempt count.
Teacher was delivering the same repair on every attempt.

**Fix:**
`buildPedagogicalRetry()` targets only the FIRST missing slot per call.
Teacher instruction: change framing if same issue persists across attempts.

**Rule derived:**
Same repair prompt must not repeat verbatim on consecutive attempts.
After attempt 2: change framing or escalate to soft accept.

---

## Bug 7: Engine Phase / Orchestrator Phase Desync

**Symptom:**
Exercise Engine reports exercise 2 active. Master Orchestrator is processing exercise 1 responses.

**Root cause:**
Exercise completion event from Engine was not propagated to Orchestrator before next answer arrived.
Race condition between progression event and next student input.

**Fix:**
Orchestrator checks engine state before processing each answer.
Stale exercise answers rejected if exerciseId doesn't match current engine cursor.

**Rule derived:**
exerciseId must be attached to every answer submission.
Stale answers (wrong exerciseId) are rejected silently.

---

## Bug 8: Spurious Interrupt on Mic Stop

**Symptom:**
Student stops recording. System sends interrupt signal. Teacher mid-response gets cut off incorrectly.

**Root cause:**
`mic_stop` event was treated as an interrupt signal in the TTS pipeline.
TTS buffer was being discarded prematurely.

**Fix:**
`mic_stop` event does not trigger interrupt.
Interrupt is only triggered by a new voice activity detection during TTS playback.

**Rule derived:**
mic_stop ≠ interrupt.
Interrupt = new voice activity while TTS is playing.

---

## Regression Prevention

For every new exercise type or section:

1. Test "I'm ready" as first student input → must NOT complete any exercise
2. Test correct answer → cursor must advance → Teacher Brain must read updated cursor
3. Test soft speaking with subject only (missing reason) → must NOT allow progression
4. Test 3 identical wrong answers → must NOT loop beyond attempt 3
5. Test frontend after correct answer → must show updated cursor, not stale state
6. Test section transition → exercise cursor must not regress
