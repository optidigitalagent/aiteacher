# Mentium Kids Brain v1 — Phase 7.6: Integration Infrastructure

## Goal

Implement the infrastructure adapters required before production WebSocket wiring.

This phase resolves the 5 blockers from Phase 7.5 audit:

1. Redis session store implementation
2. Postgres profile/mastery/session/safety store implementation
3. Database migrations 019–022
4. STT adapter
5. RuntimeActionPacket → existing WebSocket message adapter

Do NOT wire Kids Brain v1 into production WebSocket yet.

## Source of Truth

Read first:

- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-spec.md
- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-patch-1.1.md
- docs/kids-brain-v1/implementation/phase-7.5-integration-readiness-audit-report.md

Also read:

- backend/src/kids-brain/
- backend/src/db/
- backend/src/lesson-ws.ts
- backend/migrations/
- backend/src/kids-runtime/

## Target Directories

Create:

backend/src/kids-brain/infrastructure/
backend/src/kids-brain/adapters/

## Create Files

backend/src/kids-brain/infrastructure/
- index.ts
- redis-session.store.ts
- postgres-profile.store.ts
- postgres-safety-event.store.ts
- postgres-session-summary.store.ts

backend/src/kids-brain/adapters/
- index.ts
- stt-adapter.ts
- ws-action-adapter.ts

backend/src/kids-brain/infrastructure/__tests__/
- infrastructure-contracts.test.ts

backend/src/kids-brain/adapters/__tests__/
- adapters.test.ts

## Create Migrations

Create migrations:

- backend/migrations/019_kids_child_profiles.sql
- backend/migrations/020_kids_mastery_records.sql
- backend/migrations/021_kids_session_summaries.sql
- backend/migrations/022_kids_safety_events.sql

Update migration loader if migrations are listed manually.

Migrations must be idempotent.

Use:
- CREATE TABLE IF NOT EXISTS
- CREATE INDEX IF NOT EXISTS
- safe constraints

## Strict Boundaries

Do NOT:
- modify production WebSocket routing
- modify adult runtime
- modify frontend
- switch /kids to kids-brain v1 yet
- remove old kids-runtime prototype
- call real STT providers
- call real TTS
- call real LLM APIs
- deploy wiring

This phase only builds infrastructure/adapters.

## Redis Session Store

Implement RedisSessionStore interface from Phase 1.

Use existing Redis client if available.

If current Redis abstraction exists, use it.

Required behavior:
- getSession(sessionId)
- saveSession(session)
- deleteSession(sessionId)
- reconnectSession(sessionId, userId)
- autosaveSession(session, sequenceNumber)

Requirements:
- key format: kids:session:{sessionId}
- TTL configurable, default 30 minutes
- enforce user ownership on reconnect
- autosave must use sequenceNumber guard
- prevent stale autosave overwriting newer state
- if Redis unavailable, return controlled error
- do not silently fall back to in-memory in production

If exact Redis transaction/Lua support is not available, implement a conservative read-compare-write guard and document limitation.

## Postgres Stores

Implement:

PostgresProfileStore:
- getChildProfile(childId, userId)
- saveChildProfile(profile)
- getMasteryRecord(childId, itemId)
- saveMasteryRecord(record)
- saveSessionSummary(summary)

SafetyEventStore:
- createSafetyEvent(event)
- listSafetyEventsForReview()

SessionSummaryStore if useful:
- saveSessionSummary(summary)
- getSessionSummary(sessionId, userId)

Use existing Postgres query helper.

Do not create sensitive data fields beyond approved schema.

Do not store raw audio.

Do not store unrestricted raw transcripts.

## STT Adapter

Implement adapter from current production transcript/STT shape into normalized STTResult.

No external STT provider call.

This adapter should accept:
- transcript text
- optional confidence
- optional alternatives
- optional languageCode
- optional duration
- optional raw provider payload

and return STTResult.

If confidence is missing:
- set confidence=null
- allow perception layer to degrade safely

## WS Action Adapter

Implement adapter from RuntimeActionPacket[] to existing classroom WS message format.

Required:
- teacher_text maps to current teacher text event
- start_listening maps to existing listening/mic enable event if available
- stop_listening maps to existing listening/mic stop event if available
- session_complete maps to existing session complete/close event if available
- safety_close maps to safe close text + session close event

If no existing matching event exists:
- create adapter-level internal type, but do not wire into WebSocket yet
- document required Phase 8 mapping

Do not modify frontend in this phase.

## Tests

Add tests for:

1. migrations files exist
2. migration loader includes 019–022 if required
3. Redis store serializes/deserializes SessionMemory
4. Redis reconnect rejects wrong userId
5. Redis autosave sequence prevents stale overwrite
6. Postgres profile store maps ChildProfile safely
7. Postgres mastery store maps MasteryRecord safely
8. Safety event store does not require FK to child_profiles
9. STT adapter handles transcript only
10. STT adapter handles missing confidence
11. STT adapter handles alternatives
12. WS adapter maps teacher_text
13. WS adapter maps safety_close
14. WS adapter does not emit audio packets yet
15. no production lesson-ws routing changed
16. no adult Obsidian imports
17. kids-brain tests pass

Use mocks/stubs where needed. Do not require live Redis/Postgres for unit tests unless existing test infra already supports it.

## Acceptance Criteria

- all 5 audit blockers have implementation artifacts
- migrations 019–022 exist
- migration loader updated if necessary
- RedisSessionStore implementation exists
- Postgres store implementations exist
- STT adapter exists
- WS action adapter exists
- no production wiring
- no frontend changes
- TypeScript passes
- kids-brain tests pass
- adult runtime unchanged

## Commands

Run:

cd backend
npx tsc --noEmit
npx vitest run src/kids-brain

If migrations affect global tests, run relevant migration/db tests if available.

## Output Required

Report:

1. files created
2. files modified
3. migrations created
4. commands run
5. test results
6. blockers resolved
7. remaining risks
8. confirmation that production WebSocket wiring was NOT changed