# RUNTIME_TEST_MATRIX.md

# PURPOSE

This document defines the test scenarios that must be validated after each phase.
Tests are organized by phase. Phase 0 establishes the baseline and audit results.

No automated test runner exists for runtime behavior — these are manual validation
scenarios to be checked before marking a phase complete.

--------------------------------------------------
PHASE 0 — RUNTIME AUDIT BASELINE
--------------------------------------------------

# WHAT WAS AUDITED (not tested — observation only)

The following was verified by code inspection:

✅ Backend typecheck passes (npm run build — no errors)
✅ Frontend typecheck passes (tsc --noEmit — no errors)
✅ lesson_ready event defined and emitted after WS auth
✅ aiProcessing guard added to prevent concurrent AI calls
✅ STT starts immediately on lesson begin (always-on — known gap)
✅ TTS abort correctly propagated via AbortController
✅ teacher_turn_end sent after TTS completes
✅ Billing finalized on WS disconnect
✅ Resume logic checks Redis TTL and lesson_sessions table
✅ 50-minute hard cap via setTimeout in ClientMeta.maxDurationRef

# KNOWN GAPS IDENTIFIED (not fixed in Phase 0)

❌ STT stays open during teacher TTS (echo risk) — Phase 1
❌ isSpeaking can get stuck if teacher_turn_end is lost — Phase 1
❌ No cost counters persisted to DB (only logged) — future phase
❌ No SIGTERM handler for billing finalize on process crash — future phase
❌ Resume restores only rough state (not exact cursor) — Phase 6

--------------------------------------------------
PHASE 1 — VOICE RUNTIME STABILITY TESTS
--------------------------------------------------

These tests must be validated manually before Phase 1 is complete:

# Test 1.1 — Interrupt Mid-Sentence
1. Start lesson, wait for teacher to speak
2. Click mic button during teacher speech
3. Expected: teacher TTS stops immediately, mic opens, STT begins
4. Expected: no duplicate teacher response after interrupt

# Test 1.2 — Rapid Interrupt Spam
1. Click interrupt button 5 times in rapid succession
2. Expected: system stabilizes, no duplicate AI calls, no overlapping audio

# Test 1.3 — Reconnect During Teacher Speech
1. Start lesson, wait for teacher to speak
2. Close browser tab and reopen during TTS
3. Expected: resume message sent, no orphaned TTS playing

# Test 1.4 — Reconnect During Student Speech
1. Open mic, start speaking
2. Close and reopen tab
3. Expected: STT stops cleanly, no transcript sent for incomplete utterance

# Test 1.5 — Mic Toggle Cycles
1. Click mic on → speak → click mic off → click mic on again
2. Expected: each toggle creates new clean STT session, no overlap

# Test 1.6 — Echo Loop Test
1. Let teacher speak through speakers (no headphones)
2. Keep mic enabled during teacher playback
3. Expected: STT does NOT transcribe teacher audio and trigger new AI call

# Test 1.7 — Multiple Begin Lesson Clicks
1. Click "Begin Lesson" button 3 times rapidly
2. Expected: only one lesson created, only one greeting sent, no duplicate STT

# Test 1.8 — Typing While Teacher Speaks
1. Let teacher speak, simultaneously type in text input
2. Submit message while teacher is mid-sentence
3. Expected: message is queued or held, no duplicate AI calls (aiProcessing guard)

--------------------------------------------------
PHASE 2 — LESSON STATE MACHINE TESTS
--------------------------------------------------

# Test 2.1 — Lesson Timeout at 50 Minutes
1. Set PAID_PLAN_LESSON_MINUTES=1 in env for testing
2. Start lesson, wait for timeout
3. Expected: SESSION_TIME_LIMIT error sent, WS closed with 4408, billing finalized

# Test 2.2 — Reconnect Preserves Lesson State
1. Start lesson, complete 2 exercises
2. Close tab, wait 30 seconds, reopen
3. Expected: lesson resumed, exercise number correct, phase correct

# Test 2.3 — Side Question Returns To Agenda
1. During EXERCISES phase, type an off-topic question
2. Expected: teacher answers briefly, then returns to current exercise number

# Test 2.4 — Phase Transitions Are Deterministic
1. Start lesson, observe DIAGNOSTIC → CONTEXT_INPUT transition
2. Expected: exactly 2 student exchanges before transition in free mode

# Test 2.5 — Pause/Resume Preserves Objective
1. Leave modal → "Save & Exit" → return to lesson
2. Expected: resumed at same exercise number, same phase

--------------------------------------------------
PHASE 3 — TEXTBOOK ENGINE TESTS
--------------------------------------------------

# Test 3.1 — Exercise Comes From Textbook
1. Start section 1.2 lesson
2. Expected: Exercise 1 content matches Focus 2 Unit 1 textbook exactly

# Test 3.2 — Word Box Rendering
1. Navigate to an exercise with word box
2. Expected: all words visible, used word marked after correct answer

# Test 3.3 — Reading Paragraph Rendering
1. Navigate to a reading section
2. Expected: paragraph displayed, student can read aloud, teacher can interrupt

# Test 3.4 — Reconnect During Reading
1. Start reading exercise, close tab mid-reading
2. Expected: same paragraph shown on resume, no restart from beginning

# Test 3.5 — Cursor Persistence
1. Complete 3 exercises in section 1.2
2. Close tab, reconnect
3. Expected: resume at exercise 4, not exercise 1

--------------------------------------------------
PHASE 4-8 TESTS
--------------------------------------------------

Tests for Phases 4-8 will be defined in their respective phase prompts.
Each phase must define its own acceptance criteria tests before implementation.
