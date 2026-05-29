# Mentium Kids Brain v1 — Phase 5: Learning Engine

## Source of Truth

Read first:

- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-spec.md
- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-patch-1.1.md
- docs/kids-brain-v1/implementation/phase-1-contracts-and-schemas.md
- docs/kids-brain-v1/implementation/phase-2-perception-layer.md
- docs/kids-brain-v1/implementation/phase-3-classification-engine.md
- docs/kids-brain-v1/implementation/phase-4-state-engine.md

Primary research source for this phase:

- docs/kids-brain-v1/research/pack 2/learning-engine-overview.md
- docs/kids-brain-v1/research/pack 2/progression-engine.yaml
- docs/kids-brain-v1/research/pack 2/mastery-model.yaml
- docs/kids-brain-v1/research/pack 2/activity-selection-engine.yaml
- docs/kids-brain-v1/research/pack 2/review-and-spacing-engine.yaml
- docs/kids-brain-v1/research/pack 2/lesson-flow-engine.yaml
- docs/kids-brain-v1/research/pack 2/progression-rules.yaml
- docs/kids-brain-v1/research/pack 2/engagement-adaptation-engine.yaml
- docs/kids-brain-v1/research/pack 2/session-completion-engine.yaml

Existing implementation:

- backend/src/kids-brain/
- backend/src/kids-brain/perception/
- backend/src/kids-brain/classification/
- backend/src/kids-brain/state-engine/

## Goal

Implement the Learning Engine only.

The Learning Engine consumes:

- current SessionMemory
- StateEngineOutput
- ResponseClassificationResult
- PerceptionBundle
- current activity context
- curriculum/item context

and returns a deterministic LearningDecision.

The Learning Engine answers:

- stay or advance?
- repeat or scaffold?
- lower or raise difficulty?
- continue item or move to next item?
- trigger review?
- trigger easiest win?
- enter/continue recovery path?
- close session?
- what teacher action type should happen next?

This phase must NOT generate final teacher text.
This phase must NOT call LLMs.
This phase must NOT wire into production runtime.

## Target Directory

Create:

backend/src/kids-brain/learning-engine/

## Create Files

backend/src/kids-brain/learning-engine/
- index.ts
- learning-engine-types.ts
- learning-decision.ts
- learning-constants.ts
- progression-engine.ts
- mastery-engine.ts
- activity-selection-engine.ts
- review-scheduler.ts
- lesson-flow-engine.ts
- engagement-adaptation-engine.ts
- session-completion-engine.ts
- easiest-win-selector.ts
- learning-engine.ts

backend/src/kids-brain/learning-engine/__tests__/
- learning-engine.test.ts

## Strict Boundaries

Do NOT:
- modify adult runtime
- modify frontend
- modify WebSocket
- generate teacher response text
- implement TTS
- implement Redis/Postgres adapters
- call LLMs
- call STT providers
- persist mastery records
- wire into production runtime
- modify existing kids prototype runtime

## Required Input

LearningEngineInput:

- sessionMemory
- stateEngineOutput
- classificationResult
- perceptionBundle
- currentActivityContext
- currentItemContext
- availableActivities
- availableItems
- reviewQueue optional
- timestamp

## Required Output

LearningDecision:

- decisionId
- sessionId
- turnNumber
- decisionType
- nextTeacherActionCode
- nextActivityType
- nextTargetItemId optional
- shouldStayOnCurrentItem
- shouldAdvanceItem
- shouldReview
- shouldTriggerRecovery
- shouldTriggerEasiestWin
- shouldCloseSession
- difficultyDelta
- masteryUpdateCandidate
- reviewScheduleCandidate
- reasons
- priorityRuleFired
- createdAt

## Decision Types

Support:

- stay_current_item
- repeat_current_activity
- scaffold_current_item
- lower_difficulty
- advance_activity
- advance_item
- trigger_review
- trigger_easiest_win
- continue_recovery
- repaired_success
- close_success
- close_safety
- close_timeout
- hold_uncertain

## Priority Order

Implement first-match priority:

1. safety close
2. emotional shutdown close
3. timeout / cap close
4. refusal recovery
5. frustration recovery
6. repeated failure recovery
7. easiest win
8. uncertainty hold
9. review due
10. mastery/progression advance
11. normal practice continuation

## Progression Engine

Implement rules for:

- correct_confident
- correct_hesitant
- near_correct
- repeated_after_model
- partial_answer
- wrong_semantic
- wrong_but_related
- silence_short
- silence_long
- no_response
- l1_translation
- l1_help_request
- i_dont_know
- refusal
- emotional_shutdown
- random_nonsense
- playful_nonsense
- unknown_uncertain
- timeout_fallback source

Progression must be deterministic.

Correct answer does NOT automatically mean mastery.

## Mastery Engine

Implement session-scoped mastery candidate logic only.

Do NOT persist MasteryRecord in Phase 5.

Create MasteryUpdateCandidate with:

- itemId
- itemType
- proposedLevel
- evidence
- eligibleForPersistence
- blockedReasons

Mastery levels:

- emerging
- developing
- secure
- automatic

Rules:
- one correct answer cannot produce secure mastery
- prompted correct cannot produce automatic mastery
- timeout fallback cannot update mastery
- L1-only answer cannot update production mastery
- repeated_after_model is weaker evidence than unprompted correct
- near_correct may support developing but not secure alone

## Activity Selection Engine

Implement activity transitions.

Supported activities:

- listen_and_point
- repeat_after_me
- forced_choice
- supported_production
- sentence_production
- yes_no_comprehension
- tpr_action
- review_loop
- easiest_win
- recovery_prompt
- close_success

Transition examples:

- repeat_after_me + correct_confident → forced_choice or supported_production
- repeat_after_me + correct_hesitant → repeat_after_me or forced_choice
- forced_choice + correct_confident → supported_production
- supported_production + correct_confident → sentence_production
- wrong_semantic x2 → lower_difficulty or recovery_prompt
- silence_long → recovery_prompt
- refusal → recovery_prompt or close_success depending state

No forbidden jump from:
- repeat_after_me directly to sentence_production unless confidence is high and age profile allows it
- recovery_prompt directly to peak challenge
- repeated failure directly to new item without repaired success

## Review Scheduler

Implement review decision candidates.

Review types:

- same_session_review
- next_lesson_review
- weekly_review

In Phase 5:
- compute candidates only
- do not persist schedule

Rules:
- review weak items before closing
- schedule L1 production gaps for next lesson
- schedule near_correct/pronunciation_variant for pronunciation review
- do not overload review in same session

## Lesson Flow Engine

Implement lesson flow decisions:

- warm_up
- introduction
- practice
- consolidation
- close

Rules:
- lesson must never end immediately after failure
- if session must close after failure, insert easiest_win first if safe
- close only after success, neutral safe state, or safety close
- do not introduce new item when frustration is high
- do not introduce new item near session end

## Easiest Win Selector

Implement cold-start-safe easiest win.

If secure/automatic items exist:
- choose easiest mastered item

If no mastered items exist:
- choose current item with strongest recent positive evidence

If no positive evidence exists:
- use scripted guaranteed-success floor:
  - model answer
  - ask repeat-after-me
  - accept close-enough repeat as success

Do not require LLM.

## Engagement Adaptation

Implement deterministic engagement adjustments:

- high activity fatigue → switch activity type
- low engagement + safe state → increase novelty
- high frustration → lower difficulty
- overexcited → use grounding / simple task
- repeated success → increase challenge slightly
- repeated uncertainty → simplify

Engagement is not excitement.

## Session Completion

Implement close decisions:

- close_success
- close_timeout
- close_safety

Rules:
- max duration/caps can request close
- safety close overrides everything
- emotional shutdown may close gently
- normal close requires recent success or easiest win
- if no recent success, trigger easiest_win before close unless unsafe

## Logging

Add typed log events if missing:

- learning_decision_started
- learning_decision_made
- progression_rule_fired
- mastery_candidate_created
- review_candidate_created
- activity_transition_selected
- easiest_win_selected
- session_close_decision

## Tests

Add tests for:

1. correct_confident advances activity, not mastery to secure immediately
2. correct_hesitant repeats or scaffolds
3. repeated_after_model does not create strong mastery
4. near_correct supports developing but not secure alone
5. wrong_semantic x2 lowers difficulty
6. silence_short holds without punishment
7. silence_long triggers recovery
8. l1_translation creates production-gap review candidate
9. i_dont_know triggers scaffold/recovery not punishment
10. refusal triggers recovery or gentle close
11. emotional_shutdown triggers close_safety or emotional close
12. timeout_fallback blocks mastery update
13. easiest win works with mastered items
14. easiest win works cold-start with no mastered items
15. lesson never closes immediately after failure
16. review due can trigger review_loop
17. high fatigue switches activity
18. high frustration lowers difficulty
19. overexcited selects grounding/simple task
20. repeated success increases difficulty slightly
21. no teacher text generated
22. no LLM calls
23. no persistence
24. no adult Obsidian imports
25. exported from backend/src/kids-brain/index.ts

## Acceptance Criteria

- learning-engine module exists
- LearningDecision exists
- progression decisions work
- activity selection works
- mastery candidates work
- review candidates work
- easiest win works including cold start
- session close decisions work
- no teacher text generation
- no persistence
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