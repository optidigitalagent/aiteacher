# Future Architecture Notes

> Observations about architectural evolution. Grounded in current reality — no fantasy.

See also: [[RUNTIME_AUTHORITY_MAP]] · [[AI_TEACHER_DOCTRINE]]

---

## Current State (as of Phase 15)

The architecture is now:
- Backend-authoritative runtime
- Deterministic Exercise Engine
- Slot-based Validation System
- Teacher Brain as verbal-only layer
- Memory System as read-only context

This is the correct architecture. It should not be redesigned.

---

## What Should Evolve

### 1. Grammar Target Tracking

Current: Teacher Brain has no memory of which grammar structures the student has struggled with.
Desired: Memory System records grammar error patterns, provides adjustment context to Teacher Brain.

Not yet implemented. Memory System writes events — Teacher Brain doesn't yet use them for grammar pacing.

---

### 2. Slot Vocabulary Expansion

Current: REASON_MARKERS and PREFERENCE_MARKERS are hardcoded lists.
Desired: Periodically extended based on QA learnings (new informal connectors, regional expressions).

This is a data update, not an architecture change.
New patterns should be validated against existing test cases before adding.

---

### 3. STT Confidence Scoring

Current: All STT output treated equally regardless of confidence.
Desired: Low-confidence transcripts trigger a soft clarification request before validation.

Requires STT provider to expose per-word confidence scores in the final transcript event.

---

### 4. Section-Level Difficulty Adaptation

Current: All students follow identical exercise order and retry limits.
Desired: Memory System adjusts retry thresholds based on student error history.

Prerequisite: Memory System must accumulate enough events to produce reliable patterns.
Risk: Must not affect Exercise Engine cursor — Memory influences Teacher Brain phrasing only.

---

## What Must NOT Change

These architectural decisions are fixed:

| Decision | Reason |
|----------|--------|
| Exercise Engine owns cursor | Any other owner creates state corruption |
| Validation owns correctness | AI-decided correctness is unreliable and unpredictable |
| Teacher Brain is verbal-only | AI exercise control = unpredictable progression |
| Frontend renders backend cursor | UI-inferred state = desync bugs |
| No GPT-controlled progression | This was explicitly reversed — see Phase 14 history |

---

## Anti-Patterns to Never Reintroduce

- Multi-agent orchestration (CrewAI-style)
- GPT-controlled lesson progression
- Frontend-inferred exercise state
- LLM-based correctness decisions
- Listening content reconstruction from text description
- AI-adapted exercise formats for unsupported exercises
