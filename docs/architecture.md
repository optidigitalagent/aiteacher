# System Architecture — AI English Teacher

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        STUDENT (Browser)                        │
│                                                                 │
│  [Microphone] → VAD → AudioChunks ──────────────────────────┐  │
│  [Speaker]   ← AudioStream ← TTS ←──────────────────────┐   │  │
│  [Chat UI]   ← TextMessages ←────────────────────────┐   │   │  │
│  [Exercise]  ← ExerciseCard ←────────────────────┐   │   │   │  │
└──────────────────────────────────────────────────┼───┼───┼───┘
                                                   │   │   │
                              WebSocket (ws://)    │   │   │
                                                   │   │   │
┌──────────────────────────────────────────────────▼───▼───▼───┐
│                      BACKEND (Node.js)                        │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                  LESSON ORCHESTRATOR                     │  │
│  │                                                          │  │
│  │  LessonState (FSM)                                       │  │
│  │  DIAGNOSTIC → CONTEXT_INPUT → RULE_DISCOVERY →          │  │
│  │  EXERCISES → VOCABULARY → DEEP_THINKING → WRAP_UP       │  │
│  │                                                          │  │
│  │  Decides: what phase, what to say, what exercise next    │  │
│  └──────────┬──────────────┬───────────────┬───────────────┘  │
│             │              │               │                   │
│   ┌─────────▼──┐  ┌────────▼───┐  ┌───────▼──────────────┐   │
│   │  VOICE     │  │  AI ENGINE │  │  EXERCISE ENGINE      │   │
│   │            │  │            │  │                        │   │
│   │ STT:       │  │ RAG Query  │  │ Type1: Transform       │   │
│   │ Deepgram   │  │ ↓          │  │ Type2: Error Fix       │   │
│   │ Nova-2     │  │ Pinecone   │  │ Type3: Reconstruct     │   │
│   │ (stream)   │  │ ↓          │  │ Type4: Free Production │   │
│   │            │  │ Claude     │  │                        │   │
│   │ TTS:       │  │ claude-sonnet-4-6│  │ Difficulty Adapter     │   │
│   │ ElevenLabs │  │ (stream)   │  │ Answer Validator       │   │
│   │ (stream)   │  │            │  │                        │   │
│   └────────────┘  └────────────┘  └────────────────────────┘   │
│                                                               │
│  ┌─────────────────────┐  ┌──────────────────────────────┐   │
│  │  STUDENT MODEL      │  │  REST API                    │   │
│  │                     │  │                              │   │
│  │ PostgreSQL:         │  │ POST /auth/login             │   │
│  │ - students          │  │ GET  /students/:id/profile   │   │
│  │ - lessons           │  │ GET  /lessons/:id/history    │   │
│  │ - lesson_events     │  │ GET  /progress/:studentId    │   │
│  │ - exercises         │  │                              │   │
│  │ - vocabulary_items  │  │ (auth, history, admin only)  │   │
│  │                     │  │ All lesson activity = WS     │   │
│  │ Redis:              │  └──────────────────────────────┘   │
│  │ - lesson:{id}:state │                                      │
│  │ - lesson:{id}:ctx   │                                      │
│  └─────────────────────┘                                      │
└───────────────────────────────────────────────────────────────┘
```

## Data Flow: One Student Utterance

```
1. Student speaks into mic
2. Frontend: AudioWorklet captures 16kHz PCM chunks
3. Frontend → WS: { type: "audio_chunk", data: base64 }
4. Backend: Deepgram receives chunk → partial transcript
5. Backend: VAD detects end-of-utterance (300ms silence)
6. Backend: Final transcript locked → LessonOrchestrator.process(text)
7. Orchestrator:
   a. Updates Redis: lesson state + conversation history
   b. Loads student profile from PostgreSQL
   c. Queries Pinecone: relevant textbook chunks for this lesson
   d. Builds prompt: phase + student profile + RAG + history
   e. Calls Claude API (streaming)
8. Claude streams response tokens
9. Backend: simultaneously sends tokens to:
   a. ElevenLabs TTS (streaming) → audio chunks → frontend
   b. WebSocket text channel → frontend (text display)
10. Frontend: plays audio stream + shows text transcript
11. Backend: after full response, updates:
    a. lesson_events in PostgreSQL
    b. lesson state in Redis
    c. Student mastery scores (async, non-blocking)
```

## Latency Budget (target < 2.5s total)

```
STT finalization:      ~300ms  (end of speech detection)
RAG query:             ~100ms  (Pinecone vector search)
Prompt build:          ~20ms   (local)
Claude first token:    ~600ms  (API latency)
TTS first audio chunk: ~400ms  (ElevenLabs turbo)
Audio playback start:  ~80ms   (browser)
───────────────────────────────
TOTAL:                ~1500ms  ← target
Max acceptable:        2500ms
```

## WebSocket Event Protocol

```typescript
// Student → Backend
{ type: "audio_chunk",   data: string }        // base64 PCM
{ type: "text_message",  text: string }        // typed input fallback
{ type: "lesson_start",  payload: LessonConfig }
{ type: "exercise_answer", exerciseId: string, answer: string }
{ type: "interrupt" }                          // student interrupts AI

// Backend → Student
{ type: "ai_text",       text: string, phase: LessonPhase }
{ type: "audio_chunk",   data: string }        // base64 MP3
{ type: "exercise",      exercise: Exercise }
{ type: "phase_change",  from: string, to: string }
{ type: "feedback",      correct: boolean, explanation: string }
{ type: "lesson_end",    summary: LessonSummary }
```

## Environment Variables Required

```
ANTHROPIC_API_KEY=
DEEPGRAM_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=     # Choose: "Rachel" or similar warm voice
PINECONE_API_KEY=
PINECONE_INDEX=          # "ai-teacher-textbooks"
DATABASE_URL=            # postgres://...
REDIS_URL=               # redis://localhost:6379
JWT_SECRET=
PORT=4000
```
