# Mentium Kids Brain v1 — Phase 7.5: Integration Readiness Audit

## Goal

Audit whether the completed Kids Brain Core is ready for production integration.

This is an audit phase only.

Do NOT implement Phase 8.
Do NOT wire into WebSocket.
Do NOT modify production runtime.

## Source of Truth

Read first:

- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-spec.md
- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-patch-1.1.md
- docs/kids-brain-v1/implementation/phase-1-contracts-and-schemas.md
- docs/kids-brain-v1/implementation/phase-2-perception-layer.md
- docs/kids-brain-v1/implementation/phase-3-classification-engine.md
- docs/kids-brain-v1/implementation/phase-4-state-engine.md
- docs/kids-brain-v1/implementation/phase-5-learning-engine.md
- docs/kids-brain-v1/implementation/phase-6-teacher-response-engine.md
- docs/kids-brain-v1/implementation/phase-7-runtime-orchestrator.md

Review implementation:

- backend/src/kids-brain/
- backend/src/lesson-ws.ts
- backend/src/routes/
- backend/src/index.ts
- backend/src/db/
- backend/migrations/
- frontend/src/pages/KidsPrototypePage.tsx
- frontend/src/components/ClassroomLayout.tsx
- frontend/src/lib/classroomSocket.ts

## Audit Questions

### 1. Runtime Wiring

Answer:

- Where should Kids Brain Runtime be called from?
- Which existing WS handler currently handles kids mode?
- Does kids mode currently bypass adult Obsidian/FSM completely?
- What is the minimum safe integration point?
- What must NOT be touched?

### 2. Session State

Answer:

- Where is kids session state currently stored?
- Does current implementation use in-memory session state?
- What must happen before Redis integration?
- What state must be restored on reconnect?
- What happens if websocket disconnects mid-turn?

### 3. STT/TTS Boundary

Answer:

- How does current classroom audio/STT flow work?
- Where does transcript text become available?
- Can Kids Brain accept existing transcript format?
- What adapter is needed between current STT output and STTResult?
- Where does TTS currently happen?
- Can TeacherResponsePlan.mainText be sent to existing TTS pipeline?

### 4. Action Packet Compatibility

Answer:

- What frontend messages currently exist?
- What backend WS messages currently emit teacher text/audio/listening events?
- Are RuntimeActionPacket types compatible with current ClassroomLayout?
- What adapter is required?
- What should be deferred?

### 5. Auth / Ownership / Billing

Answer:

- Is /lesson/kids/start authenticated?
- Does kids session validate user ownership?
- Does kids mode bypass billing safely?
- Are caps enforced?
- What abuse/cost protections are already active?
- What cost caps are missing for Kids Brain v1?

### 6. Database / Migration Readiness

Answer:

- Does kids_sessions table exist?
- Does it include enough fields for Phase 8?
- Are child_profiles/mastery_records/session_summaries/safety_events tables implemented?
- If not, which migrations are required before persistence?
- What can remain in-memory for Phase 8?

### 7. Adult Isolation

Answer:

- Which adult modules must not import kids-brain?
- Does any current kids-brain code import adult Obsidian modules?
- Does lesson-ws routing risk falling through into adult logic?
- What tests are needed to prove adult isolation after wiring?

### 8. Production Risk

Identify risks:

- breaking adult lessons
- duplicate TTS
- duplicate transcript recording
- session leaks
- websocket reconnect bugs
- cost runaway
- kids state lost mid-session
- frontend receiving unknown packets
- Railway deploy failure

## Output Required

Create a report:

docs/kids-brain-v1/implementation/phase-7.5-integration-readiness-audit-report.md

Include:

1. Executive Summary
2. Integration Readiness Score 0–100
3. Blockers Before Phase 8
4. Non-Blocking Risks
5. Required Adapters
6. Required Migrations
7. Required Tests
8. Recommended Phase 8 Scope
9. Explicit Do-Not-Touch List
10. Final Verdict

Final verdict must be one of:

- READY FOR PHASE 8
- NOT READY FOR PHASE 8

## Strict Rules

Do NOT modify code.
Do NOT implement adapters.
Do NOT create migrations.
Do NOT wire anything into WebSocket.
Do NOT modify frontend.
Do NOT modify backend runtime.

This phase is audit/report only.

## Commands

Run:

cd backend
npx tsc --noEmit
npx vitest run src/kids-brain

If useful, also inspect existing backend/frontend code with grep/search.

## Output Required In Chat

Report:

- files created
- commands run
- readiness score
- blockers
- final verdict