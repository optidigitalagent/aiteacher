# Mentium Kids Brain v1 — Phase 7: Runtime Orchestrator

## Goal

Implement the internal Kids Brain runtime orchestrator.

This phase connects existing modules into one pure backend pipeline:

Perception
→ Classification
→ State Engine
→ Learning Engine
→ Teacher Response Engine

Do NOT wire into production WebSocket yet.

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

## Target Directory

Create:

backend/src/kids-brain/runtime/

## Create Files

backend/src/kids-brain/runtime/
- index.ts
- runtime-types.ts
- runtime-result.ts
- kids-brain-orchestrator.ts
- session-bootstrap.ts
- turn-processor.ts
- silence-processor.ts
- runtime-context.ts
- runtime-logger.ts

backend/src/kids-brain/runtime/__tests__/
- runtime-orchestrator.test.ts

## Strict Boundaries

Do NOT:
- modify adult runtime
- modify frontend
- modify existing WebSocket handlers
- call real LLM APIs
- call real STT providers
- call TTS
- implement Redis/Postgres adapters
- persist data
- deploy runtime wiring
- modify existing kids prototype runtime

This phase is internal orchestration only.

## Required Runtime API

Implement:

- startKidsBrainSession()
- processKidsBrainTurn()
- processKidsBrainSilence()
- endKidsBrainSession()

## Runtime Flow

processKidsBrainTurn must run:

1. Build PerceptionBundle
2. Run Classification Engine
3. Run State Engine
4. Run Learning Engine
5. Run Teacher Response Engine
6. Return RuntimeTurnResult

## RuntimeTurnResult

Include:

- sessionId
- turnNumber
- perceptionBundle
- classificationResult
- stateEngineOutput
- learningDecision
- teacherResponsePlan
- updatedSessionMemory
- actionPackets
- logsToEmit
- safeToContinue
- shouldCloseSession
- createdAt

## Session Bootstrap

startKidsBrainSession must:

- create initial SessionMemory
- set mode = mentium_kids
- initialize child state
- initialize item state
- initialize cost counters
- initialize recovery state
- create first teacher greeting response
- not persist anything

## Silence Processor

processKidsBrainSilence must:

- create synthetic empty STTResult
- pass silence duration into perception
- classify silence
- update state
- produce learning decision
- produce teacher response
- not punish silence as failure by itself

## End Session

endKidsBrainSession must:

- produce safe closing result
- not persist summary yet
- not call TTS
- not call external APIs

## Action Packets

Convert TeacherResponsePlan into ActionPacket[].

Required packets:

- teacher_text
- start_listening
- stop_listening
- session_complete
- safety_close

Do not generate audio packets yet.

## Tests

Add tests for:

1. start session creates valid SessionMemory
2. start session creates greeting teacher response
3. normal correct turn runs full pipeline
4. wrong turn runs full pipeline without punishment
5. silence turn runs full pipeline
6. L1 turn runs full pipeline
7. refusal turn triggers recovery/safe close path
8. unsafe turn sets safeToContinue=false
9. output includes action packets
10. updated session memory is returned
11. no input session mutation
12. no LLM calls
13. no TTS calls
14. no persistence
15. no adult Obsidian imports
16. exported from backend/src/kids-brain/index.ts

## Acceptance Criteria

- runtime module exists
- full internal pipeline works
- session start works
- turn processing works
- silence processing works
- session end works
- action packets are produced
- no production WebSocket wiring
- no external API calls
- no persistence
- TypeScript passes
- kids-brain tests pass
- adult runtime unchanged

## Commands

Run:

cd backend
npx tsc --noEmit
npx vitest run src/kids-brain

## Output Required

Report:

1. files created
2. files modified
3. commands run
4. test results
5. conflicts with spec
6. deviations