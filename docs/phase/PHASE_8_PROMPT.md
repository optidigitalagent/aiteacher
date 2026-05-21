Read CLAUDE.md first.

Then read:
docs/PAID_LESSON_RUNTIME_ROADMAP.md

Then read:
the latest PHASE_7 handoff.

Work ONLY on:
Phase 8 — Production Stabilization & Final QA

This is the FINAL stabilization phase.

Do NOT redesign the architecture.

Do NOT create new systems unless absolutely necessary.

The goal of this phase is:
stability,
polish,
consistency,
runtime safety,
production readiness.

Current system state:
- deterministic lesson runtime exists
- curriculum scaling exists
- resume system exists
- reflection system exists
- persistent memory exists
- realtime reading exists
- teacher pacing exists
- textbook grounding exists
- lesson progression exists

However:

The system may still contain:
- edge-case runtime instability
- reconnect edge cases
- websocket race conditions
- duplicated events
- long-session degradation
- token inefficiency
- STT inefficiency
- TTS inefficiency
- pacing inconsistencies
- subtle UX instability
- production-only bugs

GOAL OF THIS PHASE

Transform the platform from:
"a working advanced prototype"

into:

"a stable production-grade AI classroom."

--------------------------------------------------
MAIN RESPONSIBILITIES
--------------------------------------------------

1. Stabilize long-session runtime behavior

The system must remain stable during:
- full 50-minute lessons
- repeated reconnects
- rapid interruptions
- long reading sessions
- rapid STT/TTS switching
- browser refreshes
- unstable network conditions

The runtime must NOT:
- degrade over time
- duplicate events
- leak state
- lose progression
- create runaway loops

--------------------------------------------------

2. Eliminate websocket/runtime edge-case instability

Audit and stabilize:
- websocket reconnect flow
- reconnect race conditions
- duplicate event handling
- stale runtime restoration
- delayed playback cleanup
- orphaned runtime state
- duplicate timers
- duplicate listeners

The runtime must behave:
deterministically.

--------------------------------------------------

3. Optimize runtime cost efficiency

The system must minimize:
- unnecessary STT streaming
- duplicate TTS generation
- unnecessary AI calls
- oversized prompts
- repeated orchestration context
- unnecessary reconnect initialization

The lesson must remain:
high quality,
while economically sustainable.

IMPORTANT:
Do NOT sacrifice lesson quality for aggressive optimization.

--------------------------------------------------

4. Improve production observability

Add or improve:
- structured runtime logs
- reconnect logs
- lesson lifecycle logs
- timeout logs
- reflection logs
- runtime error logs
- websocket lifecycle logs
- AI orchestration logs

Production debugging must become:
easy and deterministic.

--------------------------------------------------

5. Improve runtime resilience

The system should gracefully survive:
- websocket disconnects
- partial STT failure
- TTS provider instability
- delayed AI responses
- temporary Redis issues
- frontend refreshes
- reconnect storms

The classroom should:
recover cleanly,
not collapse.

--------------------------------------------------

6. Validate production deployment consistency

Audit:
- Railway runtime behavior
- environment variable usage
- websocket production URLs
- migration consistency
- Redis lifecycle
- provider fallbacks
- OpenAI fallback behavior
- ElevenLabs fallback behavior
- deployment assumptions

Production deployment must become:
predictable.

--------------------------------------------------

7. Final UX stabilization

The classroom should now feel:
smooth,
predictable,
professional,
stable.

Eliminate:
- awkward pauses
- duplicated teacher turns
- broken transitions
- delayed mic state updates
- unstable speaking indicators
- weird reconnect behavior
- confusing lesson flow

The system should feel:
cohesive.

--------------------------------------------------

8. Preserve architecture integrity

Do NOT:
- rewrite runtime architecture
- rewrite orchestration
- redesign billing
- redesign websocket systems
- redesign lesson engine
- redesign persistence architecture

This phase is:
stabilization,
NOT reinvention.

--------------------------------------------------
IMPORTANT EXPERIENCE TARGET
--------------------------------------------------

The final classroom should feel like:

a real production AI English tutor.

The student should trust:
- the lesson flow
- the reconnect behavior
- the teacher behavior
- the runtime stability
- the saved progress
- the voice interaction

The AI should feel:
professional,
stable,
educational,
natural.

--------------------------------------------------
REQUIRED RUNTIME TESTS
--------------------------------------------------

You MUST test:
- full 50-minute lesson
- repeated reconnects
- reconnect spam
- browser refresh spam
- rapid interrupts
- long reading exercises
- weak network simulation
- STT provider interruption
- TTS interruption
- Redis reconnect behavior
- long conversation stability
- lesson timeout behavior
- save-and-leave restoration
- reflection stability
- multi-unit lesson flow
- rapid exercise switching

--------------------------------------------------
CRITICAL IMPLEMENTATION RULES
--------------------------------------------------

DO:
- preserve deterministic runtime behavior
- preserve lesson structure
- preserve textbook grounding
- preserve billing integrity
- preserve runtime ownership boundaries
- preserve lesson persistence
- preserve state machine integrity

DO NOT:
- introduce large new systems
- rewrite core architecture
- replace websocket systems
- rebuild orchestration
- redesign classroom UI
- introduce experimental runtime logic

--------------------------------------------------
FINAL PRODUCT TARGET
--------------------------------------------------

The classroom should now feel:

production-grade,
stable,
professional,
persistent,
human,
educational.

The platform should feel:
like a real commercial AI English learning system.

NOT:
a realtime AI experiment.

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

FINAL RULE:
Do NOT claim production readiness unless:
- reconnect stability proven
- long-session runtime tested
- lesson persistence verified
- runtime costs verified
- websocket lifecycle stable
- classroom behavior deterministic