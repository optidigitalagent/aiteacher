# Project Roadmap — AI English Teacher MVP

> Claude Code: Check this file at the start of every session.
> Update checkboxes [ ] → [x] as tasks are completed.
> Current active phase is marked with ▶

---

## PHASE 0 — Foundation Setup ▶ ACTIVE
**Goal:** Project runs locally, basic WebSocket works, DB connected.

### Infrastructure
- [ ] Init Node.js + TypeScript backend (`/backend`)
- [ ] Init React + TypeScript frontend (`/frontend`)
- [ ] Setup PostgreSQL with Docker Compose
- [ ] Setup Redis with Docker Compose
- [ ] Create `.env.example` with all required keys:
      `ANTHROPIC_API_KEY, DEEPGRAM_API_KEY, ELEVENLABS_API_KEY,`
      `PINECONE_API_KEY, DATABASE_URL, REDIS_URL`
- [ ] Verify all services connect on `npm run dev`

### Database
- [ ] Run migrations: create tables from @docs/student-model.md
      Tables: `students`, `lessons`, `lesson_events`,
              `exercises`, `vocabulary_items`, `textbook_units`
- [ ] Seed: 1 test student + Focus B1 Unit 13 content (manual)

### WebSocket skeleton
- [ ] Create WS server at `ws://localhost:4000/lesson`
- [ ] Handle events: `lesson:start`, `lesson:message`,
      `lesson:audio`, `lesson:end`
- [ ] Client connects and sends/receives JSON messages

---

## PHASE 1 — Voice Pipeline
**Goal:** Student speaks → text → AI responds → voice plays back.

### STT (Deepgram)
- [ ] Integrate Deepgram Nova-2 streaming SDK
- [ ] Stream microphone audio chunks from frontend → backend
- [ ] Receive transcript in real-time (word-by-word)
- [ ] Implement VAD (Voice Activity Detection) — detect silence
- [ ] Handle: background noise, short utterances, thinking pauses

### TTS (ElevenLabs)
- [ ] Integrate ElevenLabs streaming API (turbo model)
- [ ] Stream audio back to frontend as it generates
- [ ] Pick voice: warm, clear, slightly formal (e.g. "Rachel")
- [ ] Handle filler sounds: "Hmm...", "Let me think..." during AI latency
- [ ] Test full round-trip latency: target < 2.5 seconds

### Voice UI
- [ ] Microphone button with visual waveform
- [ ] "AI is speaking" indicator with pause/interrupt button
- [ ] Text transcript display (what was said)

---

## PHASE 2 — Lesson FSM (State Machine)
**Goal:** A lesson can flow through all 7 phases automatically.

- [ ] Implement LessonOrchestrator class (`/backend/src/lesson/`)
- [ ] Define LessonState type with 7 phases:
      `DIAGNOSTIC → CONTEXT_INPUT → RULE_DISCOVERY →`
      `EXERCISES → VOCABULARY → DEEP_THINKING → WRAP_UP`
- [ ] Each phase: entry action, valid transitions, exit condition
- [ ] Store current state in Redis (key: `lesson:{lessonId}:state`)
- [ ] Phase transition triggers: student answer, time limit, AI decision
- [ ] Test: run a full lesson flow with mock student responses

---

## PHASE 3 — AI Teacher Brain
**Goal:** AI responds correctly for each lesson phase.

- [ ] Build PromptBuilder (`/backend/src/ai/promptBuilder.ts`)
      Injects: phase, student profile, lesson topic, error history
- [ ] Implement full system prompt from @docs/master-prompt.md
- [ ] Connect to Claude claude-sonnet-4-6 API (streaming)
- [ ] Parse AI response: extract { reply, nextAction, exerciseData }
- [ ] Test Socratic questioning: AI asks leading questions, not answers
- [ ] Test error response: AI never says "Wrong", uses redirect

---

## PHASE 4 — RAG (Textbook Knowledge)
**Goal:** AI knows Focus B1 Unit 13 contents, answers from it only.

- [ ] Create textbook ingestion script (`/vector-db/scripts/ingest.ts`)
- [ ] Chunk Focus Unit 13 into: grammar rules, examples, vocab lists
- [ ] Embed chunks → upload to Pinecone
- [ ] Build RAG query function: semantic search on lesson topic
- [ ] Inject retrieved chunks into AI context (not full textbook)
- [ ] Test: AI answers grammar questions from textbook, not hallucination

---

## PHASE 5 — Exercise Engine
**Goal:** AI generates 4 types of exercises, adapts difficulty.

Read @docs/exercise-engine.md before implementing.

- [ ] ExerciseGenerator class (`/backend/src/exercises/`)
- [ ] Type 1: Form Transformation (fill in correct verb form)
- [ ] Type 2: Error Correction (find and fix the mistake)
- [ ] Type 3: Sentence Reconstruction (reorder words)
- [ ] Type 4: Free Production (write/speak using target grammar)
- [ ] Difficulty adapter: 2 errors → easier, 3 correct → harder
- [ ] All exercises use lesson topic vocabulary (Everest, NASA, etc.)
- [ ] Validate student answer: semantic match, not exact string

---

## PHASE 6 — Student Model + Progress
**Goal:** AI knows student weaknesses, adapts between sessions.

- [ ] Implement StudentProfile service
- [ ] Track: mastery per grammar point (0.0–1.0 score)
- [ ] Track: weak vocabulary (words answered wrong 2+ times)
- [ ] Track: error patterns (e.g. "forgets -ed in negatives")
- [ ] Track: average attention span (auto-calculated)
- [ ] Before lesson: load profile → inject into AI prompt
- [ ] After lesson: update profile from lesson_events
- [ ] Show student: progress dashboard (simple, visual)

---

## PHASE 7 — Polish + Beta Launch
**Goal:** 10 real students can complete a full lesson.

- [ ] Error handling: network drops, API timeouts, audio errors
- [ ] Loading states + skeleton UI
- [ ] Mobile-responsive layout
- [ ] Privacy: GDPR-aware data storage
- [ ] Deploy: backend on Railway/Render, frontend on Vercel
- [ ] Monitor: log lesson completion rate, error rate, latency
- [ ] Collect: feedback form after each lesson
- [ ] Fix top 3 issues from beta feedback

---

## DONE ✅
*(Move completed phases here)*

---

## NOTES FOR CLAUDE CODE
- Use `@docs/` references to load specific context only when needed
- Run `npm test` after every Phase completion
- If a task seems ambiguous → read the relevant doc file first
- Commit after each completed phase: `git commit -m "phase-X: description"`
