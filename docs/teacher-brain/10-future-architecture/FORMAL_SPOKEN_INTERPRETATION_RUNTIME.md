# Formal Spoken Answer Interpretation Runtime

> Phase B architecture. Raw transcript is NOT an answer. Interpretation precedes validation.

See also: [[SOFT_SPEAKING_PROTOCOL]] · [[STT_NOISE_PATTERNS]] · [[SELF_CORRECTION_PATTERNS]] · [[RUNTIME_AUTHORITY_MAP]]

---

## Core Doctrine

**Raw STT transcript is not an answer. It is input.**

The pipeline is:

```
raw STT transcript
→ transcript normalization
→ utterance segmentation
→ self-correction resolution
→ clause extraction
→ slot extraction
→ canonicalAnswer (for grammar_fill)
→ SpokenInterpretationResult
→ Validation (slot gate → allowProgression)
→ Teacher Brain (interpreted meaning → verbal response)
```

Validation and progression decisions are made on the **interpreted** answer, not the raw transcript.

---

## Why This Exists

Before Phase B, the flow was:

```
raw transcript → regex heuristics → validation/progression
```

This caused:
- False positives (progression when reason slot was missing)
- STT noise treated as answer content
- Teacher responding to raw chaos instead of intended meaning
- Robotic retries for self-correction noise

The critical failure: "Mia Khalifa inspire me." progressed an exercise that required a reason clause.

---

## Authority Rules

This module does NOT:
- Decide allowProgression
- Make AI calls
- Control the Exercise Engine
- Replace the Validation System

This module DOES:
- Formally classify utterance segments into clause types
- Extract required answer slots with evidence
- Detect and resolve self-corrections before slot analysis
- Extract canonicalAnswer for grammar_fill voice answers
- Provide teacherRepairHint for Teacher Brain

---

## Reason Slot Rule

The reason slot is ONLY present when a **causal_clause** or **explanatory_clause** exists.

| Input | Reason present? |
|-------|----------------|
| "Anita inspired me." | NO |
| "Anita inspired me because she worked hard." | YES (causal_clause) |
| "Anita inspired me. She never gave up." | YES (explanatory_clause) |
| "I like Anita." | NO |
| "Anita inspire me." (broken grammar) | NO |

Missing required slots ALWAYS block progression. No override.

---

## Grammar Fill Voice Path

For grammar_fill exercises, voice answers often contain the answer embedded in a sentence.

The interpreter extracts the canonical answer token:
- "What are he doing now?" → canonical = "are" (auxiliary in WH-question)
- "ease. not ease. is." → self-correction resolved → canonical = "is"
- "Have you ever met him?" → canonical = "have" (first word)

The canonical answer is submitted to the Exercise Engine instead of the raw transcript.

---

## Self-Correction Resolution

Student self-corrections are resolved BEFORE slot extraction.

Signal types:
- "I mean X" → extract X
- "not X ... Y" → filter correction fragments, take last non-correction segment
- Repeated words → deduplicate (stutter normalization)

Examples:
- "May inspire Oscar. Not may. Me inspire Oscar." → resolved: "Me inspire Oscar"
- "ease. not ease. is." → resolved: "is"

---

## Teacher Brain Contract

Teacher Brain receives:
- `interpretedMeaning` — what the student likely intended
- `repairPrompt` — exactly what to say
- `issueType` — why validation blocked

Teacher Brain must NOT:
- Use the raw transcript as the authoritative answer
- Invent slot presence from general context
- Progress the exercise without backend allowProgression=true

---

## Implementation

Module: `backend/src/interpretation/`

Files:
- `types.ts` — SpokenInterpretationInput, SpokenInterpretationResult, AnswerSlot, ClauseType
- `transcript-normalizer.ts` — lowercase, dedup stutters, strip punctuation artifacts
- `utterance-segmenter.ts` — split on sentence boundaries
- `self-correction-resolver.ts` — detect and resolve "I mean X", "not X...Y" patterns
- `clause-extractor.ts` — classify clauses: main_statement, causal_clause, explanatory_clause, etc.
- `slot-extractor.ts` — formal slot presence detection per clause type
- `spoken-answer-interpreter.ts` — orchestrates pipeline, grammar_fill canonical, STT entity resolution
- `index.ts` — public API

Integration points:
- `soft-speaking-validator.ts` calls `interpretSpokenAnswer()` before applying pedagogical policy
- `lesson-ws.ts` grammar_fill voice path uses `canonicalAnswer` before engine submission
