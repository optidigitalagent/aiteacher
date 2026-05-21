Read CLAUDE.md first.

Then read:
docs/PAID_LESSON_RUNTIME_ROADMAP.md

Then read:
the latest PHASE_4 handoff.

Work ONLY on:
Phase 5 — Persistent Tips & Learning Memory

Do NOT work on future phases.

Do NOT redesign the runtime architecture.

Current system state:
- lesson runtime exists
- deterministic lesson structure exists
- textbook grounding exists
- teacher agenda recovery exists
- conversational pacing improved
- runtime progression stabilized

However:

The teacher still behaves too stateless between lessons.

Current major problems:
- teacher forgets recurring mistakes
- pronunciation weaknesses not remembered
- grammar weaknesses not remembered
- vocabulary gaps not tracked
- lesson insights disappear after session ends
- no persistent learning profile exists
- no cumulative learning intelligence exists
- student progress not evolving over time

GOAL OF THIS PHASE

Transform the teacher from:
"a session-based tutor"

into:

"a long-term learning mentor."

The AI should start remembering:
- recurring mistakes
- pronunciation struggles
- grammar weaknesses
- vocabulary gaps
- repeated confusion patterns

The student should feel:
"the teacher actually remembers me."

--------------------------------------------------
MAIN RESPONSIBILITIES
--------------------------------------------------

1. Build persistent learning memory

The system must persist:
- grammar weaknesses
- pronunciation issues
- vocabulary weaknesses
- repeated confusion patterns
- recurring mistakes
- difficult words
- difficult grammar structures

Persistence must survive:
- reconnects
- browser refreshes
- new lesson sessions
- new paid lessons

--------------------------------------------------

2. Build tips system

The teacher should generate:
- quick corrective tips
- pronunciation tips
- grammar reminders
- vocabulary reminders
- recurring weakness tips

Tips should:
- appear naturally
- not spam the student
- be concise
- be contextual

Examples:
- "Remember: past simple needs -ed here."
- "Watch the TH sound in this word."
- "You often forget articles before singular nouns."

--------------------------------------------------

3. Implement mistake categorization

The system should classify:
- pronunciation
- grammar
- vocabulary
- fluency
- sentence structure
- reading difficulty

This classification must:
- persist
- accumulate over time
- influence future teaching behavior

--------------------------------------------------

4. Build lightweight student profile memory

The teacher should remember:
- weak grammar areas
- weak pronunciation areas
- strong vocabulary areas
- reading speed tendencies
- repeated exercise struggles

The memory should:
- improve future lessons
- personalize explanations
- personalize pacing

IMPORTANT:
This is NOT a full AI memory system.

This is:
structured educational memory.

--------------------------------------------------

5. Add contextual teacher recall

The teacher should naturally say things like:
- "Last lesson you struggled with this tense."
- "You improved your pronunciation here."
- "This word was difficult for you before."

BUT:
the teacher must remain concise.

Avoid:
- creepy memory behavior
- excessive memory references
- unrelated historical references

The memory should feel:
educational and useful.

--------------------------------------------------

6. Preserve deterministic lesson structure

Do NOT allow memory to:
- break textbook progression
- derail exercises
- change curriculum structure
- create random AI tangents

Memory should SUPPORT lessons,
not replace them.

--------------------------------------------------

7. Preserve current architecture

Do NOT:
- redesign billing
- redesign websocket systems
- redesign renderer systems
- redesign lesson runtime
- redesign lesson state machine

Focus ONLY on:
persistent educational memory and tips.

--------------------------------------------------
IMPORTANT EXPERIENCE TARGET
--------------------------------------------------

The classroom should now feel like:

a teacher that actually knows the student.

The student should feel:
- recognized
- guided
- personally corrected
- progressively improving

WITHOUT:
- creepy AI memory
- random historical recall
- GPT-like personalization spam

--------------------------------------------------
REQUIRED RUNTIME TESTS
--------------------------------------------------

You MUST test:
- repeated pronunciation mistakes
- repeated grammar mistakes
- reconnect after tip generation
- lesson continuation after reconnect
- multiple lessons with same student
- persistence after lesson end
- contextual recall correctness
- repeated weak vocabulary usage

--------------------------------------------------
CRITICAL IMPLEMENTATION RULES
--------------------------------------------------

DO:
- use structured persistence
- preserve deterministic lesson progression
- preserve current runtime lifecycle
- preserve textbook grounding
- preserve existing orchestration

DO NOT:
- build general AI memory
- build open-ended chat memory
- store unnecessary conversation history
- create memory bloat
- rewrite orchestration systems

--------------------------------------------------
LESSON EXPERIENCE TARGET
--------------------------------------------------

The classroom should now feel:

personalized,
consistent,
educational,
adaptive,
teacher-like.

The AI should feel:
like a tutor tracking long-term progress.

NOT:
a stateless GPT session.

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