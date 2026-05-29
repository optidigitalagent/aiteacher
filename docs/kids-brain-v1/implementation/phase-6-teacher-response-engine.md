# Mentium Kids Brain v1 — Phase 6: Teacher Response Engine

## Source of Truth

Read first:

- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-spec.md
- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-patch-1.1.md
- docs/kids-brain-v1/implementation/phase-1-contracts-and-schemas.md
- docs/kids-brain-v1/implementation/phase-2-perception-layer.md
- docs/kids-brain-v1/implementation/phase-3-classification-engine.md
- docs/kids-brain-v1/implementation/phase-4-state-engine.md
- docs/kids-brain-v1/implementation/phase-5-learning-engine.md

Primary research sources:

- docs/kids-brain-v1/core/teacher-policy.md
- docs/kids-brain-v1/core/dialogue-rules.yaml
- docs/kids-brain-v1/core/immersion-engine.yaml
- docs/kids-brain-v1/core/recovery-engine.yaml
- docs/kids-brain-v1/research/pack3/teacher-methodology-playbook.md
- docs/kids-brain-v1/research/pack3/activity-library.yaml
- docs/kids-brain-v1/research/pack3/kids-brain-rules.yaml
- docs/kids-brain-v1/research/pack3/sample-lesson-transcripts.md

Existing implementation:

- backend/src/kids-brain/
- backend/src/kids-brain/perception/
- backend/src/kids-brain/classification/
- backend/src/kids-brain/state-engine/
- backend/src/kids-brain/learning-engine/

## Goal

Implement the Teacher Response Engine only.

The Teacher Response Engine consumes:

- LearningDecision
- StateEngineOutput
- ResponseClassificationResult
- PerceptionBundle
- SessionMemory
- current activity/item context

and returns a TeacherResponsePlan.

It decides how the teacher should speak pedagogically.

This phase must NOT wire into production WebSocket.
This phase must NOT call real LLM APIs.
This phase must NOT generate audio/TTS.
This phase must NOT persist data.

## Target Directory

Create:

backend/src/kids-brain/teacher-response/

Note: core-teacher-vocabulary.ts already exists. Preserve it.

## Create Files

backend/src/kids-brain/teacher-response/
- index.ts
- teacher-response-types.ts
- teacher-response-plan.ts
- teacher-response-constants.ts
- response-template-bank.ts
- fast-track-reactions.ts
- recovery-response-builder.ts
- scaffold-response-builder.ts
- activity-prompt-builder.ts
- teacher-language-policy.ts
- vocabulary-guard.ts
- placeholder-guard.ts
- llm-teacher-contract.ts
- teacher-response-router.ts
- teacher-response-engine.ts

backend/src/kids-brain/teacher-response/__tests__/
- teacher-response-engine.test.ts

## Strict Boundaries

Do NOT:
- modify adult runtime
- modify frontend
- modify WebSocket
- call real LLM APIs
- generate TTS/audio
- implement TTS provider
- implement Redis/Postgres adapters
- persist data
- wire into production runtime
- modify existing kids prototype runtime

## Required Output

TeacherResponsePlan:

- responseId
- sessionId
- turnNumber
- teacherActionCode
- responseMode
- fastTrackText optional
- mainText
- fallbackText
- allowedVocabularyUsed
- blockedVocabulary
- placeholdersRemoved
- requiresLLM
- llmPrompt optional
- safetyBlocked
- emotionalTone
- estimatedTtsCharacters
- createdAt

## Response Modes

Support:

- scripted
- template
- llm_assisted
- recovery_script
- safety_close
- fallback_safe

## Teacher Rules

Teacher response must be:

- short
- English-first
- age-appropriate
- emotionally safe
- no grammar lectures
- no shame
- no “wrong”
- no long explanations
- no translation-first behavior
- no unresolved placeholders

Default max teacher text:

- age 6–7: 1 sentence, max 12 words
- age 8–9: 1–2 sentences, max 18 words

## Fast-Track Reactions

Implement instant scripted reactions:

- correct: “Yes!”
- effort: “Ooh, good try!”
- recovery: “It’s okay!”
- success_after_recovery: “You did it!”
- safety/close: calm neutral response

Fast-track reaction must be independent of LLM.

## Template Bank

Implement safe template banks for:

- greeting
- correct answer
- hesitant correct
- near correct
- wrong but safe
- repeat after me
- forced choice
- supported production
- recovery prompt
- easiest win
- L1 rescue
- silence rescue
- refusal recovery
- close success
- safety close

Templates must not contain unresolved placeholders after rendering.

## Placeholder Guard

Implement final guard:

If output contains:

- `{`
- `}`
- `[target]`
- `{{`
- `}}`
- undefined
- null

then replace with safe fallback text.

No teacher response may contain unresolved placeholders.

## Vocabulary Guard

Use:

- CORE_TEACHER_VOCABULARY_SET
- current target words
- review words
- character names
- allowed activity words

If teacher output contains disallowed words:

- block or replace with fallback safe phrase
- log vocabulary_guard_blocked

Do not silently pass disallowed text.

## LLM Teacher Contract

Define interface only:

LLMTeacherResponder:
- buildResponse(input): Promise<LLMTeacherResponse>

Do not implement real LLM calls.

LLM may be used only for:
- mild personalization
- story continuity
- non-critical wording variation

LLM must NOT own:

- safety
- recovery state
- progression
- mastery
- activity choice
- whether to close session

All LLM output must pass:
1. placeholder guard
2. vocabulary guard
3. length guard
4. forbidden phrase guard

## Forbidden Phrases

Block or replace:

- wrong
- incorrect
- no, that is wrong
- try harder
- pay attention
- you failed
- this is easy
- why don’t you know
- grammar explanations
- long metalinguistic explanations

## Recovery Responses

Build deterministic recovery responses for:

- silence_short
- silence_long
- no_response
- wrong_semantic
- repeated failure
- l1_translation
- l1_help_request
- i_dont_know
- refusal
- emotional_shutdown
- unsafe_or_sensitive

Recovery must prioritize:
1. emotional safety
2. comprehension
3. production
4. progression

## Activity Prompt Builder

Build teacher prompts for:

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

No activity prompt should require visual UI unless it includes a non-visual fallback.

Example:
Bad:
“Look at the picture. What is it?”

Good:
“Listen! Cat. Say: cat.”

## Scaffold Response Builder

Support scaffold levels:

1. repeat slower
2. simplify
3. forced choice
4. model answer
5. ask child to repeat
6. one-word L1 anchor only if budget allows

Do not use L1 by default.

## Safety Close

If safetyBlocked=true or safeToContinue=false:

- do not continue lesson
- produce calm scripted close
- no LLM
- no open-ended questioning

## Logging

Add typed log events if missing:

- teacher_response_started
- teacher_response_built
- teacher_response_fallback_used
- placeholder_guard_triggered
- vocabulary_guard_blocked
- forbidden_phrase_blocked
- llm_teacher_requested
- safety_close_response_built

## Tests

Add tests for:

1. correct answer builds short praise
2. near correct builds recast without shame
3. wrong answer never says “wrong”
4. repeat_after_me prompt works
5. forced_choice prompt includes target context
6. silence_short builds gentle rescue
7. silence_long builds stronger rescue
8. l1_translation builds production scaffold, not failure
9. i_dont_know preserves emotional safety
10. refusal reduces demand
11. emotional_shutdown builds close/comfort response
12. unsafe_or_sensitive builds safety close
13. easiest_win builds guaranteed success prompt
14. placeholder guard removes `{target}`
15. placeholder guard blocks undefined/null
16. vocabulary guard blocks disallowed words
17. forbidden phrase guard blocks “wrong”
18. LLM contract is interface-only
19. LLM output must pass guards
20. max length enforced for age 6–7
21. max length enforced for age 8–9
22. no teacher text generated from LLM without guard
23. no real LLM imports
24. no TTS imports
25. no adult Obsidian imports
26. exported from backend/src/kids-brain/index.ts

## Acceptance Criteria

- teacher-response module exists
- TeacherResponsePlan exists
- scripted/template responses work
- recovery responses work
- activity prompts work
- vocabulary guard works
- placeholder guard works
- forbidden phrase guard works
- LLM contract is interface-only
- no real LLM calls
- no TTS
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