Read CLAUDE.md first.

Then read:
docs/PAID_LESSON_RUNTIME_ROADMAP.md

Then read:
the latest PHASE_6 handoff.

Work ONLY on:
Phase 7 — Curriculum Completion & Focus 2 Scaling

Do NOT work on future phases.

Do NOT redesign the runtime architecture.

Current system state:
- deterministic lesson runtime exists
- resume system exists
- reflection system exists
- textbook renderer exists
- realtime reading exists
- persistent learning memory exists
- teacher pacing exists
- lesson progression exists

However:

The curriculum system is still incomplete.

Current major problems:
- not all Focus 2 units supported
- some sections incomplete
- renderer compatibility inconsistent
- some exercise types partially supported
- progression quality inconsistent between units
- curriculum scaling not fully validated
- some textbook structures may break runtime assumptions

GOAL OF THIS PHASE

Transform the classroom from:
"a partially working textbook runtime"

into:

"a fully scalable curriculum-driven learning platform."

The classroom must support:
ALL intended Focus 2 lesson structures consistently.

The runtime must behave:
predictably across the entire curriculum.

--------------------------------------------------
MAIN RESPONSIBILITIES
--------------------------------------------------

1. Complete Focus 2 curriculum mapping

The system must support:
- all units
- all sections
- all textbook lesson structures
- all supported exercise types

The runtime must correctly map:
- units
- sections
- exercise indexes
- reading passages
- vocab tasks
- grammar tasks
- mixed exercise sequences

No hardcoded unit assumptions.

--------------------------------------------------

2. Validate renderer compatibility across curriculum

The renderer must correctly support:
- short exercises
- long exercises
- reading-heavy sections
- grammar-heavy sections
- vocabulary-heavy sections
- mixed exercise flows

The classroom must NOT break when:
- exercise counts vary
- paragraph counts vary
- instruction structures vary
- lesson pacing changes naturally

--------------------------------------------------

3. Standardize lesson progression quality

The classroom experience must feel:
consistent across ALL units.

The student should NEVER feel:
- one section works differently
- one unit behaves worse
- one lesson is chaotic
- one exercise type is unstable

Consistency is critical.

--------------------------------------------------

4. Validate curriculum runtime transitions

The system must correctly handle:
- unit transitions
- section transitions
- exercise transitions
- paragraph transitions
- reflection transitions
- lesson completion transitions

No:
- broken jumps
- lost progression
- invalid cursor states
- exercise mismatch errors

--------------------------------------------------

5. Improve curriculum robustness

The system should gracefully handle:
- missing optional exercise data
- variable textbook structures
- optional reading blocks
- optional word-box sections

The runtime should:
degrade safely,
NOT crash.

--------------------------------------------------

6. Preserve deterministic architecture

Do NOT allow:
- AI-generated fake curriculum
- runtime improvisation
- curriculum hallucination
- non-deterministic exercise progression

The textbook remains:
the authoritative curriculum source.

--------------------------------------------------

7. Preserve current architecture

Do NOT:
- redesign billing
- redesign websocket systems
- redesign lesson state machine
- redesign orchestration architecture
- redesign persistence ownership
- redesign runtime ownership

Focus ONLY on:
curriculum scaling and consistency.

--------------------------------------------------
IMPORTANT EXPERIENCE TARGET
--------------------------------------------------

The classroom should now feel:

complete,
stable,
professional,
curriculum-driven,
production-like.

The student should feel:
every lesson works consistently.

The teacher should feel:
fully aware of the curriculum structure.

--------------------------------------------------
REQUIRED RUNTIME TESTS
--------------------------------------------------

You MUST test:
- random unit switching
- random section switching
- grammar-heavy lessons
- reading-heavy lessons
- vocabulary-heavy lessons
- reconnect during long exercises
- reconnect during reading
- mixed exercise sequences
- lesson completion across multiple units
- renderer consistency across units
- paragraph continuation across curriculum
- exercise cursor restoration across curriculum

--------------------------------------------------
CRITICAL IMPLEMENTATION RULES
--------------------------------------------------

DO:
- preserve deterministic runtime behavior
- preserve textbook grounding
- preserve lesson state machine
- preserve runtime persistence
- preserve existing websocket lifecycle
- preserve lesson timing systems

DO NOT:
- rewrite runtime systems
- rewrite renderer architecture
- rewrite orchestration systems
- create alternative curriculum engines
- replace lesson progression systems

--------------------------------------------------
LESSON EXPERIENCE TARGET
--------------------------------------------------

The classroom should now feel:

scalable,
stable,
complete,
consistent,
educational.

The AI should feel:
like a teacher operating a complete curriculum.

NOT:
a partially connected GPT prototype.

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