# Architecture Doctrine — AI Teacher Platform

> This document defines the non-negotiable architectural rules.
> Every engineering decision must be evaluated against these rules.

---

## Core Principle

**The platform is a deterministic, event-driven education engine.**
It is NOT a chatbot. The AI (Claude/GPT) is a language layer only.

---

## The Three Layers

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3 — AI Teacher Brain (Claude / GPT)                  │
│  Role: language, speech, socratic dialogue, encouragement   │
│  Reads: prompt context injected by the engine               │
│  Controls: NOTHING in the system                            │
└─────────────────────────────────────────────────────────────┘
         │ reads prompt context (read-only)
         ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2 — Exercise Engine  (backend/src/engine/)           │
│  Role: exercise state, step progression, validation         │
│  Source of truth: EngineLessonState in Redis                │
│  Controls: what exercise/step is active                     │
└─────────────────────────────────────────────────────────────┘
         │ feeds cursor + state events
         ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — WS/Orchestrator  (backend/src/ws/ + lesson/)     │
│  Role: WebSocket I/O, billing, phase transitions            │
│  Source of truth: LessonState in Redis                      │
│  Controls: lesson lifecycle (phases, billing, reconnect)    │
└─────────────────────────────────────────────────────────────┘
         │ sends ExerciseCursor events
         ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 0 — Frontend (React / WS client)                     │
│  Role: render what the engine sends                         │
│  Controls: NOTHING — only mirrors backend state             │
└─────────────────────────────────────────────────────────────┘
```

---

## Immutable Rules

### Rule 1 — AI never controls progression
The AI teacher NEVER:
- decides which exercise to present
- advances to the next step
- skips or repeats an exercise
- returns exercise structure in its JSON output

The AI teacher ONLY:
- speaks to the student
- gives feedback in natural language
- asks questions based on what the engine told it to ask

### Rule 2 — Exercise Engine is the single source of truth
- `EngineLessonState` in Redis is the authoritative exercise position
- The WS layer calls `engine.submitAnswer()` and `engine.skipCurrent()`
- The AI receives `engine.getPromptContext()` — read-only string

### Rule 3 — Textbook data is backend-authoritative
- Exercise content comes from section manifests (or future DB)
- The AI never generates exercise items or correct answers
- `parseManifestEntry()` is the only way exercise structure enters the engine

### Rule 4 — Frontend is state-driven only
- Frontend renders what `ExerciseCursor` says
- Frontend never calculates which item to show
- Frontend never validates answers — all validation is backend

### Rule 5 — Validation is deterministic first
- Exact/contains/prefix matching runs before any AI call
- AI semantic evaluation (soft_ai) runs only for open-ended tasks
- A wrong answer never silently becomes correct

### Rule 6 — No GPT in the hot path for validation
- Deterministic exercise types (fill_in_the_gap, grammar_drill, matching) use
  exact-match validation only — no OpenAI API call
- This keeps latency < 50ms for these exercise types

---

## Exercise Flow

```
student answer received (WS layer)
        │
        ▼
engine.submitAnswer()
        │
        ├── validateStep()    ← deterministic (exact/contains/prefix)
        │   └── soft AI only for open-ended types
        │
        ├── recordAttempt()   ← immutable state update
        │
        ├── advanceStep()     ← if correct or max retries hit
        │
        └── if exercise complete:
            ├── closeCurrentExercise()
            ├── findNextExercise()
            └── mountNextExercise()
                    │
                    ▼
            returns EngineResult {
              action,           ← 'step_correct' | 'exercise_complete' | etc.
              validation,       ← feedback for AI to speak
              exerciseCursor,   ← sent to frontend
              promptContext,    ← injected into AI system prompt
            }
```

---

## Data Flow Contract

```
Textbook Manifest
    │ parseManifestEntry()
    ▼
ExerciseSpec[] (exerciseQueue)
    │ stored in Redis as EngineLessonState
    ▼
EngineExerciseState (currentExerciseState)
    │
    ├── formatCursor()      →  ExerciseCursor  →  Frontend
    └── buildPromptContext() →  string          →  AI system prompt
```

---

## What the AI sees (prompt context example)

```
=== EXERCISE ENGINE STATE (backend-authoritative) ===
RULE: You are the teacher voice. The engine controls all progression.
RULE: Do NOT invent items, steps, or exercise numbers.

Section: 1.2 | Unit: 1
Exercise: 3 — grammar focus fill
Instruction: "Read the GRAMMAR FOCUS. Then complete the examples."
Progress: step 1 of 3
Status: active
Retries on current step: 0

CURRENT STEP (ask this ONLY):
  Question: "Why ___ you admire him?"

=== END ENGINE STATE ===
```

The AI reads this and says: *"Great! Now look at the grammar focus box.
Why ___ you admire him? What goes in the blank?"*

It does NOT return exercise structure. It does NOT advance the step.
The WS layer calls `engine.submitAnswer()` when the student answers.

---

## File Map

```
backend/src/engine/
  types.ts                  — all engine types (ExerciseSpec, StepSpec, etc.)
  exercise-loader.ts        — loads ExerciseSpec[] from section manifest
  exercise-parser.ts        — ManifestEntry → ExerciseSpec + StepSpec[]
  step-progression-manager.ts — advance/skip/record step state
  validation-hooks.ts       — deterministic + soft AI validation
  frontend-formatter.ts     — EngineExerciseState → ExerciseCursor + promptContext
  exercise-sync.ts          — Redis read/write for EngineLessonState
  exercise-recovery.ts      — reconnect recovery (Redis → manifest rebuild)
  exercise-transitions.ts   — next-exercise rules, dependency checks
  exercise-engine.ts        — public facade (ExerciseEngine class + singleton)
  index.ts                  — all exports
```

---

## Integration Points

### WS Layer → Engine
```typescript
// On student answer:
const result = await exerciseEngine.submitAnswer({ lessonId, studentAnswer })
// result.exerciseCursor → broadcast to frontend
// result.promptContext  → inject into AI system prompt
// result.action        → 'step_correct' | 'exercise_complete' | 'lesson_complete'

// On lesson start:
await exerciseEngine.init(lessonId, sectionId)

// On reconnect:
await exerciseEngine.recover(lessonId, sectionId)

// On skip request:
const result = await exerciseEngine.skipCurrent(lessonId)
```

### AI Prompt Builder → Engine
```typescript
const engineContext = await exerciseEngine.getPromptContext(lessonId)
// inject as a section in the system prompt — see frontend-formatter.ts
```

### Frontend ← Engine
```typescript
// Engine returns ExerciseCursor on every state change:
{
  exerciseId, exerciseNumber, exerciseType, instruction,
  currentItem, itemIndex, itemTotal,
  completedItems, failedItems, items, options
}
```
