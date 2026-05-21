# RUNTIME_GUARDRAILS.md

# PURPOSE

This document defines:
NON-NEGOTIABLE runtime protection rules
for the Paid Lesson Runtime system.

These guardrails exist to prevent:
- architecture drift
- GPT-style degeneration
- reconnect instability
- runtime chaos
- billing corruption
- lesson inconsistency
- curriculum hallucination
- voice/runtime regressions

Every Claude session MUST follow these rules.

Violating these guardrails means:
the system becomes unstable.

--------------------------------------------------
SECTION 1 — ARCHITECTURE GUARDRAILS
--------------------------------------------------

# 1. Backend Owns Runtime Authority

Frontend is presentation only.

Frontend MUST NOT:
- invent lesson state
- invent progression
- invent billing state
- invent exercise position
- invent lesson completion
- invent resume state
- invent runtime ownership

Backend remains authoritative for:
- runtime lifecycle
- lesson cursor
- billing
- persistence
- reconnect logic
- exercise progression
- reflection state
- learning memory

--------------------------------------------------

# 2. Single Runtime Ownership

There must NEVER be:
- multiple active lesson runtimes
- duplicate orchestrators
- duplicate websocket ownership
- parallel lesson state machines

One lesson session =
one authoritative runtime.

--------------------------------------------------

# 3. Deterministic Lesson Progression

The lesson must ALWAYS follow:
textbook structure.

The AI must NEVER:
- invent curriculum
- invent fake exercises
- skip sections randomly
- hallucinate textbook instructions
- generate arbitrary lesson flow

The textbook remains:
the source of truth.

--------------------------------------------------

# 4. Resume Integrity

Reconnects must NEVER:
- restart exercises randomly
- duplicate AI turns
- lose exercise cursor
- corrupt reading state
- replay completed exercises

Resume must restore:
EXACT lesson state.

--------------------------------------------------

# 5. Runtime Persistence Safety

Persistence must always preserve:
- current unit
- current section
- current exercise
- current sentence
- current paragraph
- remaining lesson time
- active reading state
- lesson objective
- teacher context

--------------------------------------------------
SECTION 2 — VOICE RUNTIME GUARDRAILS
--------------------------------------------------

# 6. No Open Mic Runtime

The mic must NEVER:
remain permanently open.

The runtime must support:
push-to-talk style control.

--------------------------------------------------

# 7. Teacher Speech Must Pause Student Capture

While teacher TTS is playing:
student STT must NOT aggressively stream.

Prevent:
- echo loops
- self-transcription
- recursive AI turns
- duplicate corrections

--------------------------------------------------

# 8. Interruptions Must Be Natural

Student interruptions should:
- pause teacher naturally
- answer naturally
- resume naturally

Interruptions must NEVER:
- corrupt progression
- restart lesson state
- duplicate context
- create runaway loops

--------------------------------------------------

# 9. Speaking State Integrity

The runtime must ALWAYS know:
- teacher speaking state
- student speaking state
- queued audio state
- playback completion state

Never rely ONLY on:
chunk arrival timing.

--------------------------------------------------

# 10. TTS Stability

Prevent:
- duplicated teacher speech
- overlapping audio
- replayed chunks
- stale playback queues
- abandoned playback timers

--------------------------------------------------
SECTION 3 — AI BEHAVIOR GUARDRAILS
--------------------------------------------------

# 11. No GPT Assistant Personality

The teacher is NOT:
a chatbot assistant.

Avoid:
- essays
- motivational fluff
- assistant phrasing
- repeated encouragement
- conversational drift

The teacher should feel:
professional,
focused,
educational.

--------------------------------------------------

# 12. Agenda Recovery Required

The teacher must ALWAYS recover:
- current exercise
- current goal
- current paragraph
- current reading state

Side questions must NEVER:
derail lesson progression permanently.

--------------------------------------------------

# 13. In-Context Teaching Only

The teacher explains:
ONLY what is relevant NOW.

Avoid:
- giant theory explanations
- unrelated examples
- broad lectures

--------------------------------------------------

# 14. Exercise Authority

Exercises come from:
structured textbook data.

NOT:
AI generation.

--------------------------------------------------

# 15. Reflection Must Use Real Data

Lesson reflections must use:
REAL runtime behavior.

Do NOT generate:
generic GPT summaries.

--------------------------------------------------
SECTION 4 — CURRICULUM GUARDRAILS
--------------------------------------------------

# 16. Exercise Cursor Is Sacred

The runtime cursor must ALWAYS track:
- unit
- section
- exercise
- item
- sentence
- paragraph

The cursor is:
authoritative lesson progression.

--------------------------------------------------

# 17. Reading Mode Rules

Realtime reading mode must:
- show one chunk at a time
- allow live correction
- allow interruption
- continue after correction

Reading mode is:
interactive,
NOT passive transcription.

--------------------------------------------------

# 18. Renderer Consistency

Exercise rendering must remain:
deterministic.

The same exercise should ALWAYS:
render the same structure.

--------------------------------------------------

# 19. Curriculum Consistency

Every unit must behave:
consistently.

No:
special-case chaos,
unit-specific hacks,
hardcoded flows.

--------------------------------------------------
SECTION 5 — BILLING & COST GUARDRAILS
--------------------------------------------------

# 20. Billing Authority Stays Backend-Only

Frontend must NEVER:
calculate paid lesson authority.

Backend owns:
- remaining minutes
- lesson access
- lesson duration
- paid runtime validation

--------------------------------------------------

# 21. No Cost Runaway Loops

Prevent:
- duplicated AI calls
- duplicate TTS
- continuous STT streaming
- reconnect initialization spam
- recursive orchestration loops

--------------------------------------------------

# 22. Cost Visibility Required

Runtime logs should expose:
- AI calls
- TTS usage
- STT usage
- reconnect behavior
- lesson duration
- provider fallback behavior

--------------------------------------------------

# 23. No AI Activity Before Begin Lesson

Before:
"Begin Lesson"

There must be:
- no STT streaming
- no TTS generation
- no AI orchestration
- no paid minute consumption

--------------------------------------------------
SECTION 6 — RECONNECT & SAVE GUARDRAILS
--------------------------------------------------

# 24. Save-And-Leave Must Be Exact

Save-and-leave must snapshot:
- cursor
- runtime state
- remaining time
- reading state
- teacher state
- active exercise state

--------------------------------------------------

# 25. Browser Refresh Must Be Safe

Refresh should NEVER:
- destroy lesson progression
- corrupt runtime
- duplicate lesson ownership

--------------------------------------------------

# 26. Redis Is Runtime Cache, Not Curriculum Source

Redis stores:
runtime state.

Redis must NOT become:
the authoritative curriculum source.

--------------------------------------------------

# 27. Runtime Must Degrade Gracefully

If:
- STT fails
- TTS fails
- Redis reconnects
- websocket reconnects
- AI delays occur

The classroom should:
recover gracefully.

NOT collapse.

--------------------------------------------------
SECTION 7 — DEVELOPMENT GUARDRAILS
--------------------------------------------------

# 28. No Massive Rewrites Mid-Phase

Claude must NEVER:
rewrite the entire runtime during one phase.

Changes must remain:
targeted and incremental.

--------------------------------------------------

# 29. Preserve Stable Systems

If a subsystem is stable:
DO NOT rewrite it.

Example:
- billing
- websocket ownership
- lesson state machine
- runtime persistence

--------------------------------------------------

# 30. Every Phase Must End With Handoff

Every phase MUST produce:
a detailed handoff.

The next Claude session must understand:
- what changed
- what remains unstable
- what was intentionally preserved
- what risks exist

--------------------------------------------------

# 31. Runtime Tests Are Mandatory

Compile success is NOT enough.

Every phase requires:
real runtime validation.

--------------------------------------------------

# 32. Avoid Architecture Drift

Do NOT:
- create parallel runtimes
- create duplicate orchestration systems
- create duplicate persistence layers
- split runtime authority ambiguously

--------------------------------------------------

# 33. Production Mindset Required

The system should always move toward:
- stability
- predictability
- observability
- educational quality
- runtime safety
- cost safety

NOT:
experimental AI chaos.

--------------------------------------------------
FINAL PRINCIPLE
--------------------------------------------------

The Paid Lesson Runtime is:

NOT:
a GPT chat app.

It IS:
a deterministic realtime educational runtime.

Every implementation decision must improve:
- lesson continuity
- runtime stability
- curriculum integrity
- educational quality
- reconnect safety
- production readiness
- voice interaction quality
- cost sustainability