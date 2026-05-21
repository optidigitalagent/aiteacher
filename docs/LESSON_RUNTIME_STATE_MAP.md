# LESSON_RUNTIME_STATE_MAP.md

# PURPOSE

This document defines the authoritative state map for the Paid Lesson Runtime.

The goal is to prevent:
- random lesson transitions
- AI drifting between exercises
- duplicated teacher turns
- broken resume behavior
- unclear lesson ownership
- frontend/backend state mismatch
- uncontrolled voice runtime behavior

This is a runtime contract.

Every Claude session working on paid lessons must preserve this state model.

--------------------------------------------------
SECTION 1 — CORE PRINCIPLE
--------------------------------------------------

The paid lesson runtime is not a chat.

It is a deterministic state machine.

At every moment, the backend must know:

- what lesson state is active
- what exercise is active
- what student action is expected
- what teacher action is allowed
- what runtime events can transition state
- what must be persisted for resume

The frontend renders state.

The backend owns state.

--------------------------------------------------
SECTION 2 — TOP-LEVEL STATES
--------------------------------------------------

# 1. LESSON_READY

Meaning:
The classroom is open, websocket is connected, but the lesson has not started yet.

User sees:
- selected textbook
- selected section
- teacher
- voice
- Begin Lesson button

Allowed:
- user can click Begin Lesson
- user can leave classroom
- websocket can reconnect

Forbidden:
- no AI calls
- no TTS
- no STT
- no paid minute consumption
- no exercise progression

Transition out:
- Begin Lesson clicked → INTRO

Persist:
- sessionId
- selected teacher
- selected voice
- selected section
- paid session link

--------------------------------------------------

# 2. INTRO

Meaning:
Teacher starts the lesson after Begin Lesson.

Teacher must:
- greet briefly
- reference selected textbook/section
- explain today’s goal
- preview lesson structure

Allowed:
- teacher TTS
- student can interrupt
- teacher can transition to topic interactive

Transition out:
- intro complete → TOPIC_INTERACTIVE

Persist:
- lesson started_at
- teacherId
- voiceId
- sectionId
- lesson goal

--------------------------------------------------

# 3. TOPIC_INTERACTIVE

Meaning:
Short warmup connected to the section topic.

Purpose:
- engage student
- activate vocabulary
- get student speaking
- connect real life to textbook topic

Allowed:
- one short teacher question
- one or two student replies
- brief teacher response

Forbidden:
- long free conversation
- unrelated small talk
- skipping textbook transition

Transition out:
- warmup complete → EXERCISE_INTRO

Persist:
- warmup prompt
- student response summary
- engagement notes

--------------------------------------------------

# 4. EXERCISE_INTRO

Meaning:
Teacher introduces the next textbook exercise.

Teacher must explain:
- exercise number
- page/section if available
- task instruction
- what student should do
- how responses will be checked

Allowed:
- teacher explanation
- student clarification question

Transition out:
- exercise understood → EXERCISE_ACTIVE
- exercise is reading → READING_ACTIVE
- student asks side question → SIDE_QUESTION

Persist:
- current exercise id
- instruction
- expected response mode
- exercise type

--------------------------------------------------

# 5. EXERCISE_ACTIVE

Meaning:
Student is actively completing a non-reading exercise.

Examples:
- fill gap
- grammar transform
- word box
- matching
- vocabulary answer
- speaking prompt

Runtime must track:
- current item index
- expected answer
- retry count
- completed items
- failed items
- word box state if any

Allowed:
- student voice answer
- student text answer
- teacher correction
- retry
- advance to next item

Forbidden:
- skipping item without teacher decision
- advancing on unclear answer
- inventing new exercise item
- losing cursor

Transition out:
- item correct → EXERCISE_ACTIVE next item
- exercise complete → EXERCISE_INTRO next exercise
- paragraph complete → REFLECTION
- side question → SIDE_QUESTION
- timeout → LESSON_COMPLETE
- reading exercise begins → READING_ACTIVE

Persist:
- exercise cursor
- current item
- attempts
- answer correctness
- corrections
- word box used/remaining

--------------------------------------------------

# 6. READING_ACTIVE

Meaning:
Student is reading textbook content aloud.

Runtime must show:
- one reading chunk at a time
- current paragraph/sentence
- reading progress

Teacher must:
- listen in realtime
- compare against reference text
- help with blocked pronunciation
- correct serious pronunciation issues
- continue reading flow

Allowed:
- realtime pronunciation intervention
- student repeat word
- continue chunk
- move to next paragraph

Forbidden:
- dumping full long text
- passive transcript-only checking
- losing reading paragraph
- overcorrecting every accent detail

Transition out:
- chunk complete → READING_ACTIVE next chunk
- reading exercise complete → EXERCISE_INTRO next exercise
- side question → SIDE_QUESTION
- timeout → LESSON_COMPLETE

Persist:
- reading paragraph index
- sentence index if needed
- pronunciation issues
- corrected words
- completed chunks

--------------------------------------------------

# 7. SIDE_QUESTION

Meaning:
Student interrupts or asks something that is not the direct expected answer.

Examples:
- “What does impossible mean?”
- “Can you repeat?”
- “Why is it past simple?”
- “How do I say this word?”
- “Translate this phrase.”

Teacher must:
1. answer briefly
2. save tip if useful
3. return to previous state and agenda

Allowed:
- short explanation
- pronunciation model
- translation hint
- grammar reminder

Forbidden:
- turning into free chat
- losing current exercise
- ending with no task continuation
- changing lesson topic

Transition out:
- answer complete → previous active state

Persist:
- interrupted_from_state
- interrupted_exercise
- interrupted_item
- question type
- generated tip if any
- return instruction

--------------------------------------------------

# 8. REFLECTION

Meaning:
Short review after paragraph completion or near lesson end.

Reflection must be based on real runtime data:
- mistakes
- tips
- pronunciation issues
- grammar issues
- completed exercises

Allowed:
- 2–4 minute micro-review
- short quiz
- recap
- next focus suggestion

Forbidden:
- generic GPT summary
- long test
- exceeding 50-minute runtime
- starting reflection too late

Transition out:
- paragraph reflection complete and time remains → PARAGRAPH_COMPLETE
- lesson time nearly over → LESSON_COMPLETE

Persist:
- reflection questions
- reflection answers
- weak areas
- next recommended focus

--------------------------------------------------

# 9. PARAGRAPH_COMPLETE

Meaning:
Current paragraph/section has been completed.

Teacher must:
- acknowledge completion
- summarize progress
- offer next paragraph if time remains
- offer save and exit

Allowed:
- Next Paragraph
- Save and Exit
- Start reflection if not done

Transition out:
- next paragraph selected → TOPIC_INTERACTIVE
- save exit → PAUSED
- time ended → LESSON_COMPLETE

Persist:
- completed paragraph
- paragraph summary
- next paragraph candidate
- remaining lesson time

--------------------------------------------------

# 10. PAUSED

Meaning:
Lesson has been intentionally paused or user left.

Runtime must:
- stop STT
- stop TTS
- stop active teacher turn
- persist exact state
- allow resume

Allowed:
- resume same lesson
- start new lesson only if previous 50-min container ended

Forbidden:
- continuing AI in background
- consuming minutes silently
- losing cursor

Transition out:
- resume clicked → previous saved state
- lesson expired → LESSON_COMPLETE

Persist:
- full lesson snapshot
- cursor
- remaining time
- active agenda
- tips
- teacher/voice

--------------------------------------------------

# 11. LESSON_COMPLETE

Meaning:
The 50-minute lesson container has ended or was finalized.

Runtime must:
- stop AI/STT/TTS
- finalize billing usage
- persist progress
- show completion summary
- allow starting next lesson if subscription allows

Allowed:
- start new paid lesson
- view summary
- return to learning page

Forbidden:
- continuing same runtime beyond 50 minutes
- hidden background activity
- unbilled continuation

Persist:
- final usage
- lesson summary
- last cursor
- completed progress
- tips
- reflection summary

--------------------------------------------------
SECTION 3 — STATE TRANSITION MAP
--------------------------------------------------

Allowed transitions:

LESSON_READY
→ INTRO

INTRO
→ TOPIC_INTERACTIVE
→ SIDE_QUESTION

TOPIC_INTERACTIVE
→ EXERCISE_INTRO
→ SIDE_QUESTION

EXERCISE_INTRO
→ EXERCISE_ACTIVE
→ READING_ACTIVE
→ SIDE_QUESTION
→ LESSON_COMPLETE

EXERCISE_ACTIVE
→ EXERCISE_ACTIVE
→ EXERCISE_INTRO
→ SIDE_QUESTION
→ REFLECTION
→ LESSON_COMPLETE
→ PAUSED

READING_ACTIVE
→ READING_ACTIVE
→ EXERCISE_INTRO
→ SIDE_QUESTION
→ REFLECTION
→ LESSON_COMPLETE
→ PAUSED

SIDE_QUESTION
→ previous active state

REFLECTION
→ PARAGRAPH_COMPLETE
→ LESSON_COMPLETE
→ PAUSED

PARAGRAPH_COMPLETE
→ TOPIC_INTERACTIVE
→ PAUSED
→ LESSON_COMPLETE

PAUSED
→ previous saved state
→ LESSON_COMPLETE

LESSON_COMPLETE
→ no active runtime continuation

--------------------------------------------------
SECTION 4 — FORBIDDEN TRANSITIONS
--------------------------------------------------

Forbidden:

LESSON_READY → EXERCISE_ACTIVE
LESSON_READY → AI_TURN
LESSON_READY → STT_ACTIVE

INTRO → RANDOM_CHAT
EXERCISE_ACTIVE → unrelated exercise
READING_ACTIVE → unrelated exercise
SIDE_QUESTION → new topic
SIDE_QUESTION → no return
PAUSED → background AI activity
LESSON_COMPLETE → same runtime continuation

Any forbidden transition is a runtime bug.

--------------------------------------------------
SECTION 5 — EVENT OWNERSHIP
--------------------------------------------------

# Begin Lesson

Event:
begin_lesson / focus_lesson_start

Allowed only from:
LESSON_READY

Creates:
- lesson started timestamp
- runtime container
- initial lesson state

--------------------------------------------------

# Student Turn Finalized

Event:
student_message / transcript_finalized

Allowed from:
- TOPIC_INTERACTIVE
- EXERCISE_ACTIVE
- READING_ACTIVE
- SIDE_QUESTION

Must:
- appear in chat
- be persisted if needed
- trigger one AI response max

--------------------------------------------------

# Teacher Turn Started

Event:
teacher_turn_start / ai_text / tts_start

Must:
- disable student STT unless interruption mode is explicitly allowed
- lock teacher speaking state
- prevent duplicate AI turns

--------------------------------------------------

# Teacher Turn Ended

Event:
teacher_turn_end

Must:
- occur after actual audio playback ends
- unlock student input
- persist state snapshot if needed

--------------------------------------------------

# Interrupt

Event:
student_interrupt

Allowed from:
- INTRO
- TOPIC_INTERACTIVE
- EXERCISE_INTRO
- EXERCISE_ACTIVE
- READING_ACTIVE
- REFLECTION

Must:
- stop teacher TTS
- preserve interrupted state
- enter SIDE_QUESTION if semantic question
- return to previous agenda after response

--------------------------------------------------

# Timeout

Event:
lesson_timeout

Allowed from:
any active runtime state

Must:
- stop STT
- stop TTS
- stop AI generation if possible
- save snapshot
- finalize usage
- move to LESSON_COMPLETE

--------------------------------------------------

# Pause / Save Exit

Event:
save_and_leave

Allowed from:
any active runtime state

Must:
- stop runtime activity
- persist exact snapshot
- move to PAUSED

--------------------------------------------------
SECTION 6 — PERSISTENCE SNAPSHOT CONTRACT
--------------------------------------------------

Every snapshot should include:

- lessonId
- sessionId
- userId
- teacherId
- voiceId
- unit
- section
- paragraph
- lessonState
- previousState if SIDE_QUESTION
- currentExerciseId
- currentExerciseNumber
- currentExerciseType
- currentItemIndex
- currentSentenceIndex
- currentReadingParagraphIndex
- wordBoxState
- completedItems
- failedItems
- retryCounts
- savedTips
- pronunciationIssues
- grammarIssues
- vocabIssues
- lessonStartedAt
- elapsedSeconds
- remainingSeconds
- lastTeacherSummary
- lastStudentSummary
- pendingReturnInstruction

--------------------------------------------------
SECTION 7 — FRONTEND RENDERING CONTRACT
--------------------------------------------------

Frontend must render:

LESSON_READY:
- Begin Lesson panel

INTRO:
- teacher speaking state

TOPIC_INTERACTIVE:
- warmup card

EXERCISE_INTRO:
- exercise instruction card

EXERCISE_ACTIVE:
- current item card
- word box if present
- progress indicator

READING_ACTIVE:
- current reading chunk
- pronunciation help if any

SIDE_QUESTION:
- current exercise remains visible
- side answer appears in chat
- no exercise disappearance

REFLECTION:
- micro-review card

PARAGRAPH_COMPLETE:
- next paragraph / save exit choices

PAUSED:
- resume panel

LESSON_COMPLETE:
- summary panel

Frontend must not infer state from local UI assumptions.

Frontend must render backend state.

--------------------------------------------------
SECTION 8 — AI PROMPT CONTEXT CONTRACT
--------------------------------------------------

Every teacher AI call must include:

- current lesson state
- current objective
- current exercise
- current item
- current expected action
- remaining lesson time
- student latest input
- recent mistake context
- saved tips relevant to current task
- return-to-agenda instruction if interrupted
- teacher persona
- response length constraints

AI must not decide curriculum state alone.

AI can suggest:
- explanation
- correction
- next action

Backend decides:
- actual progression
- cursor update
- state transition

--------------------------------------------------
SECTION 9 — FAILURE HANDLING
--------------------------------------------------

If AI response fails:
- keep state unchanged
- show recoverable error
- allow retry

If STT fails:
- allow typed input
- keep lesson state

If TTS fails:
- show text response
- allow continue

If websocket disconnects:
- move runtime to reconnecting/paused behavior
- persist snapshot

If Redis unavailable:
- degrade safely
- do not lose permanent DB state

If billing finalization fails:
- log clearly
- retry safely
- do not allow unlimited free runtime

--------------------------------------------------
FINAL RULE

The lesson state machine is the backbone of the paid classroom.

Any future feature must fit into this state map.

Do NOT bypass it.
Do NOT create parallel state systems.
Do NOT let AI become the state owner.