# Phase 16G — Kids Brain STT Integration

Goal:
Enable real speech recognition for Kids Brain v1 by reusing the existing lesson STT pipeline.

Implement backend STT integration only.

Do NOT modify curriculum.
Do NOT change WebSocket protocol.
Do NOT create a second STT implementation.
Do NOT deploy.

Context:
Phase 16F added Kids voice input on the frontend.

Frontend now sends existing WS frames:
- mic_start
- audio_chunk
- mic_stop

But backend Kids path drops audio because:
- handleKidsBrainV1LessonStart never initializes meta.stt
- audio_chunk handler has guard: if (!meta.stt) return
- mic_stop no-transcript fallback uses adult TTS path

Required architecture:
Use one shared STT pipeline.

Existing free/adult lesson STT:
mic_start/audio_chunk/mic_stop
→ createSTT(...)
→ transcript callback
→ lesson turn processor

Kids Brain STT:
mic_start/audio_chunk/mic_stop
→ same createSTT(...)
→ transcript callback
→ processKidsBrainV1Turn()

Do not duplicate Deepgram clients.
Do not create Kids-only audio protocol.

Read:
- backend/src/ws/lesson-ws.ts
- backend/src/**/stt*
- backend/src/**/deepgram*
- backend/src/ws/**
- frontend/src/features/classroom/hooks/useKidsMic.ts
- docs/kids-brain-v1/implementation/phase-16F-kids-voice-input-report.md
- docs/kids-brain-v1/implementation/phase-15B-real-ws-server-smoke-test-report.md

Tasks:

1. Audit existing STT flow

Find:
- createSTT()
- where adult/free lessons initialize meta.stt
- how mic_start is handled
- how audio_chunk is handled
- how mic_stop final transcript is handled
- how transcript callback enters the turn processor

2. Initialize STT for Kids Brain

In the Kids v1 session start path:

- when USE_KIDS_BRAIN_V1 is active
- after authenticated session ownership is confirmed
- after Kids session meta is initialized

set:

meta.stt = createSTT(ws, meta)

or equivalent existing pattern.

Reuse existing function exactly where safe.

3. Route final transcript to Kids Brain

Ensure recognized transcript from Kids mic goes to:

processKidsBrainV1Turn(...)

not adult runtime.

It must behave the same as text_message:
- same session memory load
- same Kids runtime pipeline
- same saveSession
- same analytics guard
- same TTS path

4. Fix mic_stop no-transcript fallback

If mic_stop produces no transcript in Kids mode:

- do not call adult ttsStream
- use kidsTtsStream
- child-safe prompt:
  "I didn't hear you. Try again!"
  or existing age-safe silence prompt

5. Safety

Preserve:
- auth
- session ownership
- KIDS_MAX_LLM_CALLS
- KIDS_MAX_TTS_CHARS
- session duration cap
- reconnect guard
- analytics finalization
- no unauthenticated audio processing

6. Tests

Add/update tests proving:

- Kids session initializes meta.stt
- audio_chunk is not dropped when Kids v1 is active
- transcript callback routes to processKidsBrainV1Turn
- voice transcript "I'm ready." emits "Listen — blue"
- voice transcript "blue" is processed like text "blue"
- mic_stop no-transcript fallback uses kids TTS path, not adult TTS
- adult/free lesson STT still works
- no WebSocket protocol changes
- no curriculum changes

Use mocks for Deepgram/STT. Do not require real external API.

7. Validation

Run:

cd backend
npx tsc --noEmit
npx vitest run src/ws
npx vitest run src/kids-brain

Expected:
- 0 TypeScript errors
- all tests pass

Create report:

docs/kids-brain-v1/implementation/phase-16G-kids-brain-stt-integration-report.md

Report must include:
- files modified
- existing STT pipeline reused
- exact Kids STT initialization point
- transcript routing behavior
- no-transcript fallback behavior
- tests added/updated
- commands run
- test results
- remaining risks
- next required phase

Output:
- files modified
- STT path reused
- transcript routing
- test results
- next required phase