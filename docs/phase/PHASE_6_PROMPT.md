Read CLAUDE.md first.

Then read:
docs/PAID_LESSON_RUNTIME_ROADMAP.md

Then read:
the latest PHASE_5 handoff.

Work ONLY on:
Phase 6 — Resume, Continuation & Reflection

Do NOT work on future phases.

Do NOT redesign the runtime architecture.

Current system state:
- deterministic lesson runtime exists
- textbook grounding exists
- teacher pacing improved
- lesson state machine exists
- persistent learning memory exists
- tips system exists
- runtime progression partially stable

However:

The lesson still does NOT fully behave like:
a persistent continuous classroom.

Current major problems:
- reconnects still feel fragile
- lesson continuation not exact enough
- reflection system weak or missing
- paragraph continuation inconsistent
- runtime restoration incomplete
- save-and-leave flow incomplete
- lesson endings not educational enough
- lesson summaries not deeply connected to real lesson activity

GOAL OF THIS PHASE

Transform the classroom from:
"a temporary realtime session"

into:

"a persistent resumable learning environment."

The student should feel:
- lessons continue naturally
- progress is never lost
- the teacher always knows where they stopped
- reflections are meaningful
- lesson endings feel complete

--------------------------------------------------
MAIN RESPONSIBILITIES
--------------------------------------------------

1. Build exact runtime resume system

Resume must restore:
- current lesson state
- current unit
- current section
- current exercise
- current sentence
- current paragraph
- reading state
- remaining lesson time
- active lesson objective
- teacher context
- student progress

The system must survive:
- websocket disconnect
- browser refresh
- temporary network loss
- reconnect during reading
- reconnect during explanation

IMPORTANT:
Resume must feel:
instant and natural.

--------------------------------------------------

2. Build exact exercise continuation

The lesson must NEVER restart randomly.

Example:
If the student disconnected during:
- paragraph 2
- sentence 3
- reading correction

The lesson must continue EXACTLY there.

No:
- restarting exercises
- restarting explanations
- restarting paragraphs
- replaying entire teacher monologues

--------------------------------------------------

3. Build reflection engine

At the end of lessons:
the teacher should provide:
- concise reflection
- strengths
- weaknesses
- pronunciation feedback
- grammar feedback
- vocabulary feedback
- next-focus suggestions

The reflection must be:
- based on REAL lesson data
- based on REAL mistakes
- based on REAL progress

NOT:
generic GPT summaries.

--------------------------------------------------

4. Build natural lesson endings

Lesson endings should feel:
human and educational.

The teacher should:
- summarize progress
- acknowledge difficult areas
- encourage next lesson focus
- close naturally

Avoid:
- robotic session endings
- generic motivational spam
- GPT-style summary dumps

--------------------------------------------------

5. Improve save-and-leave behavior

Save-and-leave must:
- snapshot exact lesson cursor
- snapshot runtime state
- snapshot remaining time
- snapshot active reflection state

When resuming:
the student should feel:
"the lesson never broke."

--------------------------------------------------

6. Preserve deterministic structure

Do NOT allow:
- reflection to derail lesson structure
- continuation to restart exercises
- resume logic to duplicate runtime events
- restore logic to create duplicate AI turns

Determinism remains critical.

--------------------------------------------------

7. Preserve architecture boundaries

Do NOT:
- redesign billing
- redesign websocket stack
- redesign orchestration architecture
- redesign renderer architecture
- redesign persistence ownership

Focus ONLY on:
resume reliability,
continuation quality,
reflection quality.

--------------------------------------------------
IMPORTANT EXPERIENCE TARGET
--------------------------------------------------

The classroom should now feel:

persistent,
continuous,
stable,
professional,
session-aware.

The student should trust:
- reconnect safety
- lesson continuity
- saved progress
- runtime persistence

The teacher should feel:
aware of the lesson timeline.

--------------------------------------------------
REQUIRED RUNTIME TESTS
--------------------------------------------------

You MUST test:
- reconnect during reading
- reconnect during pronunciation correction
- reconnect during teacher explanation
- reconnect during reflection
- browser refresh mid-lesson
- save-and-leave during exercise
- save-and-leave during reading
- lesson timeout continuation
- reflection quality after weak lesson
- reflection quality after strong lesson

--------------------------------------------------
CRITICAL IMPLEMENTATION RULES
--------------------------------------------------

DO:
- preserve deterministic progression
- preserve current runtime lifecycle
- preserve current textbook grounding
- preserve existing lesson state machine
- preserve websocket ownership boundaries

DO NOT:
- rewrite runtime systems
- rewrite orchestration systems
- replace persistence systems
- create duplicate resume systems
- build generic GPT reflection flows

--------------------------------------------------
LESSON EXPERIENCE TARGET
--------------------------------------------------

The classroom should now feel:

persistent,
resumable,
educational,
continuous,
human.

The AI should feel:
like a real tutor continuing a real course.

NOT:
a fresh GPT session every reconnect.

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