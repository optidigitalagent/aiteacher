# Mentium Kids Brain v1 — Phase 1: Contracts & Schemas

## Role

You are implementing Phase 1 of Mentium Kids Brain v1 inside an existing production AI English learning platform.

## Source of Truth

Read first:

- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-spec.md
- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-patch-1.1.md

These files are authoritative.

If this phase file conflicts with the Approved Spec or Patch 1.1, stop and report the conflict before coding.

## Goal

Create the backend TypeScript foundation for Mentium Kids Brain v1.

This phase creates only:

- shared types
- enums
- interfaces
- schemas
- constants
- vocabulary allowlist
- log event contracts
- store interfaces
- compile-time boundaries

No runtime behavior yet.

## Target Directory

Create:

backend/src/kids-brain/

## Required File Tree

Create:

backend/src/kids-brain/index.ts

backend/src/kids-brain/shared/
- types.ts
- enums.ts
- constants.ts
- errors.ts
- log-events.ts
- score.ts

backend/src/kids-brain/contracts/
- stt-result.ts
- action-packet.ts
- turn-record.ts
- mastery-record.ts
- child-profile.ts
- session-memory.ts
- stores.ts

backend/src/kids-brain/state/
- child-state.ts
- session-state.ts
- item-state.ts

backend/src/kids-brain/vocabulary/
- core-teacher-vocabulary.ts

backend/src/kids-brain/__tests__/
- phase-1-contracts.test.ts

## Hard Boundaries

Do NOT:
- modify adult Obsidian brain
- modify adult lesson runtime
- modify existing WebSocket behavior
- modify frontend
- modify database migrations
- implement Redis adapter
- implement Postgres adapter
- implement STT adapter
- implement perception logic
- implement classification logic
- implement learning engine
- implement teacher response generation
- implement TTS
- add UI
- add curriculum
- add rewards/videos/avatars
- wire kids-brain into production runtime

This phase is compile-time foundation only.

## Required Contracts

Implement TypeScript types/interfaces/enums for:

- STTResult
- ActionPacket
- TurnRecord
- MasteryRecord
- ChildProfile
- SessionMemory
- ChildState
- ItemState
- SessionState
- ResponseClassification
- RecoveryState
- ActivityType
- TeacherActionType
- AgeProfile
- LogEvent
- RedisSessionStore
- PostgresProfileStore
- SafetyEventStore

## Canonical Score Scale

Use 0–100 as the internal engine score scale.

Create branded/helper types or clear helpers for:

- EngineScore: 0–100
- SessionScore: 0–1

Create helpers:

- clampEngineScore()
- clampSessionScore()
- engineToSessionScore()
- sessionToEngineScore()

Do not mix 0–1 and 0–100 scales silently.

## Store Contracts

Define interfaces only:

RedisSessionStore:
- getSession(sessionId)
- saveSession(session)
- deleteSession(sessionId)
- reconnectSession(sessionId, userId)
- autosaveSession(session, sequenceNumber)

PostgresProfileStore:
- getChildProfile(childId, userId)
- saveChildProfile(profile)
- getMasteryRecord(childId, itemId)
- saveMasteryRecord(record)
- saveSessionSummary(summary)

SafetyEventStore:
- createSafetyEvent(event)
- listSafetyEventsForReview()

Do not implement actual persistence in Phase 1.

## STT Contract

Define normalized STTResult interface only.

It must support missing/null values safely:

- transcript
- confidence
- alternatives
- languageCode
- speechDurationMs
- audioEnergyLevel
- provider
- rawProviderPayload

Do not import Google/Chirp SDKs in Phase 1.

## Action Packet Contract

Define a closed enum for action packet types.

ActionPacket must support:

- teacher_text
- teacher_audio
- start_listening
- stop_listening
- show_choice
- show_hint
- recovery_prompt
- session_complete
- safety_close
- error

Include:
- actionId
- sessionId
- turnNumber
- timestamp
- payload
- idempotencyKey

## TurnRecord Contract

Define TurnRecord with:

- turnId
- sessionId
- turnNumber
- childInputType
- childText
- sttConfidence
- classification
- classificationConfidence
- teacherAction
- recoveryState
- activityType
- targetItemId
- latencyMs
- createdAt

Do not store sensitive raw audio.

## MasteryRecord Contract

Define MasteryRecord with:

- childId
- itemId
- itemType
- masteryLevel
- comprehensionScore
- productionScore
- pronunciationScore
- correctComprehensionCount
- correctProductionCount
- promptedCorrectCount
- unpromptedCorrectCount
- sessionsSeen
- lastSeenAt
- nextReviewAt
- updatedAt

## ChildProfile Contract

Define ChildProfile with:

- childId
- userId
- firstName
- ageBand
- preferredCharacterId
- safePreferences
- recentSuccesses
- createdAt
- updatedAt

Do not include sensitive personal data.

## SessionMemory Contract

Define SessionMemory with:

- sessionId
- userId
- childId
- mode = "mentium_kids"
- ageProfile
- currentUnitId
- currentActivityId
- currentTargetItemId
- childState
- itemState
- recentTurns
- recoveryState
- turnNumber
- costCounters
- autosaveSequenceNumber
- startedAt
- updatedAt

## Vocabulary Guard Foundation

Create:

backend/src/kids-brain/vocabulary/core-teacher-vocabulary.ts

Export:

- CORE_TEACHER_VOCABULARY
- CORE_TEACHER_VOCABULARY_SET
- isCoreTeacherWordAllowed()

Use the approved Patch 1.1 vocabulary list.

Deduplicate duplicates in the exported Set.

Do not add new words beyond the approved list unless Patch 1.1 requires them.

## Logging Foundation

Create typed log event names for:

- kids_session_started
- kids_turn_started
- perception_completed
- classification_completed
- classification_timeout_fallback
- recovery_state_changed
- learning_decision_made
- teacher_response_built
- vocabulary_guard_blocked
- session_autosaved
- session_reconnected
- session_completed
- safety_event_created

Define LogEvent base schema with:

- eventName
- sessionId
- childId optional
- userId optional
- turnNumber optional
- timestamp
- severity
- data

## Tests

Add tests for:

1. all public exports are importable from backend/src/kids-brain/index.ts
2. action packet enum contains all required action types
3. core teacher vocabulary set deduplicates duplicate words
4. isCoreTeacherWordAllowed() works for allowed and disallowed words
5. confidence score helpers clamp correctly
6. engine/session score conversion works
7. log event names are stable
8. SessionMemory requires mode="mentium_kids"
9. kids-brain does not import adult Obsidian modules
10. adult runtime does not import kids-brain

## Acceptance Criteria

- backend/src/kids-brain/ exists
- all required files exist
- all Phase 1 contracts compile
- tests pass
- no adult behavior changed
- no frontend changes
- no production runtime wiring
- no database migrations
- no Redis/Postgres/STT implementation yet

## Commands

Run:

cd backend
npx tsc --noEmit
npx vitest run

## Output Required

Report:

1. files created
2. files modified
3. commands run
4. test results
5. any conflicts with Approved Spec or Patch 1.1
6. any deviations from this phase file