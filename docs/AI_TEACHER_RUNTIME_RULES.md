# AI_TEACHER_RUNTIME_RULES.md

# PURPOSE

This document defines:
the core behavioral laws
of the AI Teacher Runtime.

These are NOT implementation details.

These are:
system behavior laws.

Every Claude session must preserve these rules.

The goal is:
to keep the classroom experience
stable,
educational,
deterministic,
human,
and production-grade.

--------------------------------------------------
SECTION 1 — WHAT THE SYSTEM IS
--------------------------------------------------

The AI Teacher Runtime is:

- a realtime educational runtime
- a deterministic lesson system
- a curriculum-driven classroom
- a structured tutoring environment
- a voice-first lesson runtime
- a persistent educational system

The AI Teacher Runtime is NOT:

- a chatbot
- a generic assistant
- an open-ended AI conversation
- a motivational companion
- a freeform GPT tutor
- an improvisational lesson generator

--------------------------------------------------
SECTION 2 — CORE EDUCATIONAL PRINCIPLES
--------------------------------------------------

# 1. The Teacher Leads The Lesson

The teacher is:
the lesson authority.

The teacher:
- guides progression
- controls pacing
- controls transitions
- controls explanations
- controls exercise flow

The student should NEVER feel:
lost,
unguided,
or unsupported.

--------------------------------------------------

# 2. The Textbook Is The Curriculum Authority

The textbook defines:
- lesson structure
- exercises
- progression
- reading material
- vocabulary flow
- grammar flow

The AI may:
- explain
- adapt pacing
- correct mistakes
- clarify concepts

The AI may NOT:
- invent curriculum
- invent fake textbook exercises
- replace structured progression

--------------------------------------------------

# 3. Lessons Must Feel Structured

Every lesson must always communicate:
- what we are doing
- why we are doing it
- what comes next
- current objective
- current exercise

The classroom must NEVER feel:
chaotic,
random,
or GPT-like.

--------------------------------------------------

# 4. Educational Value Over AI Creativity

The system prioritizes:
educational clarity.

NOT:
AI creativity.

Creative AI behavior is allowed ONLY if:
- it improves teaching
- it improves understanding
- it preserves lesson structure

--------------------------------------------------
SECTION 3 — LESSON FLOW RULES
--------------------------------------------------

# 5. Lessons Must Follow Clear Progression

Progression always follows:

Unit
→ Section
→ Exercise
→ Step
→ Sentence
→ Paragraph

The lesson should NEVER:
jump unpredictably.

--------------------------------------------------

# 6. Exercise State Is Sacred

The runtime must always know:
- current exercise
- current item
- current sentence
- current paragraph
- current reading position

This progression must survive:
- reconnects
- refreshes
- save-and-leave
- websocket interruptions

--------------------------------------------------

# 7. Reading Mode Is Interactive

Reading mode is:
live teacher-guided reading.

NOT:
passive speech recognition.

The teacher should:
- interrupt naturally
- correct pronunciation
- guide difficult words
- continue reading naturally

Only one reading chunk should be visible at a time.

--------------------------------------------------

# 8. Lesson Completion Must Feel Earned

The teacher should:
- acknowledge completion
- summarize progress
- explain strengths
- explain weaknesses
- prepare next focus areas

Lesson endings should feel:
human,
educational,
meaningful.

--------------------------------------------------
SECTION 4 — AI BEHAVIOR RULES
--------------------------------------------------

# 9. The Teacher Must Sound Human

The teacher should sound:
- concise
- educational
- natural
- structured
- responsive

Avoid:
- GPT essays
- motivational spam
- assistant phrasing
- robotic confirmations
- repetitive encouragement

--------------------------------------------------

# 10. The Teacher Must Recover Agenda

If the student interrupts:
the teacher should:
1. answer naturally
2. return to the lesson naturally

The lesson must NEVER permanently derail.

--------------------------------------------------

# 11. Explanations Must Be Contextual

The teacher explains:
ONLY what matters right now.

Avoid:
- giant grammar lectures
- broad theory dumps
- unrelated examples

The classroom should feel:
interactive,
not lecture-based.

--------------------------------------------------

# 12. Personality Must Never Break Structure

Emma:
- warm
- supportive
- patient

Alex:
- structured
- concise
- disciplined

BUT:
both must still preserve:
- pacing
- lesson structure
- progression integrity
- educational flow

--------------------------------------------------
SECTION 5 — VOICE & REALTIME RULES
--------------------------------------------------

# 13. Voice Interaction Must Feel Natural

The runtime should support:
- interruptions
- quick responses
- conversational flow
- natural pauses
- natural continuation

The classroom should NEVER feel:
laggy,
robotic,
or chaotic.

--------------------------------------------------

# 14. Teacher Speech Has Priority

While teacher audio is playing:
the runtime must avoid:
- echo loops
- self-transcription
- overlapping speech

--------------------------------------------------

# 15. Mic Lifecycle Must Be Controlled

The mic must NEVER:
stay permanently open.

The system should support:
controlled speaking turns.

--------------------------------------------------

# 16. Speaking State Must Be Accurate

The runtime must correctly know:
- when teacher audio actually finishes
- when student speaking starts
- when interruptions happen
- when playback queues end

--------------------------------------------------
SECTION 6 — RESUME & PERSISTENCE RULES
--------------------------------------------------

# 17. Lessons Must Survive Reconnects

The classroom should survive:
- websocket disconnects
- refreshes
- temporary network failure
- save-and-leave

The student should feel:
the lesson never broke.

--------------------------------------------------

# 18. Resume Must Be Exact

Resume restores:
- exercise position
- reading position
- remaining time
- teacher context
- reflection context
- active objective

NOT:
approximate lesson state.

--------------------------------------------------

# 19. Persistent Memory Must Be Educational

The system may remember:
- recurring grammar mistakes
- pronunciation weaknesses
- vocabulary struggles
- pacing difficulties

The system must NOT:
become creepy AI memory.

--------------------------------------------------
SECTION 7 — COST & PERFORMANCE RULES
--------------------------------------------------

# 20. Runtime Must Be Cost-Aware

Avoid:
- duplicate AI calls
- duplicate TTS
- runaway STT streaming
- reconnect spam
- recursive orchestration

--------------------------------------------------

# 21. No Runtime Activity Before Begin Lesson

Before:
"Begin Lesson"

There must be:
- no AI calls
- no TTS
- no STT
- no paid runtime consumption

--------------------------------------------------

# 22. Runtime Stability > Feature Quantity

A stable lesson is more important than:
experimental AI features.

Never sacrifice:
stability,
continuity,
or educational quality
for flashy behavior.

--------------------------------------------------
SECTION 8 — UX PRINCIPLES
--------------------------------------------------

# 23. The Classroom Must Feel Calm

The lesson should feel:
- guided
- stable
- understandable
- focused
- intentional

NOT:
- noisy
- chaotic
- unpredictable

--------------------------------------------------

# 24. Students Must Always Understand Context

The student should ALWAYS know:
- current task
- lesson goal
- what to do next
- what was completed

--------------------------------------------------

# 25. The System Must Feel Professional

The runtime should feel like:
a commercial learning platform.

NOT:
a hacked AI demo.

--------------------------------------------------
SECTION 9 — ENGINEERING PRINCIPLES
--------------------------------------------------

# 26. Incremental Evolution Only

The runtime evolves:
incrementally.

Avoid:
massive rewrites,
architecture resets,
or parallel runtime systems.

--------------------------------------------------

# 27. Preserve Stable Systems

If a subsystem is stable:
DO NOT rewrite it.

--------------------------------------------------

# 28. Backend Owns Truth

The backend always owns:
- progression
- billing
- persistence
- runtime authority
- reconnect state

Frontend renders:
state from backend authority.

--------------------------------------------------

# 29. Observability Is Mandatory

Production systems require:
- runtime logs
- reconnect logs
- lesson lifecycle logs
- AI lifecycle logs
- billing logs
- provider fallback logs

--------------------------------------------------

# 30. Runtime Determinism Is Critical

The same lesson state should produce:
consistent runtime behavior.

The system should avoid:
random,
chaotic,
or unpredictable runtime branching.

--------------------------------------------------
FINAL PRINCIPLE
--------------------------------------------------

The AI Teacher Runtime should feel like:

a real structured online English lesson
with a professional human-like teacher,
persistent educational continuity,
stable realtime voice interaction,
and deterministic curriculum progression.

NOT:
a GPT conversation pretending to teach.