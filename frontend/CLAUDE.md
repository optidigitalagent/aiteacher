# AI Teacher — Current Architecture Constitution

Read this before coding.

This project is now a backend-authoritative AI tutoring runtime.

The platform is NOT a chatbot.
The platform is NOT GPT-controlled.
The platform is a deterministic educational runtime with an AI Teacher verbal layer.

## Core Architecture

- Textbook Parser creates structured lesson/exercise manifests.
- Exercise Engine owns exercise cursor, item progression, skip logic, and completion.
- Validation System owns correctness and `allowProgression`.
- Master Lesson Orchestrator coordinates runtime events.
- Teacher Brain is verbal-only and read-only.
- Frontend renders backend cursor/state only.
- Voice is an input layer only.
- Memory stores persistent learning context only.
- PostgreSQL is persistent source of truth.
- Redis may be used for short-lived runtime/session state.

## Critical Authority Rules

1. AI/LLM never controls lesson progression.
2. AI/LLM never decides correctness.
3. AI/LLM never chooses next exercise or next item.
4. AI/LLM never marks exercises complete.
5. AI/LLM never generates frontend state.
6. Frontend never infers exercise state from AI text.
7. Backend cursor is the source of truth.
8. Student answers must go through Exercise Engine.
9. Correctness must go through Validation System.
10. Teacher Brain may explain, repair, encourage, and request retry only.
11. Voice transcripts are just input; only final transcript may submit an answer.
12. No AI/STT/TTS may initialize before auth/session/runtime validation.

## Current Runtime Stack

Current deployed runtime includes:

- Textbook Parser
- Exercise Engine
- Answer Validation System
- Runtime Authority Integration
- Teacher Brain Isolation
- Backend Cursor Rendering
- Realtime Voice Runtime Stabilization
- Persistent Memory System
- Master Lesson Orchestrator

Do not replace these systems.
Do not bypass these systems.

## Current Active Work

Current focus:

Runtime + Pedagogical QA stabilization for paid textbook lessons.

Immediate priority:

Fix section 1.2 runtime bugs:

- readiness intent must not complete Exercise 1
- "I'm ready" must start exercise flow, not submit an exercise answer
- soft-speaking exercises must require substantive student answers
- engine phase and orchestrator phase must stay synchronized
- Teacher Brain must use updated cursor after `submitAnswer`
- frontend cursor and teacher speech must match
- incorrect answers must trigger correction + retry
- no stale item repetition after cursor advances

## Required Mental Model

Correct flow:

Student input
→ Master Lesson Orchestrator
→ Exercise Engine
→ Validation System
→ updated cursor/result
→ frontend cursor update
→ Teacher Brain verbal response using same updated cursor
→ memory update fail-soft

Incorrect flow:

Student input
→ AI decides correctness/progression
→ frontend guesses state
→ backend reconciles later

Never implement the incorrect flow.

## Before Editing Runtime Code

Inspect relevant files first:

- `backend/src/ws/lesson-ws.ts`
- `backend/src/lesson/master-orchestrator.ts`
- `backend/src/lesson/orchestrator.ts`
- `backend/src/engine/exercise-engine.ts`
- `backend/src/engine/validation-hooks.ts`
- `backend/src/validation/`
- `backend/src/ai/teacher-brain/`
- `backend/src/ai/claude-handler.ts`
- `backend/src/ai/openai-handler.ts`
- frontend cursor handlers only if UI sync is involved

## Do Not

- Do not redesign Classroom globally.
- Do not rewrite the whole runtime.
- Do not create multi-agent architecture.
- Do not add CrewAI/AutoGPT-style agents.
- Do not bypass Exercise Engine.
- Do not bypass Validation System.
- Do not reintroduce GPT-controlled progression.
- Do not make frontend-only fixes for backend state bugs.
- Do not expose teacher-only answers to frontend.
- Do not store raw audio.
- Do not commit `.env`, audio files, random docs, or QA logs.

## Teacher Brain Rules

Teacher Brain may:

- explain current item
- give short correction
- ask the student to retry
- encourage
- summarize backend-approved completion
- introduce backend-approved next exercise

Teacher Brain must not:

- invent exercise numbers
- invent item numbers
- contradict validation result
- advance lesson
- reveal answers too early
- complete exercises
- talk about an old cursor after backend advanced
- reference frontend UI as authority

## Frontend Rules

Frontend must:

- render backend cursor
- render active exercise/item from backend state
- show validation feedback from backend result
- disable input during recovery/completion states
- treat teacher messages as speech only

Frontend must not:

- parse teacher text for state
- infer correctness
- infer next exercise
- auto-complete exercise
- hide cursor desync bugs with UI-only patches

## Voice Rules

Voice runtime must:

- treat partial transcripts as UI preview only
- submit only final transcripts
- attach cursor identifiers
- reject stale/duplicate turns
- avoid AI calls for empty/no-text input
- remain synchronized with backend cursor

Voice runtime must not:

- bypass validation
- advance lesson directly
- replay old transcript after reconnect
- use partial transcript as answer

## Memory Rules

Memory is read-only context for Teacher Brain.

Memory may influence:

- explanation style
- pacing
- correction intensity
- encouragement style

Memory must not control:

- progression
- correctness
- exercise selection
- validation
- billing

Memory writes must be fail-soft.

## Deployment Discipline

Always:

```bash
git status
git add <exact files only>
git status
git commit -m "<precise message>"
git push production main
Never use:

git add .

Never commit:

audio/
.env
.env.backup
random docs
QA transcripts
local debug artifacts