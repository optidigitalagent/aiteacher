# Lesson Replay Timeline Design

## Purpose

This document specifies the intended design for lesson replay:
the ability to reconstruct the exact sequence of events in a lesson session
for debugging, QA, and pedagogical review.

Current status: **observability layer implemented**, full replay DB not yet built.
This document is a design spec for the next phase.

---

## Trace Timeline Model

Each lesson produces a single Langfuse trace with a deterministic event sequence:

```
[lesson_start]
  │
  ├─ stt_result              ← student voice/text input received
  │    transcriptPreview, inputMode, turnId
  │
  ├─ spoken_interpretation   ← interpretation pipeline result
  │    exerciseType, canonicalAnswer, issueType, missingSlots
  │
  ├─ validation              ← backend correctness decision
  │    exerciseId, itemIndex, correct, allowProgression, issueType
  │
  ├─ teacher_generation      ← AI Teacher verbal response produced
  │    phase, responseLength
  │
  ├─ progression             ← cursor advance (if occurred)
  │    action, cursorBefore, cursorAfter
  │
  ├─ frontend_sync           ← cursor emitted to frontend
  │    emittedEventType, exerciseId, itemIndex, exerciseType
  │
  ├─ (repeat per turn)
  │
  └─ [lesson_end]
       durationMin, exerciseScore, vocabularyCount, phasesReached, endReason
```

---

## Replay Use Cases

### 1. Teacher Looping Bug
Symptom: Teacher repeats the same item 3 times without progressing.
Replay: Find the validation spans for the affected items.
Check: `allowProgression=false` and `retryRequired=true` on repeat turns?
Check: Did `progression` span ever fire after these validations?
Diagnosis: If validation passes but no `progression` span follows, cursor update was dropped.

### 2. Desync (Frontend shows item N, Teacher speaks item N-1)
Replay: Compare `frontend_sync.itemIndex` vs `teacher_generation.phase`.
Check: Was `exercise_cursor_updated` emitted before the AI call completed?
Diagnosis: Race condition between cursor emit and AI generation.

### 3. Incorrect Correction Ladder
Symptom: Teacher reveals answer on first wrong attempt instead of TURN A.
Replay: Find `validation` span with `correct=false`.
Check: Which `teacher_generation` follows? Does the response length suggest TURN D behavior?
Diagnosis: Correction turn state not preserved between turns.

### 4. Silent STT Failure
Symptom: Student speaks but nothing happens.
Replay: Check if `stt_result` span was emitted after the mic_stop event.
Check: If no `stt_result` followed by `teacher_generation`, the STT result was dropped.
Diagnosis: Deepgram timeout, empty transcript filter, or pendingMicStop race.

---

## Replay DB Schema (Not Yet Implemented)

Future migration will add:

```sql
CREATE TABLE lesson_replay_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     uuid NOT NULL REFERENCES lessons(id),
  session_id    text,
  turn_index    integer NOT NULL,
  event_type    text NOT NULL,       -- 'stt_result' | 'validation' | 'teacher_generation' | ...
  event_data    jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lesson_replay_lesson_id ON lesson_replay_events(lesson_id);
CREATE INDEX lesson_replay_session_id ON lesson_replay_events(session_id);
```

Each row corresponds to one Langfuse span event.
This enables SQL-level querying that the Langfuse API does not support directly.

Migration number: 015 (next after current 014).

---

## Langfuse as Primary Replay Store (Current)

Until the replay DB is built, Langfuse is the primary replay mechanism:

1. Go to Langfuse → Traces
2. Search by lessonId in metadata or by sessionId
3. Open the trace to see the full span tree in chronological order
4. Each span shows input/output/metadata
5. Use Langfuse's timeline view to see event durations

---

## Pedagogical Review Protocol

When a teacher behavior report arrives:
1. Ask for lessonId or sessionId
2. Open the trace in Langfuse
3. Look for the relevant `validation` span (is `allowProgression` correct?)
4. Look for the following `teacher_generation` span (does `responseLength` suggest a full or short response?)
5. Look for `runtime_error` spans (are there unexpected exceptions around the event?)
6. Determine if the issue is in validation, AI generation, or cursor/frontend sync
