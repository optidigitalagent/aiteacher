# Mentium Kids — Cognitive Architecture Overview

## Classification: [A] Established methodology + [B] Engineering inference

---

## 1. What This Document Is

This document defines the cognitive runtime of the Mentium Kids AI teacher. It is not a lesson plan, curriculum document, or UI specification. It describes the computational brain: how the system receives child input, interprets it, updates internal state, makes a pedagogical decision, and produces a teacher response.

---

## 2. The Full Loop

```
CHILD SPEECH / SILENCE
       ↓
[PERCEPTION LAYER]
  - STT normalization
  - Latency measurement
  - Silence detection
  - L1 detection
  - Context assembly
       ↓
[RESPONSE CLASSIFIER]
  - Deterministic rule pass (fast, cheap)
  - LLM-assisted pass (ambiguous cases only)
  - Classification label + confidence score
       ↓
[STATE UPDATER]
  - Apply classification to child state model
  - Update comprehension, production, emotional safety, engagement
  - Decay/boost variables
       ↓
[DECISION ENGINE]
  - Read child state
  - Apply priority rules
  - Select teacher action
  - Guard: check forbidden states
       ↓
[RESPONSE GENERATOR]
  - Deterministic template (fast-track)
  - LLM-generated phrasing (constrained)
  - TTS output
       ↓
[MEMORY UPDATER]
  - Session memory update
  - Profile delta write
  - Logging event emit
       ↓
  Wait for next child turn
```

Every layer has a defined owner: the **backend is authoritative**. The frontend renders what it receives. No cognitive decision happens client-side.

---

## 3. What Must Be Deterministic

These decisions must be executed by deterministic backend rules without LLM involvement:

| Rule | Reason |
|------|--------|
| Silence threshold detection | Latency is measurable; LLM cannot know real silence |
| L1 language detection | Pattern match against L1 vocabulary list |
| Repeated failure counter | Pure counter logic |
| Recovery state transitions | Defined state machine |
| Session end trigger | Timer + stamina model |
| Unsafe/sensitive content flag | Pattern match; never LLM-only |
| `correct_confident` in closed vocabulary tasks | If STT output matches target with high STT confidence |
| `no_response` / `silence_long` | Purely time-based |
| Praise suppression (fake praise guard) | Counter-based: if recent_success_count > threshold, suppress effusive praise |

[A] Deterministic rules for safety-critical and measurable conditions are standard in robust educational systems.

---

## 4. What May Be LLM-Assisted

The LLM may assist classification **only for ambiguous semantic content** where rules are insufficient:

| Case | Why LLM helps |
|------|---------------|
| `wrong_but_related` vs `random_nonsense` | Semantic proximity requires understanding |
| `off_topic_story` vs `test_the_ai` | Requires discourse analysis |
| `playful_nonsense` vs `avoidance_nonsense` | Intent inference |
| `i_dont_know` in paraphrased form | "Dunno", "maybe?", "what?" |
| `code_switch` with partial English | Mixed utterance requires parsing |

**LLM classification must always**:
- Return a label from the defined taxonomy (no free labels)
- Return a confidence score 0.0–1.0
- Return within timeout budget (200ms target, 400ms hard cap)
- Be overridable by a deterministic rule if one applies

[B] LLM-assisted classification for ambiguous child responses is a strong inference; exact thresholds require empirical validation.

---

## 5. What Must Never Be Left to the LLM

| Forbidden LLM Responsibility | Reason |
|------------------------------|--------|
| Deciding whether a session ends | Safety and cost |
| Detecting unsafe/sensitive content as sole arbiter | Pattern rules must catch first |
| Generating teacher praise without style constraints | Praise inflation, cultural mismatch |
| Storing or summarizing private child speech | Privacy |
| Deciding confidence levels for the child | Must be state model, not LLM opinion |
| Generating content that wasn't reviewed | Safety for under-10 users |
| Choosing curriculum progression | Backend authority |

---

## 6. Backend Authority Model

```
Backend owns:
  - Child state model (canonical)
  - Recovery state machine (canonical)
  - Classification labels (LLM may suggest, backend confirms)
  - Activity selection and progression
  - Memory read/write
  - Session lifecycle

Frontend owns:
  - Rendering
  - Audio I/O
  - Animation triggers (driven by backend events)
  - Nothing pedagogical
```

The backend sends the frontend an **action packet**:
```json
{
  "action": "praise_then_repeat",
  "teacher_text": "...",
  "character_animation": "happy_dance",
  "wait_ms": 3000,
  "next_prompt": "..."
}
```

The frontend executes it without interpretation.

---

## 7. How This Brain Differs from a Chatbot

| Chatbot | Mentium Kids Brain |
|---------|--------------------|
| Responds to what was said | Responds to what was probably meant |
| No persistent child model | Maintains child state across turns |
| LLM drives all decisions | LLM is one tool among many |
| No emotional safety layer | Emotional safety is priority 1 |
| No curriculum intent | All decisions serve a learning goal |
| Stateless between turns | Every turn updates and reads state |
| Accepts any input | Classifies every input against taxonomy |

---

## 8. How This Brain Differs from Adult Obsidian Brain

The adult Obsidian brain (if applicable) likely:
- Handles complex reasoning chains
- Assumes high language proficiency
- Has wide LLM latitude
- Has low emotional safety constraints
- Has long context windows

Mentium Kids brain:
- Minimizes LLM calls (cost, safety, latency)
- Assumes near-zero English proficiency at session start
- Has hard emotional safety constraints as priority 1
- Has very short context per turn
- Relies on deterministic state machines for most decisions
- Never infers strong negative emotional states from speech alone
- Guards against shame, failure framing, and pressure

---

## 9. Child Confidence Protection

The architecture protects child confidence through structural guarantees:

1. **No punishment path exists in the decision tree.** There is no action labeled "wrong" or "try harder."
2. **Every wrong answer has a safe recovery branch.**
3. **Silence is never classified as failure.** It triggers scaffolding, not correction.
4. **The system cannot distinguish "truly wrong" from "production difficulty" without strong signals.** When uncertain, it scaffolds.
5. **Praise is calibrated.** Excessive praise on trivial tasks is suppressed after N consecutive successes to prevent hollow inflation.
6. **L1 responses are treated as comprehension success + production gap**, not failure.
7. **The child cannot "break" the session.** Every classifier output leads to a valid, warm teacher response.

---

## 10. Architecture Principles Summary

| Principle | Implementation |
|-----------|----------------|
| Backend authority | State model lives on server only |
| LLM as assistant | LLM classifies ambiguous only; rules override |
| Safety first | Priority 1 in decision engine, checked before curriculum |
| Uncertainty defaults to safety | Low-confidence → safest action |
| No shame | No "wrong" action in decision tree |
| Cost control | Deterministic path for 70%+ of turns |
| Graceful degradation | Missing signals have defined fallbacks |
| Age differentiation | Profile loaded per child age band |
| Private by design | LLM never receives raw transcripts or private data |
