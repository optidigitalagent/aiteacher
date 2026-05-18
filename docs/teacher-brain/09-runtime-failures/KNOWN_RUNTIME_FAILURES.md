# Known Runtime Failures

> Production failure modes with root causes and prevention rules. Do not repeat these.

See also: [[SECTION_1_2_QA_LEARNINGS]] · [[RUNTIME_AUTHORITY_MAP]] · [[AI_TEACHER_DOCTRINE]]

---

## Failure Classification

| Class | Description |
|-------|-------------|
| STATE | State corruption — cursor, cursor sync, stale state |
| LOOP | Infinite or excessive retry loops |
| BYPASS | Validation or authority bypass |
| VOICE | Voice pipeline failures |
| AI | Teacher Brain behavioral failures |

---

## STATE-01: Stale Cursor After Correct Answer

**Class:** STATE
**Symptom:** Teacher Brain presents item N after backend has advanced to item N+1.
**Root cause:** Teacher Brain invoked before `submitAnswer()` returned updated cursor.
**Prevention:** Always pass post-validation cursor to Teacher Brain. Never use pre-validation snapshot.
**Related:** [[SECTION_1_2_QA_LEARNINGS]] Bug 2

---

## STATE-02: Frontend Rendering Stale Exercise

**Class:** STATE
**Symptom:** Frontend shows Exercise 1 UI while Teacher Brain is speaking about Exercise 2.
**Root cause:** Frontend inferred exercise state from Teacher Brain text instead of backend cursor events.
**Prevention:** Frontend reads backend cursor from WebSocket events only. Never parses teacher text.
**Rule:** Frontend must treat teacher messages as speech only. No state inference.

---

## STATE-03: exerciseId Mismatch After Reconnect

**Class:** STATE
**Symptom:** After WebSocket reconnect, student answers are routed to wrong exercise.
**Root cause:** Reconnected session loaded stale exerciseId from cache.
**Prevention:** Resume cursor fetched from PostgreSQL (persistent source of truth), not Redis cache alone.

---

## STATE-04: Engine Phase / Orchestrator Phase Desync

**Class:** STATE
**Symptom:** Engine on Exercise 2, Orchestrator processing Exercise 1 answers.
**Root cause:** Progression event not propagated to Orchestrator before next answer arrived.
**Prevention:** exerciseId attached to every answer. Stale exerciseId answers rejected silently.

---

## LOOP-01: Soft Speaking Infinite Retry

**Class:** LOOP
**Symptom:** Teacher asks same question repeatedly. Student answers. Same question again.
**Root cause:** Attempt counter not reset on exercise change. Validator re-running with stale counter.
**Prevention:** `resetSoftAttempts()` on exercise completion. Counter keyed by exerciseId.
**Related:** [[SECTION_1_2_QA_LEARNINGS]] Bug 4

---

## LOOP-02: Same Repair Prompt Repeated

**Class:** LOOP
**Symptom:** Teacher delivers identical repair prompt on attempt 1, 2, and 3.
**Root cause:** repairPrompt built without considering attempt number. No framing change.
**Prevention:** Change framing on second attempt. Soft accept after third attempt.
**Rule:** Repair prompt may never repeat verbatim on consecutive attempts.

---

## LOOP-03: Correction Turn Restart

**Class:** LOOP
**Symptom:** Backend has advanced to TURN C. Teacher delivers TURN A hint again.
**Root cause:** AI re-derived correction turn from conversation history instead of reading backend CORRECTION STATE.
**Prevention:** Correction turn is read from backend state exclusively. Never re-derived from history.
**Rule:** Never restart correction at TURN A after backend advanced.

---

## LOOP-04: Post-Skip Vocabulary Invention

**Class:** LOOP + AI
**Symptom:** Teacher skips unsupported exercise, then starts inventing vocabulary or discussion.
**Root cause:** AI filled the gap after skip with invented educational content.
**Prevention:** Skip announcement + next exercise must be in ONE response. No invented content after skip.
**Anti-chaos rule 2:** Never invent vocabulary exercises after unsupported exercise skip.

---

## BYPASS-01: Missing Slot Bypassed by Max Attempts

**Class:** BYPASS
**Symptom:** Student with only subject slot (missing reason) accepted after 3 attempts.
**Root cause:** Max-attempts check ran before required-slot check.
**Prevention:** Slot gate runs FIRST. Max-attempts only fires when all required slots present.
**See:** [[SOFT_SPEAKING_PROTOCOL]] — Slot Ordering Invariant
**Related:** [[SECTION_1_2_QA_LEARNINGS]] Bug 5

---

## BYPASS-02: Readiness Intent Completing Exercise

**Class:** BYPASS
**Symptom:** "I'm ready" completes Exercise 1.
**Root cause:** Readiness intent routed as exercise answer to Validation System.
**Prevention:** READINESS_PATTERNS regex check in lesson-ws BEFORE answer routing.
**Related:** [[SECTION_1_2_QA_LEARNINGS]] Bug 1

---

## BYPASS-03: Teacher Brain Overriding Validation

**Class:** BYPASS
**Symptom:** Teacher says "Well done!" after validator returned `allowProgression: false`.
**Root cause:** Teacher Brain generated response independent of validation result.
**Prevention:** Teacher Brain receives validation result and must reflect it accurately.
**Rule:** Teacher Brain must not tell student their answer is correct if validator marked it incorrect.

---

## VOICE-01: Partial Transcript Submitted as Answer

**Class:** VOICE
**Symptom:** Student's mid-utterance words submitted as complete answer. Fails validation.
**Root cause:** lesson-ws submitted on partial transcript event instead of final transcript.
**Prevention:** Only final transcript events may submit answers. Partial = UI preview only.

---

## VOICE-02: WebSocket 1006 Crash (STT Keepalive)

**Class:** VOICE
**Symptom:** WebSocket disconnects with code 1006. Session lost.
**Root cause:** STT keepalive threw unhandled exception, crashing the WebSocket handler.
**Prevention:** STT keepalive wrapped in try/catch. Disconnect after 45 min inactivity.

---

## VOICE-03: Old Transcript Replayed After Reconnect

**Class:** VOICE
**Symptom:** After reconnect, teacher responds to old student message from previous session.
**Root cause:** Cached transcript ID reused on reconnect. Deduplication not cleared.
**Prevention:** Turn deduplication keyed by transcript ID + session ID. Cleared on reconnect.

---

## VOICE-04: Spurious Interrupt on Mic Stop

**Class:** VOICE
**Symptom:** Teacher response cut off when student stops recording.
**Root cause:** `mic_stop` event incorrectly treated as interrupt signal.
**Prevention:** mic_stop ≠ interrupt. Interrupt = new voice activity during TTS playback only.
**Related:** [[SECTION_1_2_QA_LEARNINGS]] Bug 8

---

## VOICE-05: STT Running After Lesson End

**Class:** VOICE
**Symptom:** STT stream continues after lesson marked complete. Memory / billing leak.
**Root cause:** SIGTERM handler not closing STT stream on lesson end.
**Prevention:** SIGTERM handler explicitly closes STT stream. Lesson end event closes stream.

---

## AI-01: Teacher Referencing Wrong Exercise Number

**Class:** AI
**Symptom:** Teacher says "Exercise 4" when engine state shows Exercise 3.
**Root cause:** AI guessed exercise number from conversation context.
**Prevention:** Exercise number in any announcement must match ENGINE STATE block exactly.
**Anti-chaos rule 16:** Exercise number must come from ENGINE STATE — never invented.

---

## AI-02: Teacher Inventing Next Item After Skip

**Class:** AI
**Symptom:** After unsupported exercise skip, teacher describes what the listening exercise would have been.
**Root cause:** AI hallucinated content for the skipped exercise.
**Prevention:** After skip: state skip in one sentence + immediately present next textbook exercise.
**Anti-chaos rule 3:** Never reconstruct hidden listening content.

---

## AI-03: Teacher Drifting to Item 1 After Clarification

**Class:** AI
**Symptom:** Student asks clarification question. Teacher answers. Teacher then presents item 1 instead of the current item.
**Root cause:** AI re-anchored to exercise start after side question instead of returning to current item.
**Prevention:** Side question handled → return to EXACT current item (by itemIndex from engine state).
**Anti-chaos rule 13:** After side question, return to exact current item — not item 1.

---

## AI-04: "I'm Thinking..." Stall

**Class:** AI
**Symptom:** Teacher says "I'm thinking about that..." causing silence gap in voice interaction.
**Root cause:** AI hesitation phrase in response.
**Prevention:** "I'm thinking" is absolutely forbidden. Pick most likely interpretation and respond immediately.

---

## Prevention Checklist

Before shipping any runtime change:

- [ ] Readiness intent guard in lesson-ws (not in validator)
- [ ] Teacher Brain receives post-validation cursor
- [ ] Slot gate runs before max-attempts check
- [ ] Correction turn read from backend state, not conversation history
- [ ] Skip response contains no invented content
- [ ] mic_stop does not trigger interrupt
- [ ] exerciseId attached to every answer submission
- [ ] STT stream closed on lesson end
