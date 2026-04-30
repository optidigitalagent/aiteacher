# Project Roadmap — AI English Teacher MVP

> Claude Code: Check this file at the start of every session.
> Update checkboxes [ ] → [x] as tasks are completed.
> Current active phase is marked with ▶

---

## PHASE 0 — Foundation Setup ✅ COMPLETE
**Goal:** Project runs locally, basic WebSocket works, DB connected.

### Infrastructure
- [x] Init Node.js + TypeScript backend (`/backend`)
- [x] Test client HTML (`/frontend/test-client.html`) — single-file, no build
- [x] Setup PostgreSQL with Docker Compose
- [x] Setup Redis with Docker Compose
- [x] Create `.env.example` with all required keys
- [x] Verify all services connect on `npm run dev`

### Database
- [x] Run migrations: all tables from @docs/student-model.md (`001_init.sql`)
- [x] Seed: 1 test student + Focus B1 Unit 1 content

### WebSocket skeleton
- [x] WS server at `ws://localhost:4000/lesson`
- [x] All 5 inbound event types handled (Zod validated)
- [x] All 7 outbound event types defined

---

## PHASE 1 — Voice Pipeline ✅ COMPLETE
**Goal:** Student speaks → text → AI responds → voice plays back.

### STT (Deepgram)
- [x] Deepgram Nova-2 streaming SDK integrated
- [x] PCM audio chunks streamed frontend → backend
- [x] Real-time transcription (final + speech_final detection)
- [x] VAD via Deepgram endpointing=300ms
- [x] STT transcript echoed back to client for debugging

### TTS (ElevenLabs)
- [x] ElevenLabs streaming API (eleven_turbo_v2_5 model)
- [x] MP3 chunks streamed back to frontend
- [x] Interrupt (AbortController) on student interrupt event
- [x] Graceful degradation if API key missing

---

## PHASE 2 — Lesson FSM ✅ COMPLETE
**Goal:** A lesson can flow through all 7 phases automatically.

- [x] LessonOrchestrator class (`/backend/src/lesson/orchestrator.ts`)
- [x] LessonState type with 7 phases + all transition fields
- [x] Phase transitions: rule-based + AI-signaled (next_action field)
- [x] State stored in Redis with 4h TTL
- [x] Difficulty adapter: 2 errors → easier, 3 correct → harder
- [x] Exercise results recorded + lesson events logged to PostgreSQL

---

## PHASE 3 — AI Teacher Brain ✅ COMPLETE
**Goal:** AI responds correctly for each lesson phase.

- [x] PromptBuilder (`/backend/src/ai/prompt-builder.ts`)
      Injects: phase, student name/age/level, grammar target, topic, error history
- [x] Full system prompt structure matching @docs/master-prompt.md
- [x] OpenAI API connection (streaming disabled — JSON mode used)
- [x] Response parsed: { speech, display_text, next_action, exercise, internal_note }
- [x] Fallback response on parse error
- [x] Rolling conversation history in Redis (last 8 exchanges)
- [ ] Test Socratic questioning manually
- [ ] Test error response: AI uses redirect not "Wrong"

---

## PHASE 4 — RAG (Textbook Knowledge) ✅ COMPLETE
**Goal:** AI knows Focus B1 content, answers from it only.

- [x] Add `@pinecone-database/pinecone` to backend
- [x] Create `backend/src/ai/rag.ts` — OpenAI embed + Pinecone query (graceful no-key fallback)
- [x] Wire RAG into AI handler (ragContext injected into every prompt)
- [x] Create `vector-db/scripts/ingest.ts` — embed + upload script
- [x] Focus B1 Unit 2 (narrative tenses): 7 chunks defined — grammar rules, examples, vocab, errors
- [ ] **ACTION NEEDED**: Create Pinecone index (dims=1536, cosine) + run `tsx ../vector-db/scripts/ingest.ts`
- [ ] Test: AI answers grammar questions from textbook chunks, not hallucination

---

## PHASE 5 — Exercise Engine ✅ COMPLETE
**Goal:** AI generates 4 types of exercises, adapts difficulty.

- [x] Difficulty adapter (in orchestrator)
- [x] Answer validator with AI semantic evaluation (`validator.ts`)
- [x] Exercise saved to Redis + PostgreSQL on generation (`exercise-store.ts`)
- [x] ExerciseGenerator class with explicit prompt templates (`generator.ts`)
- [x] Type 1: Form Transformation prompt template
- [x] Type 2: Error Correction prompt template
- [x] Type 3: Sentence Reconstruction prompt template
- [x] Type 4: Free Production prompt template
- [x] `nextExerciseType()` — sequence logic: start T1, ensure T2+T4 appear
- [x] `hint` field added to ExerciseData, shown in test client

---

## PHASE 6 — Student Model + Progress ✅ COMPLETE
**Goal:** AI knows student weaknesses, adapts between sessions.

- [x] DB schema ready (student_profiles table)
- [x] Profile loaded and injected into prompt (grammarMastery, errorPatterns)
- [x] Post-lesson profile updater (`profile-updater.ts`) — runs async after lesson_end
- [x] Grammar mastery: correct answers → +0.08, wrong → -0.04 (capped 0–1)
- [x] Error patterns: auto-detected from exercise results (overgeneralisation, word order, etc.)
- [x] Attention span: rolling average (70% old + 30% new lesson duration)
- [x] All updates in a single DB transaction + logged as lesson_event

---

## PHASE 7 — Polish + Beta Launch ✅ COMPLETE
**Goal:** 10 real students can complete a full lesson.

- [x] Timeouts: OpenAI 15s, ElevenLabs 10s — no more hung requests
- [x] Deploy: Railway configured (`railway.toml` — auto-migrate on start)
- [x] Monitor: `GET /health` returns DB+Redis status, uptime, 24h lesson stats + completion rate
- [x] Collect: `POST /lessons/:id/feedback` — rating 1–5 + comment, stored in lesson_events
- [x] REST API: `GET /students/:id/profile`, `GET /students/:id/lessons`
- [ ] Set Railway env vars (OPENAI_API_KEY, DEEPGRAM_API_KEY, ELEVENLABS_API_KEY, PINECONE_API_KEY, JWT_SECRET)
- [ ] Fix top 3 issues from beta feedback

---

## DONE ✅
- Phase 0: Foundation (backend, Docker, DB, WS)
- Phase 1: Voice pipeline (Deepgram STT + ElevenLabs TTS)
- Phase 2: Lesson FSM (7 phases, Redis state, transitions)
- Phase 3: AI Teacher Brain (PromptBuilder + OpenAI handler)

---

## NOTES FOR CLAUDE CODE
- Use `@docs/` references to load specific context only when needed
- Run `npm test` after every Phase completion
- If a task seems ambiguous → read the relevant doc file first
- Commit after each completed phase: `git commit -m "phase-X: description"`
- User provides their own frontend — only implement backend
