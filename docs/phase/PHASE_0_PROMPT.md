# PHASE_0_PROMPT.md — Runtime Audit & System Foundation

# STATUS: COMPLETED (2026-05-10)

This file documents what Phase 0 required and what was done.
It is kept as a reference for future sessions.

--------------------------------------------------
PHASE 0 OBJECTIVE
--------------------------------------------------

Establish a stable foundation before modifying lesson behavior.

This phase was NOT about features.
This phase was about:
- understanding current architecture
- documenting existing runtime
- identifying unstable systems
- creating implementation safety

--------------------------------------------------
PHASE 0 DELIVERABLES (ALL COMPLETED)
--------------------------------------------------

✅ docs/PAID_LESSON_RUNTIME_ROADMAP.md — created (was already created before this session)
✅ docs/RUNTIME_GUARDRAILS.md — filled (was empty)
✅ docs/AI_TEACHER_RUNTIME_RULES.md — filled (was empty)
✅ docs/LESSON_RUNTIME_STATE_MAP.md — filled (was empty)
✅ docs/WEBSOCKET_EVENT_CONTRACT.md — completed (was partially filled)
✅ docs/RUNTIME_TEST_MATRIX.md — filled (was empty)
✅ docs/PHASE_HANDOFF_TEMPLATE.md — filled (was empty)
✅ Runtime audit: websocket, STT, TTS, billing, resume — all documented
✅ Unstable zones identified and documented
✅ Code: aiProcessing guard added (concurrent AI call fix)
✅ Code: lesson_ready event added (backend → frontend contract fix)
✅ TypeScript check: backend and frontend both pass with no errors

--------------------------------------------------
WHAT WAS AUDITED (NOT CHANGED)
--------------------------------------------------

- Demo lesson runtime — audited, NOT changed
- Billing system (LiqPay, subscriptions) — audited, NOT changed
- AI prompts (prompt-builder.ts) — audited, NOT changed
- STT lifecycle (DeepgramSTT) — audited, NOT changed (gap documented)
- TTS lifecycle (ElevenLabs/OpenAI) — audited, NOT changed
- Frontend UI/UX — audited, NOT changed
- Database schema — audited, NOT changed

--------------------------------------------------
MINIMAL CODE CHANGES MADE
--------------------------------------------------

1. backend/src/ws/message-types.ts
   - Added OutboundLessonReady interface
   - Added to OutboundMessage union

2. backend/src/ws/lesson-ws.ts
   - Added aiProcessing: boolean to ClientMeta interface
   - Added aiProcessing guard in processInput()
   - Added lesson_ready event sent after WS authentication
   - Improved connection log (includes sessionId)

3. frontend/src/features/classroom/services/classroomSocket.ts
   - Added lesson_ready to BackendMessage union

4. frontend/src/features/classroom/components/ClassroomLayout.tsx
   - lesson_ready handler: sets paidLessonReady via event (not WS onopen)
   - WS onopen: no longer sets paidLessonReady directly

--------------------------------------------------
PHASE 0 HANDOFF
--------------------------------------------------

See: docs/phase/PHASE_0_HANDOFF.md
