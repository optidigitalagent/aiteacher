# Mentium Kids Brain v1 — Phase 2: Perception Layer

## Source of Truth

Read first:

- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-spec.md
- docs/kids-brain-v1/architecture/mentium-kids-brain-v1-patch-1.1.md
- docs/kids-brain-v1/implementation/phase-1-contracts-and-schemas.md

Phase 1 is already implemented in:

- backend/src/kids-brain/

## Goal

Implement the Perception Layer only.

The Perception Layer converts raw child input signals into a normalized PerceptionBundle for later classification.

This phase does NOT classify child responses yet.

## Target Directory

Create:

backend/src/kids-brain/perception/

## Create Files

backend/src/kids-brain/perception/
- index.ts
- perception-types.ts
- perception-bundle.ts
- stt-normalizer.ts
- latency-analyzer.ts
- silence-analyzer.ts
- l1-detector.ts
- input-quality.ts
- perception-builder.ts
- perception-constants.ts

backend/src/kids-brain/perception/__tests__/
- perception-layer.test.ts

## Strict Boundaries

Do NOT:
- modify adult runtime
- modify frontend
- modify WebSocket
- implement classification engine
- implement learning engine
- implement teacher response generation
- implement Redis/Postgres adapters
- import Google/Chirp SDKs
- call LLMs
- call STT providers directly
- wire into production runtime

## Required Behavior

Implement normalized perception logic using only existing Phase 1 contracts.

The Perception Layer must accept:
- STTResult
- current SessionMemory
- current TurnRecord context if available
- prompt/activity context
- timing metadata

It must output:
- PerceptionBundle

PerceptionBundle should include:
- normalizedTranscript
- rawTranscript
- transcriptAvailable
- sttConfidence
- adjustedSttConfidence
- sttConfidenceMissing
- alternatives
- detectedLanguageHints
- l1Detected
- l1ScriptDetected
- l1KeywordDetected
- responseLatencyMs
- silenceDurationMs
- isShortSilence
- isLongSilence
- isNoResponse
- inputQuality
- uncertaintyReasons
- safeForDeterministicClassification
- requiresLLMAssistedClassification
- createdAt

## STT Normalization

Implement safe handling for missing/null STT fields.

Rules:
- missing transcript => transcriptAvailable=false
- empty transcript => transcriptAvailable=false
- missing confidence => sttConfidenceMissing=true
- missing speechDurationMs must not crash
- missing audioEnergyLevel must not crash
- rawProviderPayload must be passed through but never required

Do not assume Google-specific fields beyond normalized STTResult.

## L1 Detection

Implement deterministic L1 detection only.

Support:
- Cyrillic script detection
- small Ukrainian/Russian helper-word list
- obvious L1 phrases:
  - не знаю
  - я не знаю
  - не понимаю
  - что
  - да
  - нет
  - собака
  - кошка
  - лев
  - слон
  - тигр
  - мавпа
  - обезьяна

Do not use LLM for L1 detection.

## Silence Detection

Implement age-aware silence thresholds using constants.

Use age profiles:
- 6–7
- 8–9

Do not treat silence alone as failure.

Silence outputs must distinguish:
- short silence
- long silence
- no response

## Latency Analysis

Detect:
- fast answer
- normal answer
- slow answer
- missing latency

Fast answer must NOT automatically mean guessing.
Only emit signal.

## Input Quality

Compute inputQuality:

- usable
- low_confidence
- empty
- noisy
- missing

Low STT confidence should increase uncertainty, not punish the child.

## Uncertainty Handling

If perception confidence is low:
- add uncertainty reason
- set safeForDeterministicClassification=false
- set requiresLLMAssistedClassification=true

But do not classify yet.

## Logging

Add typed log events if missing:
- perception_started
- perception_completed
- stt_confidence_missing
- l1_detected
- silence_detected
- low_input_quality

Do not log raw sensitive data beyond approved normalized text.

## Tests

Add tests for:

1. normal English transcript
2. missing STT confidence
3. empty transcript
4. Cyrillic L1 detection
5. Ukrainian/Russian helper phrase detection
6. short silence
7. long silence
8. no response
9. fast answer signal
10. low STT confidence creates uncertainty
11. missing optional STT fields do not crash
12. no LLM imports
13. no adult Obsidian imports
14. exported from backend/src/kids-brain/index.ts

## Acceptance Criteria

- perception module exists
- PerceptionBundle type exists
- STTResult is normalized safely
- L1 detection works deterministically
- silence analysis works
- latency signals work
- uncertainty reasons are explicit
- no classification logic implemented
- no production runtime wiring
- TypeScript passes
- tests pass
- adult runtime unchanged

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
5. conflicts with Approved Spec or Patch 1.1
6. deviations from this phase file