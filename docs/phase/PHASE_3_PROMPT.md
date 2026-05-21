Read CLAUDE.md first.

Then read:
docs/PAID_LESSON_RUNTIME_ROADMAP.md

Then read:
the latest PHASE_2 handoff.

Work ONLY on:
Phase 3 — Textbook Engine & Exercise Renderer

Do NOT work on future phases.

Do NOT redesign the runtime architecture.

Current system state:
- websocket runtime already exists
- billing already works
- paid runtime already works
- lesson state machine partially exists
- voice runtime partially stabilized
- Focus 2 content partially integrated
- lesson runtime still lacks deterministic textbook control

Current major problems:
- AI still improvises exercises
- exercise flow feels unstable
- lesson cursor weak
- reading progression weak
- AI sometimes invents textbook content
- exercise rendering inconsistent
- paragraph tracking incomplete
- reading mode not fully realtime
- lesson progression still partially GPT-like instead of textbook-driven

GOAL OF THIS PHASE

Transform the classroom into:
a deterministic textbook-driven lesson engine.

The AI should behave like:
a teacher operating inside a textbook structure.

NOT:
a free-chat AI assistant inventing exercises.

CRITICAL RULE

Exercises must come from textbook data.

The AI may:
- explain
- guide
- correct
- adapt pacing
- answer side questions

BUT:
the AI must NOT invent the curriculum structure itself.

--------------------------------------------------
MAIN RESPONSIBILITIES
--------------------------------------------------

1. Build deterministic exercise renderer

The runtime must support:
- fill-gap exercises
- word-box exercises
- matching exercises
- reading exercises
- grammar tasks
- pronunciation tasks

The renderer must:
- display exact instructions
- display exact words
- display exact sentence order
- preserve progression state

No AI-generated fake exercises.

--------------------------------------------------

2. Implement exact exercise cursor system

The system must track:
- current unit
- current section
- current exercise
- current sentence
- current paragraph
- current item index

Example:

Unit 1
Section 1.3
Exercise 4
Sentence 2 of 5

The cursor must persist:
- reconnects
- save-and-leave
- timeout
- browser refresh

--------------------------------------------------

3. Build realtime reading mode

Reading mode must work like this:

- only ONE paragraph/chunk visible at a time
- student reads in realtime
- teacher listens live
- teacher interrupts immediately if pronunciation blocked
- teacher helps instantly
- reading resumes naturally

The system must support:
- pause during reading
- correction during reading
- continue after correction
- chunk-by-chunk progression

IMPORTANT:
This is NOT transcription playback.

This is:
interactive teacher-guided reading.

--------------------------------------------------

4. Prevent AI curriculum hallucination

The AI must NEVER:
- invent exercises
- invent reading paragraphs
- skip exercises randomly
- jump between textbook sections
- create fake textbook instructions

The AI must always stay anchored to:
current textbook context.

--------------------------------------------------

5. Improve exercise UX behavior

The lesson should feel like:
a guided interactive English lesson.

Required runtime behavior:
- teacher explains exercise goal first
- teacher explains what student should do
- exercise visibly progresses
- teacher confirms completion
- teacher transitions naturally

The student should ALWAYS understand:
- what we are doing
- why we are doing it
- what comes next

--------------------------------------------------

6. Preserve current architecture

Do NOT:
- redesign billing
- redesign subscriptions
- redesign websocket architecture
- redesign deployment
- redesign lesson timer architecture

Focus ONLY on:
textbook grounding and deterministic lesson progression.

--------------------------------------------------
IMPORTANT UX GOALS
--------------------------------------------------

The classroom must start feeling like:

- a real English lesson
- a structured curriculum
- guided progression
- controlled pacing
- deterministic lesson flow

NOT:
- random GPT chat
- chaotic exercise switching
- improvised curriculum generation

--------------------------------------------------
REQUIRED RUNTIME TESTS
--------------------------------------------------

You MUST test:

- reconnect during exercise
- reconnect during reading
- save-and-leave during reading
- paragraph continuation
- sentence progression
- fill-gap flow
- word-box flow
- teacher interruption during reading
- pronunciation correction during reading
- resume after browser refresh

--------------------------------------------------
CRITICAL IMPLEMENTATION RULES
--------------------------------------------------

DO:
- reuse existing runtime systems
- extend existing websocket lifecycle carefully
- preserve working billing/runtime logic
- preserve lesson timing logic
- preserve current voice architecture

DO NOT:
- rewrite the entire classroom
- rewrite lesson runtime from scratch
- replace websocket architecture
- create parallel lesson systems

--------------------------------------------------
LESSON EXPERIENCE TARGET
--------------------------------------------------

The final feeling should be:

The student selected:
- unit
- section

Then:
the teacher confidently guides them through
REAL textbook exercises,
with clear progression,
live corrections,
and structured pacing.

The system should feel:

professional,
stable,
educational,
deterministic.

--------------------------------------------------
OUTPUT REQUIREMENTS
--------------------------------------------------

At the end output FULL PHASE HANDOFF using roadmap format:

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