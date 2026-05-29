# Mentium Kids Brain v1 — Phase 3: Response Classification Engine

## Source of Truth

Read first:

- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-spec.md
- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-patch-1.1.md
- docs/kids-brain-v1/implementation/phase-1-contracts-and-schemas.md
- docs/kids-brain-v1/implementation/phase-2-perception-layer.md

Existing implementation:

- backend/src/kids-brain/
- backend/src/kids-brain/perception/

## Goal

Implement the Response Classification Engine only.

The Classification Engine consumes a PerceptionBundle and context, then emits a ResponseClassificationResult.

This phase must classify child responses but must NOT update child state, decide progression, generate teacher responses, or modify runtime wiring.

## Target Directory

Create:

backend/src/kids-brain/classification/

## Create Files

backend/src/kids-brain/classification/
- index.ts
- classification-types.ts
- classification-result.ts
- classification-constants.ts
- deterministic-classifier.ts
- semantic-matcher.ts
- phonetic-matcher.ts
- llm-classifier-contract.ts
- timeout-fallback.ts
- classification-router.ts

backend/src/kids-brain/classification/__tests__/
- classification-engine.test.ts

## Strict Boundaries

Do NOT:
- modify adult runtime
- modify frontend
- modify WebSocket
- implement state updates
- implement learning engine
- implement teacher response generation
- implement Redis/Postgres adapters
- call real LLMs
- call STT providers
- wire into production runtime
- modify existing kids prototype runtime

## Required Input

Classification must accept:

- PerceptionBundle
- current activity context
- current target item
- recent TurnRecord[]
- age profile
- optional item vocabulary context
- optional LLM classifier interface

## Required Output

Create ResponseClassificationResult with:

- label
- confidence
- source
- reasons
- perceptionSummary
- matchedTargetItemId optional
- matchedText optional
- requiresRecovery
- eligibleForMasteryUpdate
- eligibleForProgression
- recommendedSafeAction
- createdAt

## Required Labels

Support these labels:

- correct_confident
- correct_hesitant
- near_correct
- pronunciation_variant
- partial_answer
- repeated_after_model
- wrong_semantic
- wrong_but_related
- random_nonsense
- playful_nonsense
- avoidance_nonsense
- silence_short
- silence_long
- no_response
- l1_translation
- l1_help_request
- l1_refusal
- code_switch
- i_dont_know
- refusal
- distraction
- overexcited
- emotional_shutdown
- off_topic_story
- test_the_ai
- unsafe_or_sensitive
- unknown_uncertain

## Deterministic Classification Rules

Implement deterministic fast-path rules for:

1. no response
2. short silence
3. long silence
4. Cyrillic/L1 translation
5. L1 help request
6. L1 refusal
7. exact target match
8. near target match using edit distance
9. repeated after model
10. obvious “I don’t know”
11. simple refusal
12. unsafe/sensitive keyword detection

Do not use LLM for these.

## LLM-Assisted Classification Contract

Define interface only:

LLMClassifier:
- classify(input): Promise<LLMClassificationResult>

Do not implement real LLM calls.

LLM may only be used for ambiguous cases:
- playful_nonsense vs random_nonsense
- avoidance_nonsense vs confusion
- off_topic_story
- test_the_ai
- wrong_but_related
- code_switch ambiguity

Backend deterministic rules must override LLM when confidence is high.

## Timeout Fallback

Implement Patch 1.1 timeout fallback.

If LLM classifier exceeds 400ms:
- emit deterministic fallback label
- set source="timeout_fallback"
- set confidence according to Patch 1.1
- do not allow mastery update
- log classification_timeout_fallback

Use first-match fallback order from Patch 1.1.

If exact Patch fallback table is not available in code comments/spec, implement conservative fallback:

1. unsafe signal => unsafe_or_sensitive
2. no response => no_response
3. long silence => silence_long
4. short silence => silence_short
5. L1 detected => code_switch or l1_translation depending context
6. low input quality => unknown_uncertain
7. default => unknown_uncertain

## Semantic / Phonetic Matching

Implement simple deterministic helpers only:

- normalizeText()
- editDistance()
- isNearMatch()
- isExactMatch()
- isWrongButRelated()

Do not add external dependencies unless already present.

For Phase 3:
- phonetic matcher may be simple placeholder logic with tests
- semantic matcher may use provided vocabulary groups/context only
- no embeddings
- no LLM semantic matching

## Classification Source

Support sources:

- deterministic
- llm_assisted
- timeout_fallback
- safety_override

## Safety

Unsafe/sensitive classification must override all other labels.

Do not generate teacher response.

Do not store raw sensitive data beyond classification result.

## Mastery/Progression Eligibility

Classification result must set:

eligibleForMasteryUpdate:
- true only for correct_confident, correct_hesitant, near_correct, pronunciation_variant when deterministic confidence is sufficient
- false for timeout_fallback
- false for low confidence
- false for L1-only response
- false for nonsense/refusal/silence

eligibleForProgression:
- true only for safe correct/near-correct labels
- false for recovery labels

Do not update mastery here.

## Logging

Add typed log events if missing:

- classification_started
- classification_completed
- classification_timeout_fallback
- llm_classifier_requested
- safety_classification_override

## Tests

Add tests for:

1. exact correct target => correct_confident
2. hesitant correct with slow latency => correct_hesitant
3. near match => near_correct
4. repeated after model => repeated_after_model
5. wrong but related vocabulary => wrong_but_related
6. random nonsense => random_nonsense or unknown_uncertain
7. playful nonsense requires LLM assistance if ambiguous
8. no response => no_response
9. short silence => silence_short
10. long silence => silence_long
11. “I don’t know” => i_dont_know
12. Russian/Ukrainian target translation => l1_translation
13. Russian/Ukrainian help request => l1_help_request
14. refusal => refusal
15. unsafe keyword => unsafe_or_sensitive and safety_override
16. LLM timeout fallback returns safe label
17. timeout fallback never allows mastery update
18. low input quality returns unknown_uncertain
19. no real LLM imports
20. no adult Obsidian imports
21. exported from backend/src/kids-brain/index.ts

## Acceptance Criteria

- classification module exists
- ResponseClassificationResult exists
- deterministic classifier works
- timeout fallback works
- LLM classifier is interface-only
- no real LLM calls
- no state updates
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