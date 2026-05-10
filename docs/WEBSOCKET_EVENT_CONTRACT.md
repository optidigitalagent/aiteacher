# WEBSOCKET_EVENT_CONTRACT.md

# PURPOSE

This document defines the authoritative websocket runtime contract
for the AI Teacher Paid Lesson system.

This is NOT just a socket event list.

This document defines:
- runtime ownership
- event lifecycle
- state synchronization
- interruption behavior
- realtime voice orchestration
- reconnect persistence
- billing-safe runtime flow
- deterministic frontend/backend coordination

The websocket layer is the backbone of the realtime classroom.

Any undocumented websocket behavior is considered unsafe.

--------------------------------------------------
SECTION 1 — CORE PRINCIPLES
--------------------------------------------------

# PRINCIPLE 1 — Backend Owns Runtime Truth

Frontend is a renderer and interaction layer.

Backend owns:
- lesson state
- progression
- exercise cursor
- billing runtime
- speaking ownership
- lesson persistence
- AI orchestration
- reconnect restoration

Frontend must NEVER:
- invent progression
- fake lesson completion
- infer billing state
- locally advance exercises
- create local-only lesson state

--------------------------------------------------

# PRINCIPLE 2 — One Runtime Owner

At any moment only ONE layer owns the active turn:

Either:
- Teacher owns turn
OR
- Student owns turn

Never both simultaneously.

This prevents:
- overlapping speech
- echo loops
- duplicated AI responses
- uncontrolled STT streaming

--------------------------------------------------

# PRINCIPLE 3 — Websocket Events Are State Transitions

Events are not random messages.

Every websocket event must:
- represent a valid runtime action
- fit into lesson FSM
- be resumable
- be replay-safe
- be deterministic

--------------------------------------------------

# PRINCIPLE 4 — Realtime Runtime Must Be Interruptible

Student interruption is a core feature.

The runtime must support:
- teacher interruption
- pause/resume
- side questions
- reading corrections
- reconnect continuation

Without corrupting:
- lesson state
- exercise cursor
- teacher agenda

--------------------------------------------------

# PRINCIPLE 5 — Zero Ghost Runtime

No background runtime is allowed.

When:
- websocket disconnects
- lesson pauses
- user leaves
- timeout occurs

The system must stop:
- STT
- TTS
- AI generation
- billing accumulation

--------------------------------------------------
SECTION 2 — CONNECTION LIFECYCLE
--------------------------------------------------

# CONNECTION FLOW

```txt
client opens classroom
↓
websocket connects
↓
backend authenticates token
↓
backend emits lesson_ready   ← added Phase 0
↓
frontend shows Begin Lesson
↓
user clicks Begin Lesson
↓
frontend sends focus_lesson_start
↓
backend validates paid session
↓
backend checks for resume (lesson_sessions + Redis)
↓
if resume: lesson_resumed emitted → STT starts
if new:    lesson created → greeting emitted → STT starts
↓
lesson begins
```

# DISCONNECT / RECONNECT FLOW

```txt
client disconnects (close, refresh, network drop)
↓
backend: stt.close() → ttsController.abort() → billing finalized
↓
client reconnects
↓
backend authenticates token
↓
lesson_ready emitted
↓
user clicks Begin Lesson (or auto-resume if sessionId matches)
↓
focus_lesson_start sent again
↓
backend: check lesson_sessions for active lesson_id
↓
if Redis state exists with > 1min remaining:
  lesson_resumed emitted → STT starts → new greeting
↓
if Redis expired or < 1min remaining:
  SESSION_TIME_LIMIT error → fresh lesson must be started
```

--------------------------------------------------
SECTION 3 — INBOUND EVENTS (Frontend → Backend)
--------------------------------------------------

# EVENT: focus_lesson_start

Trigger: User clicks "Begin Lesson" button
Sent once per lesson session (double-click protected by `beginSentRef`)

Payload:
```json
{
  "type": "focus_lesson_start",
  "payload": {
    "unit": 1,
    "section": "1.2",
    "teacherId": "alex",
    "voiceId": "onyx"
  }
}
```

Backend behavior:
- Validates subscription → 402 error if invalid
- Checks for existing lesson to resume
- Creates lesson or resumes
- Starts STT connection
- Sends greeting + TTS

--

# EVENT: text_message

Trigger: User types and submits text input
Guard: Blocked if aiProcessing=true (Phase 0) or lesson not started

Payload:
```json
{
  "type": "text_message",
  "text": "student input text"
}
```

Backend behavior:
- Calls processInput() → AI turn → TTS response

--

# EVENT: audio_chunk

Trigger: Sent continuously while mic is active (every 4096 PCM samples ≈ 256ms)
Guard: Backend ignores chunks if stt===null (before lesson start)

Payload:
```json
{
  "type": "audio_chunk",
  "data": "base64-encoded PCM Int16 linear16 16kHz mono"
}
```

Backend behavior:
- Forwarded to Deepgram STT connection
- STT fires UtteranceEnd → processInput() when silence detected

--

# EVENT: interrupt

Trigger: User clicks mic button while teacher is speaking (or mic toggle off)
Frontend: sends interrupt when toggling mic OFF (stopRecording sends interrupt)

Payload:
```json
{
  "type": "interrupt"
}
```

Backend behavior:
- Calls meta.ttsController?.abort() → stops TTS stream
- Does NOT send teacher_turn_end on abort
- AI processing guard (aiProcessing) remains true until current AI call returns

Known gap (Phase 1): if interrupt arrives AFTER AI call completes but BEFORE TTS starts,
the new TTS will start and immediately abort. This is functionally correct but wastes one API call.

--

# EVENT: exercise_answer

Trigger: User submits an answer to a structured exercise
Guard: Only sent when `pendingId` is set in useLessonSession

Payload:
```json
{
  "type": "exercise_answer",
  "exerciseId": "uuid",
  "answer": "student answer text"
}
```

Backend behavior:
- Loads exercise from exercise_store
- Validates answer via validateAnswer()
- Records result via orchestrator.recordExerciseResult()
- Sends feedback event
- Calls processInput() with [EXERCISE RESULT] context

--

# EVENT: student_confused

Trigger: User clicks "I don't understand" (Explain button)

Payload:
```json
{
  "type": "student_confused",
  "lastTeacherMessage": "...",
  "lastExercise": "...",
  "studentLastAnswer": "..."
}
```

Backend behavior:
- Calls processInput() with CONFUSION PROTOCOL context
- AI returns MINI TEACHING CARD in display_text
- teaching_card event sent to frontend

--

# EVENT: lesson_start (legacy free mode)

Trigger: Legacy free-form lesson (not Focus 2 textbook mode)
Status: Kept for backwards compatibility. Focus mode is primary.

Payload:
```json
{
  "type": "lesson_start",
  "payload": {
    "studentId": "uuid",
    "grammarTarget": "Present Simple",
    "lessonTopic": "Travel",
    "textbookUnit": "Unit 1"
  }
}
```

--------------------------------------------------
SECTION 4 — OUTBOUND EVENTS (Backend → Frontend)
--------------------------------------------------

# EVENT: lesson_ready  ← Added Phase 0

Trigger: Sent immediately after WS connection is authenticated
Meaning: "Begin Lesson" button is safe to show

Payload:
```json
{
  "type": "lesson_ready",
  "sessionId": "session-uuid or null"
}
```

Frontend behavior:
- Set `paidLessonReady = true`
- Show "Begin Lesson" panel

--

# EVENT: ai_text

Trigger: AI has returned a response text for this turn
Meaning: Teacher is about to speak; auto-stop student mic

Payload:
```json
{
  "type": "ai_text",
  "phase": "EXERCISES",
  "text": "what teacher says aloud",
  "displayText": "formatted for screen (optional)"
}
```

Frontend behavior:
- Push to chat as AI message
- Set isSpeaking=true
- Call stopRecording() to stop PCM capture

--

# EVENT: audio_chunk

Trigger: TTS streaming — one event per MP3 chunk
Timing: Arrives in a stream while teacher speaks

Payload:
```json
{
  "type": "audio_chunk",
  "data": "base64 MP3 chunk"
}
```

Frontend behavior:
- Schedule chunk in AudioContext queue (streaming playback)
- Set isSpeaking=true
- Schedule isSpeaking=false 2s after last chunk (rolling window)

--

# EVENT: teacher_turn_end

Trigger: Sent after all TTS audio chunks for this turn have been streamed
Meaning: "No more audio chunks are coming for this teacher turn"
NOT sent if TTS is aborted by interrupt

Payload:
```json
{
  "type": "teacher_turn_end"
}
```

Frontend behavior:
- Calculate exact remaining audio queue time via getScheduledAudioEndMs()
- Schedule isSpeaking=false at precise audio end + 300ms buffer
- This prevents mic from opening before last word finishes

--

# EVENT: student_message

Trigger: STT transcript passed the voice filter (not a filler/fragment)
Meaning: This transcript was sent to the AI for processing

Payload:
```json
{
  "type": "student_message",
  "text": "student utterance"
}
```

Frontend behavior:
- Push to chat as student message (visible in chat panel)

--

# EVENT: transcript

Trigger: STT partial or final transcript received (before filter)
Meaning: Real-time transcription preview (may not be sent to AI)

Payload:
```json
{
  "type": "transcript",
  "text": "partial transcription"
}
```

Frontend behavior:
- Update live transcript preview in teacher panel

--

# EVENT: exercise

Trigger: AI response includes an exercise object
Meaning: Show exercise card to student

Payload:
```json
{
  "type": "exercise",
  "exercise": {
    "id": "uuid",
    "exerciseType": "form_transformation",
    "question": "current item text",
    "hint": "progressive hint",
    "difficulty": 0.5,
    "exerciseNumber": 2,
    "instruction": "Complete using correct form",
    "skillFocus": "Past Simple irregular verbs",
    "items": ["1. item text", "2. item text", "3. item text"]
  }
}
```

Frontend behavior:
- Render exercise card in center panel
- Clear previous teaching card
- Set pendingId for exercise_answer routing

--

# EVENT: feedback

Trigger: exercise_answer result returned from validator
Meaning: Show correct/incorrect feedback to student

Payload:
```json
{
  "type": "feedback",
  "correct": true,
  "explanation": "Because..."
}
```

Frontend behavior:
- Show green (correct) or red (wrong) feedback on exercise card
- If correct: clear answer field after 1.8s delay

--

# EVENT: phase_change

Trigger: Lesson FSM transitions between phases
Meaning: Update lesson progress timeline

Payload:
```json
{
  "type": "phase_change",
  "from": "DIAGNOSTIC",
  "to": "CONTEXT_INPUT"
}
```

Frontend behavior:
- Mark previous phase as 'done' in steps array
- Mark new phase as 'active'

--

# EVENT: teaching_card

Trigger: AI returned confusion response with MINI TEACHING CARD in display_text
Meaning: Show explanation overlay in classroom center

Payload:
```json
{
  "type": "teaching_card",
  "cardType": "mini_explanation",
  "displayText": "**Rule:** ... **Form:** ... **Example:** ..."
}
```

Frontend behavior:
- Show TeachingOverlay component (dismissable)

--

# EVENT: section_card

Trigger: Grammar overview card generated/loaded from cache for this section
Meaning: Optional grammar reference card (cached per section)

Payload:
```json
{
  "type": "section_card",
  "sectionId": "1.2",
  "card": { ... SlideSpec object ... }
}
```

Frontend behavior:
- Currently: no-op (section_card case does nothing in handler)
- Future: could render as pinned grammar reference

--

# EVENT: lesson_resumed

Trigger: Student reconnected and existing lesson was found in Redis
Meaning: Resume the lesson in progress

Payload:
```json
{
  "type": "lesson_resumed",
  "phase": "EXERCISES",
  "exerciseNum": 3,
  "message": "Welcome back! We were on Exercise 3. Let's continue..."
}
```

Frontend behavior:
- Set lessonStarted=true
- Push resumeMessage to chat as AI message
- Set isSpeaking=true (TTS follows immediately)

--

# EVENT: lesson_end

Trigger: AI signals end_lesson OR lesson phase reaches END
Meaning: Show lesson complete modal

Payload:
```json
{
  "type": "lesson_end",
  "summary": {
    "lessonId": "uuid",
    "phasesReached": ["DIAGNOSTIC", "CONTEXT_INPUT", "RULE_DISCOVERY"],
    "exerciseScore": 0,
    "vocabularyCount": 0,
    "durationMin": 23
  }
}
```

Frontend behavior:
- Show PaidLessonCompleteModal
- Billing finalized by backend on subsequent WS close

--

# EVENT: error

Trigger: Various error conditions
Meaning: Show error UI or redirect

Payload:
```json
{
  "type": "error",
  "code": "PAYMENT_REQUIRED",
  "message": "Active subscription required."
}
```

Error codes:
- `AUTH_REQUIRED` — JWT missing or invalid
- `PAYMENT_REQUIRED` — no active subscription
- `SUBSCRIPTION_EXPIRED` — subscription expired
- `LESSON_LIMIT_REACHED` — no minutes remaining
- `SESSION_TIME_LIMIT` — 50-minute cap reached
- `NO_LESSON` — message before lesson started
- `NO_STUDENT` — no authenticated student
- `UNIT_NOT_FOUND` — Focus unit not available
- `EXERCISE_NOT_FOUND` — exercise UUID not in DB
- `INVALID_JSON` — malformed WS message
- `INVALID_MESSAGE` — message fails Zod schema
- `SERVER_ERROR` — unhandled exception

Frontend behavior for payment errors:
- Set wsConnectError message → show error panel with "Try again"
- Redirect codes: PAYMENT_REQUIRED, SUBSCRIPTION_EXPIRED, LESSON_LIMIT_REACHED

--------------------------------------------------
SECTION 5 — RUNTIME GUARANTEES
--------------------------------------------------

# GUARANTEE 1 — lesson_ready Before lesson_start

Backend always emits `lesson_ready` before any lesson can be started.
Frontend MUST NOT send `focus_lesson_start` until `lesson_ready` is received.

# GUARANTEE 2 — teacher_turn_end After TTS (or not at all)

`teacher_turn_end` is sent ONLY after successful TTS streaming.
If TTS is aborted (interrupt), `teacher_turn_end` is NOT sent.
Frontend must not wait for `teacher_turn_end` after sending interrupt.

# GUARANTEE 3 — student_message Before AI Turn

`student_message` is always sent BEFORE the AI processes the transcript.
This means the chat message appears before the AI response, not after.

# GUARANTEE 4 — AI Call Serialization (Phase 0)

`aiProcessing` flag prevents concurrent `processInput()` calls.
Second input during AI processing is silently dropped with a log:
`[paid-lesson] ai_turn_skipped reason=concurrent_call`

# GUARANTEE 5 — Billing Finalized On Every Disconnect

`finalizeUsage()` is called in every WS close handler path.
It runs even after error close codes (4408 time limit, 4402 payment required).
Only exception: process crash (no SIGTERM handler yet).

--------------------------------------------------
SECTION 6 — FUTURE EVENTS (NOT YET IMPLEMENTED)
--------------------------------------------------

These events are defined in PAID_LESSON_RUNTIME_ROADMAP.md for future phases
but do NOT exist in the current codebase as of Phase 0:

Planned for Phase 2:
- `lesson_state_changed` — FSM state update (LESSON_READY → INTRO → ...)
- `lesson_timer_update` — remaining seconds broadcast to frontend
- `lesson_paused` — explicit pause state

Planned for Phase 3:
- `exercise_cursor_updated` — exact cursor position update
- `reading_chunk` — sentence/paragraph for reading exercise

Phase 5 (IMPLEMENTED — see below):
- `tip_added` — new persistent learning tip saved (live, mid-lesson)
- `tip_list` — recent tips history sent at lesson start

# EVENT: tip_list (Phase 5)

Trigger: Sent immediately after lesson start (after `lesson_ready`), before student clicks Begin Lesson
Meaning: Initialise the student's Notes drawer with their historical tips from previous lessons

Payload:
```json
{
  "type": "tip_list",
  "tips": [
    {
      "id": "uuid",
      "studentId": "uuid",
      "lessonId": "uuid or null",
      "section": "1.2 or null",
      "category": "GRAMMAR",
      "title": "Past Simple irregular verbs",
      "explanation": "Student needed clarification during EXERCISES phase",
      "example": null,
      "source": "confusion",
      "createdAt": "2026-05-10T12:00:00.000Z"
    }
  ]
}
```

Categories: VOCAB | PHRASE | GRAMMAR | PRONUNCIATION | COMMON_MISTAKE
Sources: confusion | correction | vocabulary | observation

Frontend behavior:
- Set `tips` state to received array
- Show floating Notes button if `tips.length > 0` (paid mode only)

--

# EVENT: tip_added (Phase 5)

Trigger: Sent when a new tip is created mid-lesson (confusion signal, or lesson-end tip batch)
Meaning: Append new tip to the student's Notes drawer

Payload:
```json
{
  "type": "tip_added",
  "tip": {
    "id": "uuid",
    "studentId": "uuid",
    "category": "COMMON_MISTAKE",
    "title": "Past Simple: reached",
    "explanation": "Wrote 'reacched' — common double-consonant error",
    "example": null,
    "source": "correction",
    "createdAt": "2026-05-10T12:34:56.000Z"
  }
}
```

Frontend behavior:
- Deduplicate by `tip.id` before prepending to `tips` state
- Notes button badge count updates automatically

Planned for Phase 6:
- `reflection_started` — beginning of reflection phase
- `lesson_snapshot_saved` — explicit snapshot confirmation
