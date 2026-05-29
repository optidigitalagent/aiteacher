# Mentium Kids Brain v1 — Phase 8: Production Wiring

## Goal

Wire Mentium Kids Brain v1 into the existing production kids lesson flow.

This phase replaces the old kids prototype runtime usage with the new:

backend/src/kids-brain/

Do this ONLY for kids mode.

Adult lesson flow must remain untouched.

## Source of Truth

Read first:

- docs/kids-brain-v1/implementation/phase-7.7-phase-8-readiness-report.md
- docs/kids-brain-v1/implementation/phase-7.6-integration-infrastructure.md
- docs/kids-brain-v1/implementation/phase-7-runtime-orchestrator.md
- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-spec.md
- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-patch-1.1.md

Inspect:

- backend/src/ws/lesson-ws.ts
- backend/src/kids-runtime/
- backend/src/kids-brain/
- backend/src/kids-brain/runtime/
- backend/src/kids-brain/infrastructure/
- backend/src/kids-brain/adapters/

## ABSOLUTE RULE

Before modifying code:

Produce an Integration Plan.

The plan must list:

1. files to modify
2. exact functions to modify
3. imports to add/remove
4. old kids-runtime calls to replace
5. new kids-brain calls to use
6. tests to add/update
7. risks

Do NOT code until the plan is approved.

## Allowed Scope

You may modify only:

- backend/src/ws/lesson-ws.ts
- backend/src/kids-brain/** tests if needed
- docs/kids-brain-v1/implementation/phase-8-production-wiring.md if needed

If another file is required, stop and explain why before coding.

## Forbidden Scope

Do NOT:

- modify adult Obsidian brain
- modify adult lesson runtime
- modify billing
- modify auth
- modify frontend
- create new WebSocket protocol if existing events can be reused
- create new TTS system
- create new STT system
- remove old kids-runtime folder
- change migrations
- change database schema
- deploy
- continue to Phase 9

## Required Wiring

Replace current kids-mode branch so that:

1. kids session start uses:
   - startKidsBrainSession()
   - RedisSessionStoreImpl.saveSession()

2. kids turn processing uses:
   - buildSTTResult()
   - processKidsBrainTurn()
   - RedisSessionStoreImpl.saveSession()
   - adaptRuntimePackets()

3. kids silence processing uses:
   - processKidsBrainSilence()
   - RedisSessionStoreImpl.saveSession()
   - adaptRuntimePackets()

4. kids session end uses:
   - endKidsBrainSession()
   - RedisSessionStoreImpl.deleteSession() or final save behavior
   - adapted WS messages

## Critical Runtime Rules

- Kids Brain v1 must only run when session mode is mentium_kids.
- Adult sessions must continue using existing adult flow.
- Adult paid-session checks must remain unchanged.
- Kids auth/ownership checks must remain enforced.
- Existing kids session route must remain authenticated.
- No unauthenticated kids brain usage.
- No billing bypass for adult mode.
- No free unlimited usage.

## Old Prototype Runtime

Current production uses old prototype:

backend/src/kids-runtime/orchestrator.ts

For Phase 8:

- do not delete it
- do not refactor it
- bypass it only in the new kids-brain path
- keep it available as emergency fallback if simple

## TTS Rule

Do NOT create duplicate TTS.

If existing adult/kids WS handler already streams TTS from teacher text:

- pass teacher text through existing path

If old kidsTtsStream() exists:

- do not layer new TTS on top of it
- avoid double audio
- document exact behavior

## STT Rule

Use existing transcript text/audio result from current WS flow.

Do not call STT provider directly.

Convert existing transcript into STTResult via:

- buildSTTResult()
or
- buildSTTResultFromText()

## WS Message Rule

Use:

- adaptRuntimePackets()

Map resulting messages to current frontend-supported events.

Prefer existing event types:

- ai_text
- lesson_end
- error
- listening state if already supported

Do not require frontend changes in Phase 8 unless impossible.

If impossible, stop and report.

## Redis Rule

Use RedisSessionStoreImpl for active SessionMemory.

Required:

- save after session start
- load before turn
- save after turn
- load before silence processing
- save after silence processing
- clean up or finalize on end

If Redis unavailable:

- fail safely
- do not silently fall back to in-memory in production

## Cold Profile Rule

If no child profile exists yet:

- use safe default profile
- firstName fallback: "friend"
- ageBand fallback: 6-7
- preferredCharacter fallback: "milo"

Do not block lesson start because profile is missing.

## Safety Rule

If RuntimeTurnResult.safeToContinue=false:

- send safety close message
- stop session
- do not continue lesson
- do not call LLM
- do not ask open-ended questions

## Required Tests

Add/update tests for:

1. kids mode routes to kids-brain, not old kids-runtime
2. adult mode does NOT import or call kids-brain runtime
3. kids session start saves SessionMemory to Redis store
4. kids turn loads SessionMemory from Redis
5. kids turn saves updated SessionMemory after processing
6. STT adapter is used for transcript conversion
7. RuntimeActionPackets are adapted to WS messages
8. safety close stops kids session
9. missing profile uses safe fallback
10. Redis failure returns safe error
11. no duplicate TTS path
12. old kids-runtime remains untouched
13. adult tests still pass if available

Use mocks/stubs.
Do not require live Redis/Postgres.

## Acceptance Criteria

- Kids Brain v1 is called in kids mode
- old kids-runtime is no longer primary for kids mode
- adult runtime unchanged
- auth/ownership remains enforced
- Redis active session persistence is used
- STT adapter is used
- WS action adapter is used
- no frontend changes unless explicitly justified
- no duplicate TTS
- TypeScript passes
- kids-brain tests pass
- relevant lesson-ws tests pass if present

## Commands

Run:

cd backend
npx tsc --noEmit
npx vitest run src/kids-brain

Also run any existing lesson/ws tests if available.

## Output Required

After implementation report:

1. files modified
2. imports changed
3. old kids-runtime calls replaced
4. new kids-brain calls added
5. commands run
6. test results
7. confirmation adult flow untouched
8. confirmation frontend untouched
9. remaining risks