# AI English Teacher — Project Constitution
> This file is loaded at the start of EVERY Claude Code session.
> Read it completely before writing a single line of code.

## WHY THIS PROJECT EXISTS

This is a **voice-first AI English teacher** for students aged 12–17.
The AI replaces a live teacher entirely — it speaks, listens, teaches grammar,
generates exercises, corrects mistakes, and develops critical thinking.

**This is NOT a language app like Duolingo.**
This is a cognitive development system where English is the instrument,
and deeper thinking is the goal. A single lesson should feel like a
session with a $500/hour Oxford-trained tutor — structured, rigorous,
personalised, and intellectually stimulating.

The student works from a real textbook (e.g. **Focus B1**).
The AI knows the textbook, teaches from it, and generates its own
exercises on top of it — always tied to a real-world theme
(Everest, NASA, historical events, philosophy).

## WHAT TO READ BEFORE TOUCHING CODE

Before implementing any feature, read the relevant doc:

- Architecture overview → @docs/architecture.md
- Lesson logic (FSM) → @docs/lesson-fsm.md
- AI teacher prompt → @docs/master-prompt.md
- Real dialogue examples → @docs/dialogue-examples.md  ← READ THIS FIRST
- Student data model → @docs/student-model.md
- Exercise generator → @docs/exercise-engine.md
- Pedagogy sources → @docs/pedagogy-sources.md
- Focus textbook structure + RAG → @docs/focus-textbook.md
- Business context + monetization → @docs/business-context.md
- Current progress → @docs/roadmap.md

## HOW TO WORK ON THIS PROJECT

1. **Start every session** by reading @docs/roadmap.md — check which phase is active
2. **Before coding a feature** — read its relevant doc file first
3. **After completing a task** — update the checkbox in @docs/roadmap.md
4. **Never guess about pedagogy** — all teaching logic is in @docs/master-prompt.md
5. **Never invent a DB schema** — it's defined in @docs/student-model.md

## TECH STACK (do not change without updating architecture.md)

```
Backend:      Node.js + TypeScript + Express + WebSocket (ws)
Database:     PostgreSQL (persistent) + Redis (lesson state)
Vector DB:    Pinecone (RAG for textbook content)
STT:          Deepgram Nova-2 (streaming, low latency)
TTS:          ElevenLabs (streaming, turbo model)
AI Brain:     Anthropic Claude claude-sonnet-4-6 via API
Frontend:     React + TypeScript + TailwindCSS
Auth:         JWT (simple, students + teachers)
```

## CRITICAL RULES

- **Lesson state lives in Redis**, never in memory
- **Student profile lives in PostgreSQL**, never in Redis
- **AI never sees raw textbook pages** — only chunked embeddings via RAG
- **Every AI response must include** lesson phase + confidence score
- **WebSocket handles all real-time** lesson communication
- **REST API handles** auth, progress, admin only
- **TTS must stream** — never wait for full text before speaking
- **STT must be streaming** — process audio chunks as they arrive

## FILE STRUCTURE

```
/
├── CLAUDE.md                  ← You are here (load every session)
├── .claude/
│   └── rules/
│       ├── backend.md         ← Backend coding rules
│       ├── ai-prompts.md      ← Rules for editing AI prompts
│       └── testing.md         ← Testing requirements
├── docs/                      ← Read before coding (not loaded automatically)
│   ├── roadmap.md             ← Current progress + next tasks
│   ├── architecture.md        ← Full system diagram
│   ├── lesson-fsm.md          ← 7-phase lesson state machine
│   ├── master-prompt.md       ← The AI teacher system prompt
│   ├── student-model.md       ← Database schema + student profile
│   ├── exercise-engine.md     ← Exercise generation logic
│   └── pedagogy-sources.md    ← Research, textbooks, links
├── backend/
│   ├── src/
│   │   ├── api/               ← REST endpoints
│   │   ├── lesson/            ← FSM, orchestrator, phases
│   │   ├── ai/                ← Claude API, RAG, prompt builder
│   │   ├── voice/             ← STT (Deepgram) + TTS (ElevenLabs)
│   │   ├── db/                ← PostgreSQL models + Redis client
│   │   └── exercises/         ← Exercise generator
│   └── tests/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── LessonRoom/    ← Main lesson interface
│       │   ├── VoiceInput/    ← Mic + VAD component
│       │   └── ExerciseCard/  ← Renders exercise types
│       └── hooks/
└── vector-db/
    └── scripts/               ← Textbook ingestion scripts
```
