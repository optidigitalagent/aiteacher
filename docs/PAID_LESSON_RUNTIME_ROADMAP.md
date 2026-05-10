Current State
Project Overview

AI Teacher is no longer a demo-only conversational prototype.
The platform already contains:

authentication,
Google login,
PostgreSQL persistence,
Redis lesson state,
paid subscription gating,
LiqPay billing,
lesson websocket runtime,
streaming STT/TTS,
Focus 2 textbook integration,
paid lesson access control,
partial lesson resume support.

The system is already deployed on Railway:

Frontend:
fortunate-miracle-production-0854.up.railway.app

Backend:
aiteacher-production-bda7.up.railway.app

The current task is NOT to rebuild the project from scratch.

The current task is:

transform the paid classroom runtime into a stable,
structured AI-teacher lesson engine

while preserving all already working infrastructure.

Existing Infrastructure (Already Working)
Authentication

Already implemented and working:

- Google OAuth
- JWT auth
- Protected paid routes
- /api/me billing state
- user session persistence

Must NOT be rewritten.

Billing System

Already implemented and working:

- LiqPay checkout
- sandbox payment flow
- backend callback verification
- subscription activation
- 500-minute allocation
- 50-minute paid lesson runtime limit
- lesson access gating
- 402 payment errors

Already deployed and functional.

Must NOT be redesigned.

Only runtime integration improvements are allowed.

Paid Access Rules

Already working:

- user cannot enter paid lesson without subscription
- subscription minutes tracked
- paid lessons gated by backend
- lesson usage persisted

Must remain backend-authoritative.

Frontend must NEVER decide lesson access.

Existing Classroom Runtime
WebSocket Runtime

Already exists:

- websocket classroom connection
- lesson session IDs
- reconnect logic
- partial resume logic
- STT streaming
- TTS streaming
- Claude orchestration

However runtime behavior is unstable.

Current problems:

- echo loops
- duplicated AI turns
- mic lifecycle instability
- interruption instability
- broken conversation flow
- teacher losing exercise context
- AI drifting off-topic
- inconsistent student message rendering
- weak exercise progression control

The goal is to STABILIZE and RESTRUCTURE the runtime.

NOT replace the entire architecture.

Existing AI Runtime
Current AI Quality

Current Claude/OpenAI orchestration is partially good.

The system already can:

- explain
- ask questions
- continue conversations
- follow phases
- transition between lesson stages

The problem is NOT that the AI is "stupid".

The problem is:

runtime structure
conversation control
exercise control
lesson memory
voice lifecycle
state management

Therefore:

DO NOT rebuild the entire AI prompt system from zero.

Instead:

stabilize and constrain the runtime behavior
Existing Focus 2 Integration

The platform already contains Focus 2 textbook materials.

Current implementation partially supports:

- sections
- units
- paragraph selection
- lesson start configuration

But currently:

- exercise rendering is weak
- paragraph flow is weak
- textbook grounding is inconsistent
- AI sometimes invents exercises
- exercise cursor persistence is incomplete

The new runtime must become:

textbook-grounded
exercise-driven
state-persistent
Existing Resume System

Partial resume logic already exists.

Current implementation stores:

- sessionId
- lessonId
- voiceId
- teacherId
- some redis lesson state

But it is NOT yet production-grade.

Missing:

- exact exercise cursor
- item-level persistence
- reading paragraph persistence
- tips persistence
- lesson agenda persistence
- reflection state
- completed/failed exercise tracking

Resume currently restores only a rough lesson state.

Goal:

resume must restore the exact learning position
Existing Voice Runtime

Current system already includes:

- Deepgram STT
- OpenAI TTS
- optional ElevenLabs
- streaming audio
- teacher voices
- voice selection

However current runtime behavior is unstable.

Known issues:

- microphone remains active incorrectly
- teacher speech sometimes loops
- teacher interrupts itself
- STT captures teacher TTS
- speech lifecycle timing unstable
- fragmented voice playback
- duplicated teacher responses

The system needs:

professional conversational turn-taking

NOT a full replacement of providers.

Existing Frontend UX

The platform already contains:

- Learning page
- Pricing page
- Classroom page
- paid lesson flow
- Begin Lesson flow
- teacher selection
- voice selection
- websocket classroom runtime

Current UX problems:

- classroom feels chaotic
- exercise flow unclear
- AI responses feel uncontrolled
- lesson structure invisible
- weak task guidance
- unstable speaking interaction

The goal is:

make the classroom feel like a real AI teacher

NOT like a GPT chat window.

Existing Backend Constraints

The backend is authoritative.

Current architecture already assumes:

- backend controls lesson runtime
- backend controls billing
- backend controls subscriptions
- backend controls websocket lesson lifecycle
- frontend is only a client

This MUST remain true.

Frontend must NEVER:

control billing,
fake lesson state,
fake progress,
fake runtime,
fake remaining time.
Existing Cost Constraints

The current pricing target is:

$20/month
10 lessons
50 minutes each
500 total minutes

The runtime MUST remain financially sustainable.

Current estimate:

~$0.60 per lesson using:
- Claude
- Deepgram
- OpenAI TTS

Current architecture MUST continue prioritizing:

cost control
anti-abuse
runtime limits
backend authority
Existing Development Workflow

The project is already using:

- Railway deployment
- GitHub production remote
- phased commits
- incremental fixes
- Claude Code implementation workflow

The project MUST continue using:

small focused phases
isolated commits
explicit handoffs
separate Claude sessions

NOT giant uncontrolled rewrites.

Current Objective

The current objective is NOT:

"make AI smarter"

The real objective is:

build a stable,
structured,
professional,
persistent,
textbook-driven
AI classroom runtime

The final classroom should feel like:

a real AI English teacher
guiding the student through a structured lesson

NOT:

a random GPT conversation with voice
Non-Negotiable Rules
These rules are mandatory architectural constraints.
Claude MUST follow them during every phase.
These are NOT suggestions.
Breaking any of these rules is considered a failed implementation.

1. Backend Is Authoritative
The backend is the source of truth for:
- lesson runtime- lesson progression- billing- subscription state- remaining minutes- exercise cursor- lesson completion- resume state- teacher state- tips memory- reflection state
Frontend must NEVER invent or simulate lesson state.
Frontend is only:
presentation layeraudio clientinteraction clientrendering layer

2. No Frontend Billing Logic
Frontend must NEVER:
- decide subscription access- decide remaining minutes- unlock lessons- extend runtime- fake paid state
All paid access decisions MUST come from backend.
All lesson gates MUST be server-side enforced.

3. No Fake Textbook Generation
The AI must NEVER invent random exercises pretending to be from Focus 2.
The runtime must stay grounded in:
- selected unit- selected section- selected exercise- exact textbook context
AI may:


explain,


simplify,


give examples,


clarify,


scaffold learning,


BUT:
the core exercise flow must come from the textbook

4. No Infinite Free Conversation
This is NOT a general-purpose GPT tutor.
The lesson runtime is:
exercise-drivengoal-drivenparagraph-driven
The teacher may briefly answer side questions, but MUST always:
return to the current exercise
The runtime must never drift into:


random chatting,


motivational monologues,


unrelated discussions,


endless conversation loops.



5. Lesson Runtime Must Be Structured
Every lesson MUST have:
- greeting- lesson goal- exercise progression- corrections- guided practice- recap- reflection
The classroom must feel like:
a real guided lesson
NOT:


a voice chatbot,


a random AI conversation,


a Discord call with GPT.



6. 50-Minute Runtime Is Hard-Limited
Paid lessons are strictly:
50 minutes maximum
The backend timer is authoritative.
Frontend timers are visual only.
At 50 minutes:


lesson must stop,


STT must stop,


TTS must stop,


websocket lesson runtime must finalize,


usage must persist.


No frontend bypasses allowed.

7. Runtime State Must Persist
The system must persist:
- exact exercise cursor- current section- current exercise- current paragraph- reading position- completed items- correction history- vocabulary tips- grammar tips- pronunciation tips- reflection state
Resume must restore:
the exact learning position
NOT:


approximate state,


generic restart,


partial lesson recreation.



8. Mic Lifecycle Must Be Deterministic
The microphone lifecycle must be fully controlled.
The runtime MUST prevent:


echo loops,


self-transcription,


overlapping speech,


endless STT streaming,


accidental auto-submission.


Rules:
- teacher speaking disables student STT- student interrupt pauses teacher playback- STT only active during student turns- mic state must be explicit and visible
No uncontrolled always-on microphone behavior.

9. Student Messages Must Always Exist In Chat
Every finalized student utterance MUST appear in chat history.
This includes:


voice transcripts,


typed messages,


realtime reading utterances.


The student must always see:


what they said,


what the teacher answered,


where they are in the lesson.


No invisible STT-only communication.

10. Teacher Must Maintain Agenda Awareness
The teacher must ALWAYS know:
- what exercise is active- what sentence is active- what objective is active- what the student already completed- what mistakes already happened
The teacher must never:


forget the current task,


restart exercises randomly,


lose paragraph context,


ask disconnected questions.



11. Interruptions Must Feel Natural
The runtime must support:
natural conversational interruption
Examples:


student asks during explanation,


student cannot pronounce a word,


student asks for translation,


student asks for repetition.


The teacher should:


briefly respond,


help,


return to the exercise.


Interruptions must NOT:


destroy exercise state,


restart the lesson,


duplicate messages,


create parallel AI turns.



12. Reading Exercises Must Be Realtime
Reading exercises are NOT send-and-wait interactions.
The teacher must hear the student in realtime.
During reading:


the teacher may interrupt immediately,


pronunciation help may happen live,


corrections may happen mid-sentence.


This must feel like:
a real English teacher listening live
NOT:


uploading a transcript after finishing.



13. Tips Must Be Persistent Learning Memory
Tips are NOT cosmetic UI.
Tips are:
long-term learning memory
The system must persist:


pronunciation mistakes,


repeated grammar issues,


vocabulary weaknesses,


difficult words.


Tips should influence:


future reminders,


future corrections,


future lesson guidance.



14. Reflection Must Be Based On Real Performance
Lesson reflections must come from:
actual runtime data
NOT fake AI summaries.
Reflection should analyze:


completed exercises,


pronunciation issues,


grammar weaknesses,


vocabulary retention,


reading fluency,


participation.



15. No Automatic AI Spam
The teacher must NEVER:


flood the chat,


send duplicate turns,


continue monologues endlessly,


auto-trigger recursive replies.


Every AI turn must be intentional.

16. No Silent Background Runtime
The lesson must NEVER continue invisibly.
If:


websocket disconnects,


tab closes,


lesson pauses,


reconnect happens,


the runtime state must remain explicit.
The user must always understand:


whether lesson is active,


paused,


reconnecting,


resumed,


finished.



17. Voice Playback Must Feel Human
TTS playback must:


stream smoothly,


avoid fragmentation,


avoid robotic cutoff,


avoid repeated chunks,


avoid overlapping playback.


Voice interaction quality is core product UX.

18. Teacher Personas Must Stay Consistent
Emma and Alex are not just voice skins.
Each teacher must maintain:


personality,


speaking style,


pacing,


correction style,


encouragement style.


But both must still:


follow the textbook,


follow lesson agenda,


follow exercise progression.



19. No Hidden Exercise Progression
The student must always understand:


what they are doing,


why they are doing it,


where they are in the lesson.


The classroom must expose:


current exercise,


current task,


current goal.



20. Lesson Completion Must Feel Real
When:


paragraph finishes,


section finishes,


lesson finishes,


the system must:


acknowledge progress,


summarize work,


transition naturally.


No abrupt cutoff.
No generic “lesson completed”.

21. Cost Safety Is Mandatory
The runtime must remain economically sustainable.
The system must minimize:


unnecessary AI calls,


duplicate TTS generation,


idle STT streaming,


recursive loops,


uncontrolled token growth.


The architecture must prioritize:


bounded runtime,


bounded token usage,


bounded audio streaming.



22. Runtime Must Be Observable
Critical runtime events must be logged.
Including:


lesson start,


lesson end,


AI turns,


STT events,


interruptions,


exercise transitions,


billing usage,


reconnects,


resume events,


teacher turn completion.


Logs must make debugging possible.

23. No Massive Rewrites During Phases
Each phase must:


modify only necessary systems,


preserve existing working infrastructure,


avoid architectural rewrites.


Claude must NOT:


rebuild the entire project,


replace working systems unnecessarily,


redesign unrelated components.



24. Every Phase Must Be Isolated
Each implementation phase must:


have clear scope,


have clear acceptance criteria,


have explicit changed files,


have isolated commits.


No giant multi-system commits.

25. Existing Demo Flow Must Remain Stable
The demo lesson runtime is already functioning better than the paid runtime in several UX areas.
Paid runtime should inherit:


Begin Lesson flow,


stable interaction model,


controlled conversation pacing,


visible student messages,


cleaner UX behavior.


Do NOT regress demo behavior.

26. The Goal Is A Real AI Teacher
The product goal is:
structured AI-guided English learning
NOT:


a GPT wrapper,


a generic chatbot,


an entertainment voice assistant.


Every architectural decision must support:


learning structure,


exercise progression,


educational continuity.



27. Claude Must Respect Existing Product Vision
Claude may improve:


implementation,


architecture,


UX details,


runtime stability,


interaction quality.


BUT Claude must NOT override:


the lesson philosophy,


the textbook-driven model,


the AI teacher vision,


the product direction defined in this roadmap.


The user's educational vision is authoritative.
27-System Checklist

This checklist defines what the paid lesson runtime must eventually support.

These are system requirements, not one-phase tasks.

Claude must use this checklist as the long-term target while implementing the roadmap phase by phase.

1. Lesson Runtime State Machine

The paid classroom must have a clear lesson state machine.

Required states:

LESSON_READY
INTRO
TOPIC_INTERACTIVE
EXERCISE_INTRO
EXERCISE_ACTIVE
READING_ACTIVE
SIDE_QUESTION
REFLECTION
PARAGRAPH_COMPLETE
LESSON_COMPLETE
PAUSED

Purpose:

The system must always know what is happening now and what should happen next.

Without this, the teacher will drift, repeat, or lose the exercise.

2. Agenda Recovery System

The teacher must always return to the active lesson agenda after interruption.

Required tracking:

current_activity
current_exercise
current_sentence
interrupted_context
return_instruction

Example:

Student asks: “What does impossible mean?”

Teacher:
“Impossible means something cannot happen.
Now let’s continue Exercise 2, sentence 3.”

Side questions must never kill the lesson flow.

3. Realtime Teacher Listening Mode

Reading exercises require realtime teacher listening.

During reading, the system must:

listen while the student reads
compare speech against reference text
detect blocked words or serious pronunciation issues
interrupt briefly when needed
model the correct pronunciation
continue reading flow

Important:

The teacher should not stop for every small accent difference.

Interrupt only when:

the student is stuck,
the word is clearly wrong,
the same pronunciation issue repeats,
the mistake blocks comprehension.
4. Reading Chunk System

Reading content must be split into manageable chunks.

Required chunk types:

paragraph_chunk
sentence_chunk

Default behavior:

show one paragraph at a time
student reads it
teacher checks it
teacher gives brief feedback
then next paragraph appears

This prevents overwhelming the student and gives the teacher precise control.

5. Exercise Cursor

The system must track the exact micro-position in the textbook.

Required cursor fields:

unit
section
exercise_id
exercise_number
exercise_type
item_index
sub_item_index
reading_paragraph_index
word_box_state
completed_items
failed_items

Example:

Focus 2
Unit 1
Section 1.3
Exercise 4
Sentence 3/5

Resume must restore this exact point.

6. Word Box State

For exercises with word boxes, the system must track available and used words.

Required state:

available_words
used_words
remaining_words

When a student uses a correct word:

the word should be marked as used
or visually crossed out

The word box must stay visible while the exercise needs it.

7. Interactive Intro Generator

Every paragraph should begin with a short topic-based interactive warmup.

This is not random small talk.

It must be connected to:

section topic
grammar focus
vocabulary focus
student engagement

Example:

If section topic is animals + Past Simple:

“When did you last see an animal? Tell me one short sentence.”

Purpose:

activate the topic
get the student speaking
make the lesson feel personal
transition into textbook work

Time limit:

2–4 minutes maximum
8. Teacher Response Rules

Teacher responses must be concise and useful.

During exercises:

1–3 short sentences max

During corrections:

1 correction
1 explanation
1 retry request

During vocabulary help:

meaning
short example
return to current task

The teacher must avoid long GPT-style monologues.

9. Mandatory Return-To-Lesson Rule

After any side question, the teacher must return to the current lesson task.

Required response pattern:

answer the question
optionally add a short example
return to current exercise

Example:

“‘Break it down’ means explain it in smaller parts.
Now back to Exercise 3, sentence 2.”

The final sentence should usually re-anchor the student to the lesson.

10. Persistent Tips System

Tips are a real learning-memory feature.

The system must save:

word
phrase
pronunciation issue
grammar issue
mistake correction
short explanation
example
lesson reference
exercise reference
timestamp

Tip types:

VOCAB
PHRASE
GRAMMAR
PRONUNCIATION
COMMON_MISTAKE

Tips must be visible in a Tips panel/drawer.

11. Smart Reflection Engine

Reflection must be based on real performance, not generic AI summaries.

Reflection should use:

saved tips
student mistakes
failed exercise attempts
pronunciation issues
grammar weaknesses
vocabulary questions
completed exercises

Reflection format:

short
adaptive
2–4 minutes
micro-quiz style

Reflection happens:

after each paragraph,
at the end of each 50-minute lesson.

It must stay inside the 50-minute limit.

12. Hard 50-Minute Runtime Container

One paid lesson is a strict 50-minute runtime container.

Backend must track:

lesson_started_at
elapsed_seconds
remaining_seconds
hard_cutoff_at

Required behavior:

warn near the end
stop at 50 minutes
save progress
finalize usage
prevent continued AI/STT/TTS after cutoff

No prompt or frontend state can extend the lesson.

13. Lesson Continuation Logic

The system must distinguish between:

Continue current lesson
Start new lesson
Continue course progress

Rules:

If the current 50-minute lesson still has time:

Continue current lesson

If the previous 50-minute lesson is finished but subscription minutes remain:

Start new lesson from last saved course position

If the paragraph finished early:

Continue next paragraph inside the same 50-minute lesson
14. Paragraph Completion Flow

When a paragraph is completed:

teacher summarizes progress
reflection starts
system offers next paragraph
system offers save and exit

If enough time remains:

Next Paragraph

If little time remains:

Save and continue next lesson

The next paragraph should not restart with a full greeting.
It should begin with a new topic bridge + short interactive intro.

15. Remaining Time Awareness

The teacher must be aware of remaining lesson time.

Teacher should not start a long task with almost no time left.

Rules:

if remaining time is low:
choose short reflection
save progress
do not start long reading task

Frontend does not need to show stressful countdown all the time.

Backend and teacher runtime must still know the time.

16. Exercise-Type Behaviors

Different exercise types need different logic.

Required exercise modes:

grammar_transform
fill_gap
word_box
reading
speaking_prompt
vocabulary_matching
listening_future
reflection_quiz

Each type must define:

how it is displayed,
what student response is expected,
how teacher evaluates it,
when to advance,
when to retry.
17. Teacher Personality Layer

Teacher identity must affect tone, not lesson structure.

Emma and Alex may differ in:

warmth
strictness
encouragement style
pacing
voice

But both must follow the same:

textbook rules,
exercise cursor,
lesson state machine,
billing limits,
return-to-lesson behavior.
18. AI Anti-Rambling Rules

The AI must avoid:

long monologues
creative tangents
unrelated stories
repeated encouragement
over-explaining easy points
inventing tasks

The teacher should be:

focused
professional
concise
pedagogical
19. Deterministic Exercise Rendering

AI must not be responsible for inventing what appears on the exercise card.

The exercise renderer must use structured textbook data.

Required behavior:

render exact exercise instruction
render current item
render word box if needed
render reading paragraph if needed
render progress indicator

AI explains and guides.

The renderer displays the material.

20. Structured Lesson Memory

The system must store structured learning memory.

Required memory:

lesson_summary
completed_exercises
failed_patterns
saved_tips
pronunciation_issues
grammar_issues
student_preferences
last_position

This memory must influence:

resume,
future corrections,
reflections,
teacher explanations.
21. Voice Conversation Rules

Voice interaction must be deterministic.

Required lifecycle:

teacher speaks
student interrupts or waits
if student interrupts: stop TTS immediately
mic opens
student speaks
student finalizes response
student message appears in chat
teacher answers
teacher returns to agenda

Forbidden:

overlapping TTS
open mic during teacher playback
auto-STT loops
invisible transcripts
duplicate teacher turns
22. Cost-Control Rules

The system must avoid waste.

Control:

AI call frequency
TTS duplication
idle STT streaming
long responses
reflection length
side-question length
token growth

Cost safety is product safety.

The product must remain viable at:

$20/month
500 minutes/month
23. Lesson Resume Snapshot

After every meaningful step, save a snapshot.

Snapshot triggers:

lesson start
exercise intro
completed item
failed item
tip added
paragraph completed
reflection completed
lesson paused
lesson ended

Resume must not depend only on chat history.

It must restore structured state.

24. Explicit Lesson Goals

At the start of every paragraph, the teacher must state:

topic
goal
grammar/vocabulary focus
what exercises will be practiced

Example:

“Today we’ll work on travel vocabulary and Past Simple.
We’ll start with a short question, then complete Exercise 1.”
25. Controlled Flexibility

AI can be human and engaging.

Allowed:

small examples
brief discussion
short personalization
teacher-like encouragement
simple jokes if appropriate

Not allowed:

breaking textbook flow
inventing unrelated lessons
ignoring current exercise
turning into free conversation
26. Four-Layer Architecture

The system should be understood as four cooperating layers:

1. Lesson Engine
2. Textbook Engine
3. Teacher AI
4. Runtime/Billing Engine

Responsibilities:

Lesson Engine:
controls phases, cursor, progression

Textbook Engine:
provides exact exercises and content

Teacher AI:
explains, corrects, motivates, returns to agenda

Runtime/Billing Engine:
controls minutes, access, websocket lifecycle, cost

These layers must not be mixed randomly.

27. Final Product Standard

The final classroom must feel like:

a real AI English teacher guiding the student through Focus 2

The student should always know:

what we are doing
why we are doing it
what to answer now
what has been completed
what happens next

The lesson must never feel like:

a chaotic voice chat
a random GPT conversation
an uncontrolled websocket experiment
Phase Roadmap
This roadmap defines the implementation order for rebuilding the paid classroom runtime into a stable AI-teacher lesson system.
The order is intentional.
Each phase depends on previous phases.
Claude MUST NOT skip phases or merge unrelated phases together.
Every phase must:


preserve existing working infrastructure,


avoid unnecessary rewrites,


finish with explicit handoff documentation,


end with a clean isolated commit.



Phase 0 — Runtime Audit & System Foundation
Goal
Establish a stable foundation before modifying lesson behavior.
This phase is NOT about features.
This phase is about:


understanding current architecture,


documenting existing runtime,


identifying unstable systems,


creating implementation safety.



Required Work
1. Create roadmap documentation
Create:
docs/PAID_LESSON_RUNTIME_ROADMAP.md
Must contain:


current state,


non-negotiable rules,


27-system checklist,


roadmap,


definition of done,


handoff format.



2. Audit current runtime architecture
Inspect:


websocket lifecycle,


STT lifecycle,


TTS lifecycle,


lesson state storage,


exercise rendering,


reconnect flow,


lesson resume flow,


billing/runtime interaction.


Document:


current flow,


broken flow,


dangerous flow,


duplicated flow.



3. Identify runtime ownership boundaries
Clarify:


backend responsibilities,


frontend responsibilities,


runtime authority,


state authority,


persistence authority.



4. Add missing observability
Ensure runtime logs exist for:


lesson start,


teacher turn,


student turn,


STT finalization,


TTS playback,


interrupts,


reconnects,


lesson end,


exercise transition.



Deliverables
By the end of Phase 0:
- runtime architecture documented- roadmap file exists- debugging visibility improved- unsafe runtime zones identified- no major runtime rewrites yet

Phase 1 — Voice Runtime & Conversational Stability
Goal
Make the classroom feel stable and human during conversation.
This phase fixes:


chaos,


overlapping speech,


broken interrupts,


mic instability,


duplicated turns,


fragmented voice UX.


This is the MOST critical runtime stabilization phase.
Without this phase, all future lesson systems will feel broken.

Required Work
1. Deterministic mic lifecycle
Implement strict conversational ownership:
teacher speaking → student mic disabledstudent interrupt → teacher playback stopsstudent speaking → STT activeteacher responding → STT disabled
No always-on mic behavior.

2. Stable interruption model
Student must be able to:


interrupt naturally,


ask short questions,


stop teacher speech.


Teacher must:


stop immediately,


answer interruption,


return to lesson context.



3. Fix teacher audio playback
Fix:


fragmented speech,


duplicate playback,


cut-off chunks,


repeated phrases,


overlapping streams.


Teacher audio must feel smooth.

4. Fix student message rendering
Every finalized student utterance must:


appear in chat,


appear in correct order,


align with teacher responses.


No invisible STT communication.

5. Rebuild Begin Lesson flow
Paid runtime must behave like demo runtime:
enter classroomlesson preparedstudent presses Begin Lessonlesson starts
No automatic AI speaking before Begin Lesson.

6. Prevent echo loops
Teacher TTS must never re-enter STT.
Required:


playback-aware STT suppression,


deterministic mic disable,


safe interrupt ownership.



Deliverables
By the end of Phase 1:
- conversation feels stable- no overlapping speech- no echo loops- student messages visible- interrupts work naturally- Begin Lesson stable- classroom no longer chaotic

Phase 2 — Lesson State Machine & Runtime Container
Goal
Transform the lesson into a structured runtime instead of free conversation.
This phase introduces:


lesson states,


runtime progression,


exercise flow control,


time awareness.



Required Work
1. Implement lesson state machine
Required states:
LESSON_READYINTROTOPIC_INTERACTIVEEXERCISE_INTROEXERCISE_ACTIVEREADING_ACTIVESIDE_QUESTIONREFLECTIONPARAGRAPH_COMPLETELESSON_COMPLETEPAUSED

2. Build lesson agenda tracking
Track:


current objective,


current activity,


current exercise,


active paragraph,


interruption return target.



3. Implement runtime progression logic
Teacher must always know:


where the student is,


what comes next,


what is completed,


what remains.



4. Build hard 50-minute runtime container
Backend authoritative:


lesson timer,


cutoff,


persistence,


runtime finalization.



5. Add time-aware teacher behavior
Teacher should:


avoid starting long tasks near lesson end,


transition into reflection naturally,


suggest continuation when appropriate.



Deliverables
By the end of Phase 2:
- lessons feel structured- teacher maintains agenda- lesson phases exist- runtime progression deterministic- 50-minute container stable

Phase 3 — Textbook Engine & Exercise Renderer
Goal
Make the classroom truly textbook-driven.
The AI should guide exercises.
The system should render exercises.

Required Work
1. Build deterministic exercise renderer
Render:


instructions,


current item,


reading content,


word boxes,


progress.


AI must NOT invent exercise cards.

2. Implement exercise cursor
Track exact micro-position:
unitsectionexerciseitemsentenceparagraphword-box state

3. Add exercise-type behaviors
Support:


fill gaps,


grammar transform,


reading,


vocabulary,


speaking,


matching,


future listening.


Each type must define:


expected answer,


progression rules,


retry rules.



4. Build paragraph progression
Support:


finish paragraph,


transition to next paragraph,


continue inside same lesson if time remains.



5. Implement realtime reading mode
Teacher listens in realtime during reading.
Teacher may:


correct blocked pronunciation,


help with difficult words,


continue reading flow naturally.



Deliverables
By the end of Phase 3:
- exercises are deterministic- textbook grounding stable- reading mode functional- cursor persistence exists- AI no longer invents exercises

Phase 4 — Teacher Intelligence & Agenda Recovery
Goal
Make the teacher feel professional instead of chaotic.
The teacher must:


explain well,


stay concise,


recover context,


maintain lesson flow.



Required Work
1. Implement side-question recovery
Teacher answers briefly, then returns to lesson.

2. Add anti-rambling rules
Limit:


monologues,


tangents,


repeated encouragement,


GPT-style over-explanations.



3. Add teacher pacing logic
Teacher should:


adapt explanation length,


slow down when needed,


move faster when student succeeds.



4. Improve teacher personas
Emma and Alex should differ in:


warmth,


pacing,


strictness,


correction style.


But both remain textbook-grounded.

5. Add explicit lesson goals
Teacher should explain:


what we are doing,


why we are doing it,


what comes next.



Deliverables
By the end of Phase 4:
- teacher feels professional- side questions no longer break lessons- AI responses concise- lesson guidance clear- personas consistent

Phase 5 — Persistent Tips & Learning Memory
Goal
Transform the system from session-based tutoring into persistent learning.

Required Work
1. Implement persistent tips memory
Save:


vocab issues,


grammar issues,


pronunciation issues,


repeated mistakes.



2. Build tip categorization
Support:


VOCAB,


GRAMMAR,


PRONUNCIATION,


COMMON_MISTAKE,


PHRASE.



3. Add tip surfacing
The teacher should occasionally:


remind,


reinforce,


revisit repeated mistakes.



4. Build lesson memory snapshots
Persist:


completed exercises,


failed patterns,


active paragraph,


correction history,


reading state.



Deliverables
By the end of Phase 5:
- learning memory exists- tips persist between lessons- teacher remembers weaknesses- progress continuity improves

Phase 6 — Resume, Continuation & Reflection
Goal
Make lessons persistent across sessions and feel educationally complete.

Required Work
1. Build exact lesson resume
Resume must restore:


exact cursor,


exact paragraph,


exact exercise,


reflection state,


remaining runtime.



2. Build lesson continuation logic
Support:


continue current lesson,


continue next paragraph,


continue next lesson after runtime end.



3. Build paragraph reflection system
Generate:


pronunciation observations,


grammar observations,


vocab observations,


micro review.


Based on REAL lesson data.

4. Build lesson completion flow
Lesson endings should:


summarize progress,


save state,


explain next continuation.



Deliverables
By the end of Phase 6:
- resume works reliably- continuation feels natural- lessons feel persistent- reflections meaningful

Phase 7 — Curriculum Completion & Focus 2 Scaling
Goal
Expand the system from partial prototype coverage into full curriculum support.

Required Work
1. Complete Focus 2 section mapping
Support:


all units,


all sections,


all exercise structures.



2. Validate all exercise types
Ensure:


renderer stability,


runtime stability,


cursor stability,


reading stability.



3. Build curriculum QA tools
Verify:


missing exercises,


broken mappings,


incorrect section references.



4. Validate progression quality
Ensure:


realistic pacing,


no repetitive AI loops,


educational consistency.



Deliverables
By the end of Phase 7:
- full Focus 2 support- stable curriculum coverage- scalable runtime architecture

Phase 8 — Production Stabilization & Final QA
Goal
Prepare the system for real production usage.

Required Work
1. Stress-test runtime
Test:


reconnects,


interrupts,


long lessons,


reading mode,


reflection,


resume.



2. Validate cost safety
Measure:


AI calls,


TTS usage,


STT usage,


runtime cost.


Optimize:


idle STT,


duplicate TTS,


token growth.



3. Remove unstable legacy behavior
Remove:


dead runtime logic,


duplicated handlers,


unstable fallback systems.



4. Final UX stabilization
Ensure:


lesson clarity,


smooth pacing,


stable transitions,


professional teacher feel.



Deliverables
By the end of Phase 8:
- runtime production-stable- economically sustainable- scalable- educationally coherent- no chaotic classroom behavior
Definition Of Done For Each Phase

This section defines the exact completion criteria for every implementation phase.

A phase is considered COMPLETE only if ALL criteria are satisfied.

Partial completion is NOT considered done.

Claude must validate all requirements before declaring a phase complete.

Phase 0 — Runtime Audit & System Foundation
Definition Of Done

Phase 0 is complete ONLY if:

- docs/PAID_LESSON_RUNTIME_ROADMAP.md exists
- roadmap contains all mandatory sections
- websocket runtime flow documented
- STT/TTS lifecycle documented
- billing/runtime relationship documented
- reconnect/resume flow documented
- backend/frontend ownership clarified
- dangerous runtime zones identified
- critical logs added
- no major runtime rewrites performed
Required Outputs

Claude must provide:

- architecture findings
- unstable runtime findings
- identified duplication points
- identified ownership problems
- changed files list
Forbidden During Phase 0
- no major websocket rewrites
- no AI prompt rewrites
- no frontend redesign
- no runtime architecture replacement
Phase 1 — Voice Runtime & Conversational Stability
Definition Of Done

Phase 1 is complete ONLY if:

- teacher speech never overlaps itself
- student interrupt reliably stops teacher TTS
- STT never transcribes teacher playback
- no echo loops occur
- no duplicated teacher turns occur
- no duplicated AI messages occur
- student voice messages always appear in chat
- Begin Lesson gate works deterministically
- no AI speech before Begin Lesson
- mic lifecycle deterministic
- teacher speaking disables STT
- student speaking disables teacher playback
- websocket reconnect does not duplicate active audio
- teacher audio playback sounds smooth
- no fragmented playback chunks
- classroom no longer feels chaotic
Required Runtime Tests

Claude must manually validate:

- interrupt mid-sentence
- rapid interrupt spam
- reconnect during teacher speech
- reconnect during student speech
- mute/unmute cycles
- typing while teacher speaks
- multiple Begin Lesson clicks
Forbidden During Phase 1
- no textbook renderer rewrite
- no reflection system implementation
- no lesson memory implementation
- no curriculum expansion

Only conversational/runtime stability.

Phase 2 — Lesson State Machine & Runtime Container
Definition Of Done

Phase 2 is complete ONLY if:

- lesson states exist
- runtime transitions deterministic
- teacher always knows active objective
- lesson agenda persists
- side interruptions preserve lesson context
- current exercise tracked
- current paragraph tracked
- current activity tracked
- backend authoritative timer exists
- 50-minute hard cutoff enforced
- lesson finalizes cleanly at timeout
- runtime state saved at timeout
- teacher aware of remaining time
- no random AI drifting between exercises
- lesson progression structured
Required Runtime Tests

Claude must validate:

- lesson reaches timeout cleanly
- reconnect preserves lesson state
- side question returns to agenda
- lesson transitions correctly between states
- pause/resume preserves active objective
Forbidden During Phase 2
- no persistent tips system yet
- no reflection engine yet
- no curriculum-wide scaling yet
Phase 3 — Textbook Engine & Exercise Renderer
Definition Of Done

Phase 3 is complete ONLY if:

- exercise rendering deterministic
- exercises come from textbook data
- AI no longer invents exercise content
- exact exercise instructions visible
- word boxes render correctly
- used words tracked correctly
- reading paragraphs render correctly
- exercise progress visible
- exact cursor persisted
- cursor restored correctly
- reading chunk system works
- realtime reading mode works
- teacher can interrupt during reading
- teacher can correct blocked pronunciation
- paragraph progression stable
Required Runtime Tests

Claude must validate:

- fill-gap exercise flow
- word-box exercise flow
- reading exercise flow
- sentence progression
- paragraph progression
- reconnect during reading
- reconnect during exercise
Forbidden During Phase 3
- no large AI persona rewrites
- no curriculum scaling yet
- no final optimization work yet
Phase 4 — Teacher Intelligence & Agenda Recovery
Definition Of Done

Phase 4 is complete ONLY if:

- teacher always returns to lesson after side question
- AI responses concise
- no long GPT monologues
- no unrelated tangents
- lesson goals explained clearly
- teacher pacing adaptive
- Emma and Alex personalities consistent
- teacher explanations contextual
- teacher remembers current exercise
- teacher guidance feels professional
- classroom feels like guided learning
Required Runtime Tests

Claude must validate:

- repeated side questions
- repeated pronunciation help
- translation requests
- student confusion loops
- grammar clarification requests
- interruption during explanation
Forbidden During Phase 4
- no reflection engine yet
- no full curriculum scaling yet
- no backend billing rewrites
Phase 5 — Persistent Tips & Learning Memory
Definition Of Done

Phase 5 is complete ONLY if:

- tips persist across lessons
- grammar mistakes saved
- pronunciation mistakes saved
- vocabulary weaknesses saved
- repeated mistakes tracked
- lesson memory snapshots saved
- teacher can reference past weaknesses
- tips categorized correctly
- tips linked to exercises
- tips survive reconnects
- tips survive new lesson sessions
Required Runtime Tests

Claude must validate:

- repeated pronunciation mistake tracking
- repeated grammar mistake tracking
- reconnect after tip creation
- resume after lesson end
- multiple lessons preserving memory
Forbidden During Phase 5
- no final curriculum scaling yet
- no large UX redesign
Phase 6 — Resume, Continuation & Reflection
Definition Of Done

Phase 6 is complete ONLY if:

- resume restores exact exercise cursor
- resume restores paragraph state
- resume restores reading state
- resume restores reflection state
- resume restores remaining lesson time
- lesson continuation logic stable
- next-paragraph transitions natural
- reflection based on real lesson data
- reflection references real mistakes
- lesson completion summaries coherent
- lesson endings feel natural
- save-and-exit reliable
Required Runtime Tests

Claude must validate:

- reconnect after disconnect
- continue lesson after timeout
- continue after paragraph completion
- continue after browser refresh
- reflection after weak performance
- reflection after strong performance
Forbidden During Phase 6
- no final optimization yet
- no curriculum scaling rewrite
Phase 7 — Curriculum Completion & Focus 2 Scaling
Definition Of Done

Phase 7 is complete ONLY if:

- all Focus 2 units mapped
- all sections accessible
- all exercise types supported
- renderer stable across units
- no broken section references
- no missing exercise states
- curriculum progression coherent
- lesson quality consistent across units
Required Runtime Tests

Claude must validate:

- random unit switching
- section transitions
- all exercise categories
- reading-heavy sections
- grammar-heavy sections
- vocab-heavy sections
Forbidden During Phase 7
- no large runtime rewrites
- no billing redesign
- no websocket replacement
Phase 8 — Production Stabilization & Final QA
Definition Of Done

Phase 8 is complete ONLY if:

- runtime stable for long lessons
- reconnect reliability high
- no major websocket crashes
- no duplicated runtime events
- no runaway AI loops
- no uncontrolled token growth
- STT cost controlled
- TTS cost controlled
- lesson UX smooth
- classroom pacing stable
- production logs useful
- runtime economically sustainable
- lesson flow educationally coherent
Required Runtime Tests

Claude must validate:

- full 50-minute lesson
- reconnect spam
- rapid interrupts
- browser refreshes
- tab close/reopen
- weak network simulation
- long reading exercises
- repeated side-question interruptions
Final Production Standard

The system is considered production-ready ONLY if:

- the classroom feels stable
- the teacher feels professional
- the lesson feels structured
- textbook grounding is reliable
- lesson progression is coherent
- voice interaction feels natural
- persistence works reliably
- runtime costs remain sustainable

The final product must feel like:

a real AI English lesson

NOT:

a chaotic GPT voice experiment
Handoff Format After Each Phase

Every phase MUST end with a structured implementation handoff.

This handoff is mandatory.

The next Claude session depends on it.

Without a proper handoff:

context is lost,
duplicate fixes appear,
architecture drifts,
runtime regressions happen,
phases overlap incorrectly.

The handoff must explain:

what changed,
where it changed,
why it changed,
what remains unfinished,
what the next phase should continue from.
Mandatory Handoff Structure

Every completed phase MUST end with the following structure:

PHASE X COMPLETE

1. Summary
2. Goals Completed
3. Changed Files
4. Backend Changes
5. Frontend Changes
6. Database Changes
7. Runtime Behavior Changes
8. WebSocket/Event Changes
9. AI/Prompt Changes
10. Cost Impact
11. Tests Performed
12. Known Remaining Issues
13. What Was Intentionally NOT Changed
14. Risks Introduced
15. Deployment Notes
16. Recommended Next Phase
17. Next Claude Session Instructions

Claude MUST follow this exact structure.

1. Summary

Provide a short high-level summary.

Format:

Phase 3 completed.
The classroom is now textbook-grounded and deterministic.
Exercises render from structured textbook data instead of AI generation.
Realtime reading mode now supports live pronunciation correction.

Maximum:

5–10 lines.

Do NOT write huge essays.

2. Goals Completed

List ONLY the goals actually completed.

Format:

Completed:
- deterministic exercise renderer
- exercise cursor persistence
- word-box rendering
- realtime reading flow
- paragraph progression

Do NOT include unfinished work.

3. Changed Files

List every changed file.

Group by:

backend,
frontend,
database,
docs.

Format:

Backend:
- backend/src/ws/lesson-ws.ts
- backend/src/lesson/exercise-engine.ts

Frontend:
- frontend/src/features/classroom/ClassroomLayout.tsx
- frontend/src/features/classroom/ExerciseCard.tsx

Database:
- backend/migrations/012_exercise_cursor.sql

Docs:
- docs/PAID_LESSON_RUNTIME_ROADMAP.md

This is critical for future Claude sessions.

4. Backend Changes

Explain backend behavior changes.

Must include:

- new services
- modified flows
- runtime ownership changes
- state changes
- persistence changes
- websocket changes
- billing/runtime changes

Example:

Added ExerciseCursorService.
lesson-ws.ts now persists cursor snapshots after each completed exercise item.

Focus on:

architecture,
runtime behavior,
state changes.

NOT generic summaries.

5. Frontend Changes

Explain frontend behavior changes.

Must include:

- UI flow changes
- rendering changes
- interaction changes
- runtime interaction changes
- voice UX changes

Example:

ExerciseCard now renders textbook-controlled items instead of AI-generated text.
Mic button disables during teacher playback.
6. Database Changes

If migrations exist, explain:

- new tables
- new columns
- modified column types
- indexes
- persistence changes

Format:

Migration added:
012_exercise_cursor.sql

Added columns:
- current_exercise_id
- current_item_index
- reading_paragraph_index

If no DB changes:

No database changes.
7. Runtime Behavior Changes

Describe how the classroom behavior changed from the user's perspective.

This is one of the MOST important sections.

Example:

Before:
teacher often lost the active exercise after interruptions.

Now:
teacher answers the interruption briefly and reliably returns to the current sentence.

Must describe:

runtime feel,
interaction feel,
lesson flow feel,
voice flow feel.
8. WebSocket/Event Changes

Document:

new websocket events,
removed events,
changed payloads,
lifecycle changes.

Format:

Added:
- teacher_turn_end
- lesson_cursor_updated

Modified:
- student_message payload now includes exercise context

This prevents future frontend/backend mismatch.

9. AI/Prompt Changes

Describe:

prompt changes,
orchestration changes,
teacher behavior changes,
pacing changes,
anti-rambling changes.

Example:

Teacher prompts now include:
- current exercise
- current sentence
- return-to-agenda instruction
- remaining lesson time

Must explain:

how AI behavior changed,
not just “prompt updated”.
10. Cost Impact

Every phase must mention runtime cost implications.

Format:

Cost impact:
- STT usage reduced during teacher playback
- duplicate TTS generation removed
- AI call frequency unchanged

Or:

No meaningful cost impact.

This is mandatory.

11. Tests Performed

List REAL tests performed.

Format:

Tested:
- interrupt during teacher speech
- reconnect during reading
- reconnect after Begin Lesson
- rapid mic toggling
- lesson timeout handling

Do NOT claim tests that were not performed.

12. Known Remaining Issues

List remaining known problems honestly.

Format:

Remaining issues:
- reading interruptions still slightly delayed
- reflection pacing too long
- occasional duplicate reconnect log

This section is mandatory.

13. What Was Intentionally NOT Changed

This prevents future Claude confusion.

Example:

Intentionally NOT changed:
- billing architecture
- demo runtime
- textbook data structure
- subscription system

This is critical.

14. Risks Introduced

Every phase may introduce new risks.

Document them.

Example:

New risks:
- cursor persistence now depends on snapshot writes
- reconnect restoration complexity increased

This helps future debugging.

15. Deployment Notes

Explain deployment requirements.

Example:

Requires Railway redeploy.

New env variables:
- LESSON_CURSOR_SNAPSHOT_INTERVAL

Migration required:
- 012_exercise_cursor.sql

If no deployment changes:

No deployment changes required.
16. Recommended Next Phase

Claude must explicitly state:

Recommended next phase:
Phase 4 — Teacher Intelligence & Agenda Recovery

And briefly explain why.

17. Next Claude Session Instructions

This section is CRITICAL.

Claude must explain how the next session should continue.

Format:

Next Claude session should:
- read roadmap first
- inspect ExerciseCursorService
- preserve deterministic renderer
- avoid rewriting websocket lifecycle
- continue from Phase 4 only

Must include:

preservation warnings,
dangerous areas,
continuation points.

This is the continuity bridge between Claude sessions.

Final Rule

Claude MUST NOT end a phase with:

“done”

or:

“everything implemented”

A phase is complete ONLY when:

implementation exists,
tests performed,
handoff fully written,
risks documented,
next continuation clear.

The handoff is part of the implementation itself.
