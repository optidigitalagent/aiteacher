# Runtime Authority Map

> Defines who owns what in the AI Teacher runtime. Violations cause state corruption.

See also: [[AI_TEACHER_DOCTRINE]] · [[VOICE_RUNTIME_ARCHITECTURE]] · [[KNOWN_RUNTIME_FAILURES]]

---

## System Map

```
PostgreSQL
└── Persistent source of truth: lesson state, exercise history, billing

Redis (TTL: 4 hours)
└── Short-lived session state: soft-speaking attempts, runtime snapshots

Exercise Engine
└── ExerciseCursor: exerciseIndex, itemIndex, completedItems, completedExercises
└── Exercise manifest: textbook-parsed, backend-authoritative
└── Skip classification: engine decides if exercise is unsupported
└── Progression: advances only on validator allowProgression=true

Validation System
└── Correctness gate: allowProgression (boolean)
└── Per-type validators: deterministic, matching, soft-speaking
└── Soft-speaking slot detection: deterministic, no LLM
└── Correction turn: A/B/C/D tracked in backend state

Master Lesson Orchestrator
└── Coordinates: Exercise Engine ↔ Validation ↔ Teacher Brain ↔ Memory
└── Owns: answer routing, voice answer routing, session recovery
└── Voice answer path: tryManifestValidateVoice()

Teacher Brain
└── Verbal-only: reads engine state, produces speech text
└── Cannot: advance cursor, decide correctness, mark completion
└── Isolation layer: strips AI exercise control fields from output
└── Action contract: 12 allowed actions, 9 forbidden actions

Frontend
└── Renders: backend cursor state only
└── Cannot: infer correctness, infer next exercise, parse teacher text for state
└── Cursor update: received via WebSocket event from backend

Memory System
└── Reads: validation events, exercise events, lesson events
└── Writes: fail-soft — never blocks lesson progression
└── Provides: explanation style context to Teacher Brain only
```

---

## Authority Rules (Canonical)

| Capability | Owner | What AI May Not Do |
|-----------|-------|-------------------|
| Exercise cursor position | Exercise Engine | AI cannot advance or retreat cursor |
| Item ordering | Exercise Engine | AI cannot reorder items |
| Exercise completion | Exercise Engine + Validation | AI cannot mark exercise complete |
| Correctness decision | Validation System | AI cannot override allowProgression |
| Correction turn (A/B/C/D) | Backend state | AI cannot re-derive from conversation |
| Skip classification | Exercise Engine | AI cannot self-classify as unsupported |
| Lesson completion | Master Orchestrator | AI cannot finalize billing |
| Exercise numbering | Engine STATE block | AI cannot invent or guess numbers |
| Frontend state | Backend WebSocket events | Frontend cannot parse AI text for state |

---

## Data Flow

```
Student input (voice or text)
    ↓
Master Lesson Orchestrator
    ↓
Exercise Engine (cursor lookup)
    ↓
Validation System (correctness gate)
    ↓
Updated cursor + result → Frontend (WebSocket)
    ↓
Teacher Brain (reads updated cursor)
    ↓
Verbal response → TTS → student
    ↓
Memory System (fail-soft write)
```

**The incorrect flow (never implement):**
```
Student input → AI decides correctness → frontend guesses state → backend reconciles
```

---

## Redis TTL Contract

Every lesson key in Redis must have TTL `EX 14400` (4 hours).
Soft-speaking attempt counter: `ss_attempts:{lessonId}:{exerciseId}` — TTL enforced on every write.
Missing TTL = orphaned session state = validation drift.

---

## Teacher Brain Isolation Layer

The isolation layer in `backend/src/ai/teacher-brain/teacher-brain-isolation.ts` strips:
- Any AI-generated exercise state fields
- Any AI-generated progression signals
- Any AI-generated correctness verdicts

When the engine is active for a lesson, AI output is verbal text only.
The isolation layer is not optional. It cannot be bypassed.

---

## Allowed Teacher Brain Actions

| Action | Backend Effect |
|--------|---------------|
| `present_item` | None — AI verbalizes, engine cursor controls |
| `continue_current_item` | No cursor change |
| `confirm_correct` | Backend advances cursor if validator approved |
| `transition_next_exercise` | Backend validates exercise complete first |
| `skip_exercise` | Backend must have classified as unsupported |
| `complete_lesson` | Backend validates all exercises processed |
| `clarify_item` | No cursor change |
| `request_retry` | No cursor change |
| `complete_item` | Backend marks item in completedItems array |
| `complete_exercise` | Backend validates itemIndex = exerciseItems.length |
| `side_question_answered` | No cursor change; re-anchors to current item |
| `resume_current_item` | No cursor change |

## Forbidden Teacher Brain Actions

| Action | Reason |
|--------|--------|
| `go_back_to_item` | Cursor is unidirectional — backward navigation corrupts state |
| `repeat_completed_exercise` | Hard-closed, cannot re-enter |
| `invent_exercise` | Only textbook exercises from backend context are valid |
| `skip_supported_exercise` | Only backend can initiate skip |
| `reopen_completed_exercise` | Permanently closed |
| `change_exercise_type` | Exercise type set by textbook — immutable |
| `hallucinate_hidden_content` | Content not in context does not exist |
