# Voice Runtime Architecture

> How voice flows through the system. What each layer owns. Where STT ambiguity is handled.

See also: [[RUNTIME_AUTHORITY_MAP]] · [[STT_NOISE_PATTERNS]] · [[VOICE_PEDAGOGY_DOCTRINE]]

---

## Pipeline

```
Student speaks
    ↓
STT (Deepgram / Whisper)
    ↓  partial transcripts → frontend preview only (never submitted)
    ↓  final transcript → lesson-ws (WebSocket handler)
    ↓
lesson-ws
    ├── readiness intent check (guards exercise start vs exercise answer)
    ├── attach cursor identifiers (exerciseId, itemIndex)
    ├── reject stale / duplicate turns
    └── route to Master Orchestrator
    ↓
Master Lesson Orchestrator
    ├── tryManifestValidateVoice() → voice-specific validation path
    └── standard processInput() for non-voice paths
    ↓
Exercise Engine (cursor lookup + progression)
    ↓
Validation System (allowProgression gate)
    ↓
Updated cursor + result (backend emits via WebSocket)
    ↓
Teacher Brain (reads updated cursor — verbal response only)
    ↓
TTS → student hears response
```

---

## Layer Contracts

### STT Layer
- Produces partial transcripts (UI preview only)
- Produces final transcript (answer submission)
- Does NOT interpret meaning
- Does NOT submit answers
- Keepalive: heartbeat every 30 seconds, disconnect after 45 min inactivity

### lesson-ws (WebSocket Handler)
- Intercepts readiness intent BEFORE answer routing
  - "I'm ready", "let's go", "start" → exercise flow signal, NOT exercise answer
- Attaches exerciseId and itemIndex to every answer event
- Rejects duplicate turns from same transcript ID
- Rejects empty or whitespace-only transcripts (no AI call)
- Partial transcript: never submitted as answer

### Master Lesson Orchestrator
- `tryManifestValidateVoice()`: voice path with STT tolerance
- Handles 800ms timeout guard for pending mic stop
- Routes to `validateSoftSpeakingAnswer` for soft speaking types
- Routes to deterministic validator for fill/matching types

### Teacher Brain
- Reads UPDATED cursor AFTER Validation returns
- Verbal response reflects validation result — never contradicts it
- Cannot be invoked before auth/session/runtime validation

---

## Readiness Intent Guard

**Critical bug class**: student says "I'm ready" or "let's go" while on an exercise.
- Without this guard: WS routes it as an exercise answer → validation fails → wrong correction path
- With guard: WS intercepts before answer routing → teacher responds with exercise prompt

Pattern matched (before any validation):
```
^(i('m| am) ready|ready|let's go|lets go|let's start|lets start|start|begin|go ahead|yes i'm ready)
```

This guard runs FIRST in lesson-ws, before processInput().

---

## Stale State Prevention

| Risk | Prevention |
|------|-----------|
| Partial transcript submitted as answer | lesson-ws only submits final transcript |
| Old transcript replayed after reconnect | Turn deduplication by transcript ID |
| Mic start before session ready | Auth/session validation gate before STT init |
| STT running after lesson end | SIGTERM handler closes STT stream |
| Voice answer with wrong cursor | exerciseId attached to every answer event |

---

## TTS Constraints

- Silent TTS (empty text) must be discarded before queuing
- TTS must not fire before Teacher Brain has read the updated cursor
- TTS cutout from interrupted responses: discard pending buffer, do not resume from prior turn
- AudioContext must be initialized by user gesture — never by AI/STT/TTS

---

## Voice Timing

| Event | Max Allowed Latency |
|-------|-------------------|
| STT partial → UI preview | < 200ms |
| Final transcript → answer submission | < 500ms |
| Answer submission → validation result | < 1000ms |
| Validation result → Teacher Brain response | < 1500ms |
| Teacher Brain → TTS first audio chunk | < 2500ms |

If validation + Teacher Brain + TTS exceeds ~4 seconds, student experience degrades significantly.

---

## Anti-Patterns (Never Implement)

- Do NOT use partial transcript as answer
- Do NOT advance lesson from STT callback directly
- Do NOT replay old transcript after WebSocket reconnect
- Do NOT invoke TTS before backend state is confirmed
- Do NOT bypass Validation System via voice path
- Do NOT run STT/TTS before auth/session validation

See [[KNOWN_RUNTIME_FAILURES]] for what happens when these are violated.
