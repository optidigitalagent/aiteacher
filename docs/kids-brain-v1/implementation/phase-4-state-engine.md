# Mentium Kids Brain v1 — Phase 4: State Engine

## Source of Truth

Read first:

- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-spec.md
- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-patch-1.1.md
- docs/kids-brain-v1/implementation/phase-1-contracts-and-schemas.md
- docs/kids-brain-v1/implementation/phase-2-perception-layer.md
- docs/kids-brain-v1/implementation/phase-3-classification-engine.md

Existing implementation:

- backend/src/kids-brain/
- backend/src/kids-brain/perception/
- backend/src/kids-brain/classification/

## Goal

Implement the State Engine only.

The State Engine consumes:

- SessionMemory
- PerceptionBundle
- ResponseClassificationResult
- current activity context

and returns an updated immutable SessionMemory plus a StateUpdateSummary.

This phase updates internal child/session/item state.

It must NOT decide learning progression yet.
It must NOT select next activity.
It must NOT generate teacher responses.
It must NOT wire into production runtime.

## Target Directory

Create:

backend/src/kids-brain/state-engine/

## Create Files

backend/src/kids-brain/state-engine/
- index.ts
- state-engine-types.ts
- state-update-result.ts
- child-state-updater.ts
- item-state-updater.ts
- recovery-state-updater.ts
- engagement-updater.ts
- confidence-updater.ts
- cost-counter-updater.ts
- turn-history-updater.ts
- session-memory-updater.ts
- state-engine.ts

backend/src/kids-brain/state-engine/__tests__/
- state-engine.test.ts

## Strict Boundaries

Do NOT:
- modify adult runtime
- modify frontend
- modify WebSocket
- implement learning engine
- implement activity selection
- implement teacher response generation
- implement Redis/Postgres adapters
- call LLMs
- call STT providers
- implement TTS
- wire into production runtime
- modify existing kids prototype runtime

## Required Behavior

Implement pure deterministic state update functions.

All state updates must be:

- immutable
- deterministic
- testable
- backend-authoritative

No function should mutate the input SessionMemory object directly.

## Input Contract

State engine input:

- sessionMemory
- perceptionBundle
- classificationResult
- currentActivityContext
- timestamp

## Output Contract

State engine output:

- updatedSessionMemory
- stateUpdateSummary
- appliedUpdates
- triggeredRecoveryChange
- costCounterDelta
- masteryEligibility
- progressionEligibility
- logsToEmit

## StateUpdateSummary

Create StateUpdateSummary with:

- turnNumber
- previousRecoveryState
- newRecoveryState
- previousEngagementLevel
- newEngagementLevel
- confidenceDeltas
- itemStateDeltas
- costCounterDeltas
- recentSuccessCountDelta
- recentFailureCountDelta
- shouldEnterRecovery
- shouldExitRecovery
- safeToContinue
- createdAt

## Child State Updates

Update child state variables:

- comprehensionConfidence
- productionConfidence
- pronunciationConfidence
- emotionalSafety
- engagementLevel
- frustrationRisk
- recoveryLevel
- activityFatigue
- noveltyNeed
- l1Dependency
- sessionStamina
- recentSuccessCount
- recentFailureCount
- refusalRisk

Use 0–100 engine score scale only.

Use helpers from shared/score.ts.

## Update Rules

Implement conservative first-pass rules:

Correct / near-correct:
- increase relevant confidence
- increase recent success
- reduce frustration risk
- reduce recovery level if active

Wrong / related / partial:
- small confidence decrease or neutral
- increase recovery need
- do not punish harshly
- increase recent failure slightly

Silence:
- do not count as failure by itself
- increase uncertainty
- increase recovery level only if repeated or long

L1 translation:
- comprehension success signal
- production gap signal
- do not count as failure
- increase l1Dependency slightly

I don’t know:
- do not count as failure
- increase recovery need
- preserve emotional safety

Refusal / emotional shutdown:
- increase refusal risk
- increase frustration risk
- reduce session stamina
- force recovery state escalation

Unsafe/sensitive:
- mark safeToContinue=false
- trigger safety close state

Timeout fallback:
- do not update mastery eligibility
- update uncertainty only
- do not punish child

## Item State Updates

Update current item state:

- attempts
- correctAttempts
- promptedCorrectAttempts
- unpromptedCorrectAttempts
- l1Responses
- silenceCount
- lastClassification
- lastSeenAt

Do NOT update persistent MasteryRecord in this phase.

Only update session-scoped ItemState.

## Recovery State Updates

Implement recovery state transitions:

- normal
- mild_confusion
- repeated_failure
- frustration_risk
- disengagement
- refusal
- emotional_shutdown
- repaired_success

Rules:
- recovery escalation happens before teacher response in future phases
- recovery state must be derived from classification + child state
- emotional_shutdown overrides all lower recovery states
- refusal overrides mild confusion
- repaired_success happens after successful response during recovery

## Engagement Updates

Model engagement conservatively.

Do not infer too much from one signal.

Signals:
- repeated correct answers
- repeated silence
- off-topic response
- refusal
- response latency
- input quality
- overexcited classification

Engagement is NOT excitement.

Output should update:
- engagementLevel
- noveltyNeed
- activityFatigue
- sessionStamina

## Confidence Updates

Implement confidence deltas from classification labels.

Use named constants.

Do not hardcode magic numbers inline.

Confidence must never drop too sharply from one wrong answer.

Wrong answers should usually trigger scaffolding later, not punishment.

## Cost Counters

Update session cost counters only from provided deltas/context.

Track:
- sttSeconds
- llmClassificationCalls
- llmTeacherCalls
- ttsCharacters
- turnCount

Do not enforce caps yet.
Just update counters.

Cap enforcement belongs to later runtime orchestration.

## Turn History

Append a TurnRecord summary.

Do not store raw audio.

Keep recentTurns bounded.

Default max recent turns: 10.

## Logging

Add typed log events if missing:

- state_update_started
- state_update_completed
- child_state_changed
- item_state_changed
- recovery_state_changed
- engagement_changed
- confidence_changed
- safe_to_continue_false

## Tests

Add tests for:

1. correct_confident increases confidence and success count
2. correct_hesitant increases confidence less than confident
3. near_correct does not punish child
4. wrong_semantic increases recovery need gently
5. silence_short does not count as failure
6. silence_long escalates recovery if repeated
7. l1_translation increases comprehension signal but not production mastery
8. i_dont_know preserves emotional safety
9. refusal escalates recovery state
10. emotional_shutdown overrides other states
11. unsafe_or_sensitive sets safeToContinue=false
12. timeout_fallback does not allow mastery eligibility
13. item attempts increment correctly
14. recentTurns is capped at 10
15. input SessionMemory is not mutated
16. recovery repaired_success after correct response in recovery
17. cost counters update from context
18. no learning progression is selected
19. no teacher response is generated
20. no adult Obsidian imports
21. exported from backend/src/kids-brain/index.ts

## Acceptance Criteria

- state-engine module exists
- child state updates work
- item state updates work
- recovery state updates work
- engagement updates work
- confidence updates work
- recent turn history works
- no mastery persistence
- no progression selection
- no teacher response generation
- no production runtime wiring
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
5. conflicts with Approved Spec or Patch 1.1
6. deviations from this phase file