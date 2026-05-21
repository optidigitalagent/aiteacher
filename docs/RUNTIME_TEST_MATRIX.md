# RUNTIME_TEST_MATRIX.md

# PURPOSE

This document defines:
mandatory runtime validation scenarios
for the AI Teacher Paid Lesson Runtime.

The goal is:
to prevent regressions,
runtime instability,
voice chaos,
billing corruption,
and reconnect failures.

Every major phase MUST pass relevant tests
before being considered stable.

--------------------------------------------------
SECTION 1 — CORE LESSON FLOW TESTS
--------------------------------------------------

# TEST 1 — Begin Lesson Gate

Goal:
Verify no runtime activity before lesson start.

Steps:
1. Open classroom
2. Wait on "Begin Lesson"
3. Monitor logs and network

Expected:
- no STT streaming
- no TTS generation
- no AI calls
- no paid minute consumption
- no websocket lesson activity beyond connection

Failure conditions:
- AI speaks before begin
- STT starts before begin
- billing starts before begin

--------------------------------------------------

# TEST 2 — Normal Lesson Start

Goal:
Verify deterministic lesson initialization.

Steps:
1. Click Begin Lesson
2. Observe first teacher turn

Expected:
- teacher introduces lesson goal
- teacher references selected section
- teacher explains current task
- lesson cursor initialized correctly
- no duplicated teacher messages

Failure conditions:
- GPT-style greeting
- duplicated intro
- missing exercise context
- missing lesson objective

--------------------------------------------------

# TEST 3 — Exercise Progression

Goal:
Verify deterministic exercise flow.

Steps:
1. Complete multiple exercises
2. Observe transitions

Expected:
- clear transitions
- preserved exercise order
- correct progression
- visible lesson structure

Failure conditions:
- random jumps
- skipped exercises
- invented exercises
- repeated exercises

--------------------------------------------------
SECTION 2 — REALTIME VOICE TESTS
--------------------------------------------------

# TEST 4 — Teacher Speech Interruption

Goal:
Verify natural interruption handling.

Steps:
1. Let teacher speak
2. Interrupt with mic input

Expected:
- teacher pauses naturally
- student input processed
- teacher responds
- lesson resumes naturally

Failure conditions:
- duplicated teacher speech
- ignored interruption
- corrupted progression
- overlapping TTS

--------------------------------------------------

# TEST 5 — Echo Loop Protection

Goal:
Prevent teacher self-transcription.

Steps:
1. Use speakers instead of headphones
2. Let teacher speak loudly

Expected:
- teacher voice NOT transcribed as student
- no recursive AI loop

Failure conditions:
- AI responds to itself
- self-transcription detected
- repeated teacher loops

--------------------------------------------------

# TEST 6 — Speaking State Accuracy

Goal:
Verify speaking lifecycle correctness.

Steps:
1. Observe long teacher response
2. Watch mic enable timing

Expected:
- mic disabled during teacher speech
- mic re-enabled ONLY after playback ends
- speaking indicator accurate

Failure conditions:
- mic activates too early
- playback still running while mic active
- stale speaking state

--------------------------------------------------

# TEST 7 — Push-To-Talk Stability

Goal:
Verify controlled mic lifecycle.

Steps:
1. Rapidly toggle mic
2. Interrupt repeatedly

Expected:
- stable recording lifecycle
- no stuck recording
- no duplicate streams

Failure conditions:
- permanent open mic
- duplicated STT
- broken recording state

--------------------------------------------------
SECTION 3 — READING MODE TESTS
--------------------------------------------------

# TEST 8 — Realtime Reading Flow

Goal:
Verify guided reading behavior.

Steps:
1. Start reading exercise
2. Read paragraph aloud

Expected:
- one chunk visible
- teacher listens live
- natural pacing
- reading progression preserved

Failure conditions:
- full text dump
- passive transcription mode
- lost reading cursor

--------------------------------------------------

# TEST 9 — Pronunciation Intervention

Goal:
Verify live correction behavior.

Steps:
1. Mispronounce difficult word

Expected:
- teacher interrupts naturally
- pronunciation correction provided
- reading resumes correctly

Failure conditions:
- reading resets
- correction ignored
- duplicated reading flow

--------------------------------------------------

# TEST 10 — Reading Resume

Goal:
Verify reading persistence.

Steps:
1. Disconnect during reading
2. Reconnect

Expected:
- exact paragraph restored
- exact sentence restored
- reading resumes correctly

Failure conditions:
- reading restart
- wrong paragraph
- lost cursor

--------------------------------------------------
SECTION 4 — RECONNECT TESTS
--------------------------------------------------

# TEST 11 — Browser Refresh Mid-Lesson

Goal:
Verify reconnect safety.

Steps:
1. Refresh browser mid-exercise

Expected:
- lesson restored
- progression preserved
- no duplicate AI turns

Failure conditions:
- lesson restart
- duplicated messages
- lost state

--------------------------------------------------

# TEST 12 — Network Disconnect Recovery

Goal:
Verify websocket resilience.

Steps:
1. Simulate internet drop
2. Restore connection

Expected:
- clean reconnect
- preserved runtime
- stable continuation

Failure conditions:
- duplicated runtime
- stale reconnect
- broken lesson

--------------------------------------------------

# TEST 13 — Save-And-Leave

Goal:
Verify persistence integrity.

Steps:
1. Leave during exercise
2. Resume later

Expected:
- exact lesson restoration
- preserved remaining time
- preserved exercise state

Failure conditions:
- lesson restart
- cursor corruption
- time reset

--------------------------------------------------
SECTION 5 — CURRICULUM TESTS
--------------------------------------------------

# TEST 14 — Multi-Unit Progression

Goal:
Verify curriculum scaling.

Steps:
1. Test different units/sections

Expected:
- consistent lesson behavior
- correct exercise rendering
- correct transitions

Failure conditions:
- unit-specific instability
- broken renderers
- inconsistent pacing

--------------------------------------------------

# TEST 15 — Exercise Renderer Compatibility

Goal:
Verify all exercise types.

Test:
- fill-gap
- matching
- reading
- vocabulary
- grammar
- mixed flows

Expected:
- deterministic rendering
- stable progression

Failure conditions:
- malformed exercises
- missing instructions
- broken progression

--------------------------------------------------
SECTION 6 — AI BEHAVIOR TESTS
--------------------------------------------------

# TEST 16 — Agenda Recovery

Goal:
Verify lesson continuity after side questions.

Steps:
1. Ask unrelated question mid-exercise

Expected:
- concise answer
- smooth lesson recovery

Failure conditions:
- lesson derailment
- forgotten exercise
- GPT-style tangent

--------------------------------------------------

# TEST 17 — GPT Rambling Prevention

Goal:
Verify concise teacher behavior.

Steps:
1. Trigger explanations repeatedly

Expected:
- concise contextual teaching
- no essays
- no fluff

Failure conditions:
- long monologues
- repetitive encouragement
- assistant-style behavior

--------------------------------------------------

# TEST 18 — Personality Consistency

Goal:
Verify Emma/Alex differentiation.

Expected:
Emma:
- warm
- patient
- encouraging

Alex:
- concise
- structured
- disciplined

Failure conditions:
- identical personalities
- exaggerated personalities
- structure breakdown

--------------------------------------------------
SECTION 7 — MEMORY & REFLECTION TESTS
--------------------------------------------------

# TEST 19 — Persistent Learning Memory

Goal:
Verify educational memory persistence.

Steps:
1. Repeat grammar mistake
2. Start later lesson

Expected:
- teacher remembers weakness
- contextual reminder appears

Failure conditions:
- no memory persistence
- creepy memory behavior
- unrelated recall

--------------------------------------------------

# TEST 20 — Lesson Reflection Quality

Goal:
Verify reflection realism.

Expected:
- real strengths
- real weaknesses
- real pronunciation notes
- real grammar notes

Failure conditions:
- generic GPT summary
- fake observations
- unrelated feedback

--------------------------------------------------
SECTION 8 — BILLING & COST TESTS
--------------------------------------------------

# TEST 21 — Minute Consumption Accuracy

Goal:
Verify billing integrity.

Expected:
- accurate minute tracking
- reconnect-safe billing
- no duplicate billing

Failure conditions:
- inflated minutes
- missing minutes
- duplicate usage rows

--------------------------------------------------

# TEST 22 — Cost Runaway Prevention

Goal:
Verify runtime efficiency.

Monitor:
- AI call count
- TTS count
- STT streaming time

Expected:
- no duplicate generation
- no recursive loops
- controlled usage

Failure conditions:
- runaway orchestration
- duplicate TTS
- permanent STT

--------------------------------------------------
SECTION 9 — STABILITY TESTS
--------------------------------------------------

# TEST 23 — Full 50-Minute Lesson

Goal:
Verify long-session stability.

Expected:
- stable runtime
- stable memory
- stable reconnects
- stable progression

Failure conditions:
- degradation over time
- state corruption
- duplicated events

--------------------------------------------------

# TEST 24 — Rapid Interrupt Spam

Goal:
Stress-test realtime lifecycle.

Steps:
1. Rapidly interrupt teacher repeatedly

Expected:
- stable orchestration
- stable TTS lifecycle
- stable mic lifecycle

Failure conditions:
- runtime chaos
- duplicated AI turns
- broken speaking states

--------------------------------------------------

# TEST 25 — Weak Network Simulation

Goal:
Verify production resilience.

Simulate:
- packet loss
- reconnects
- delayed websocket delivery

Expected:
- graceful recovery
- deterministic continuation

Failure conditions:
- duplicated sessions
- stale state
- reconnect corruption

--------------------------------------------------
SECTION 10 — FINAL ACCEPTANCE CRITERIA
--------------------------------------------------

The runtime is NOT considered stable unless:

- reconnects are deterministic
- reading mode stable
- voice lifecycle stable
- billing accurate
- exercise progression deterministic
- AI behavior teacher-like
- no GPT-style chaos
- no recursive voice loops
- no duplicated runtime ownership
- lesson continuity preserved
- curriculum grounding preserved
- runtime survives long lessons
- production deployment stable

--------------------------------------------------
FINAL RULE
--------------------------------------------------

Passing TypeScript compilation
does NOT mean
the runtime is stable.

ONLY:
real runtime behavior
determines runtime quality.