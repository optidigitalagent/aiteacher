# PHASE 1 COMPLETE

## 1. Summary

Phase 1 completed. Voice runtime and conversational stability stabilized.

The main classroom instabilities have been fixed through targeted changes to four files.
The STT echo loop is now blocked at the backend with a `ttsActive` flag.
Students can now interrupt the teacher by clicking mic during speech.
Stale audio chunks are discarded client-side after interrupt using `isSpeakingRef`.
The duplicate chat message bug on lesson resume is fixed.
STT transcript buffer is cleared on interrupt to prevent stale AI triggers.

## 2. Goals Completed

Completed:
- Server-side STT gate during TTS (ttsActive flag prevents echo loop)
- Student interrupt flow: clicking mic during teacher speech sends interrupt + opens mic
- Stale audio chunk discarding after interrupt (isSpeakingRef gate in onAudioChunk)
- STT buffer cleared on interrupt (clearBuffer() method in DeepgramSTT)
- Duplicate resume chat message fixed (removed redundant ai_text from resumeLesson)
- Duplicate focus_lesson_start guard on same WS connection
- stopRecording() called on lesson_resumed to prevent echo during resume greeting

NOT completed (descoped — Phase 2+):
- Auto-reconnect with isSpeaking state reset (no auto-reconnect yet; page refresh resets state)
- Text input gating during teacher speech (text_message still works during TTS — aiProcessing guard handles most cases)
- Explicit PAUSED lesson state (Phase 2)
- 50-minute timer frontend display (Phase 2)

## 3. Changed Files

Backend:
- backend/src/voice/stt.ts — added clearBuffer() method
- backend/src/ws/lesson-ws.ts — ttsActive flag, STT gate in all 3 STT callbacks, clearBuffer on interrupt, removed duplicate ai_text from resumeLesson, duplicate begin guard, ttsActive logging

Frontend:
- frontend/src/features/classroom/hooks/useVoiceSession.ts — added isSpeakingRef, gated onAudioChunk, synced ref in setSpeaking/toggle/scheduleSpeakOff
- frontend/src/features/classroom/components/ClassroomLayout.tsx — fixed paidToggle to allow interrupt during teacher speech, added stopRecording() to lesson_resumed handler

Database:
- No database changes.

Docs:
- docs/phase/PHASE_1_HANDOFF.md — this file

## 4. Backend Changes

**stt.ts**: Added `clearBuffer()` public method that resets `transcriptBuffer` to empty string. Called on interrupt so any Deepgram utterance buffered during teacher speech doesn't fire as a new AI turn after TTS stops.

**lesson-ws.ts**:

1. `ClientMeta` interface now includes `ttsActive: boolean` (initialized false).

2. `ttsStream()` sets `meta.ttsActive = true` before streaming, clears it in a `finally` block. This ensures it goes false whether TTS completes naturally or is aborted by interrupt.

3. STT callback in `handleLessonStart`, `handleFocusLessonStart`, and `resumeLesson` now checks `meta.ttsActive` first:
   ```
   if (meta.ttsActive) { log + return }
   ```
   This is the primary echo prevention. Even if frontend PCM capture is delayed in stopping, Deepgram transcripts are discarded on the backend while teacher is speaking.

4. `interrupt` handler now calls `meta.stt?.clearBuffer()` before aborting TTS. This prevents a buffered utterance from the student's previous speech from firing as a new AI call.

5. `resumeLesson()` no longer sends `{ type: 'ai_text' }` — the `lesson_resumed` event alone is sufficient. Frontend now handles resume greeting via `lesson_resumed`. This eliminates the duplicate chat message that appeared on every reconnect.

6. `handleFocusLessonStart()` now returns early if `meta.lessonId` is already set, preventing duplicate lesson initialization on the same WS connection.

## 5. Frontend Changes

**useVoiceSession.ts**:

Added `isSpeakingRef = useRef(false)` that mirrors `isSpeaking` state synchronously.

Key insight: React state updates are asynchronous (batched). In WS message callbacks, we need immediate synchronous reads. The ref is set before `setIsSpeaking()` in every code path:
- `setSpeaking(v)` — sets `isSpeakingRef.current = v` before `setIsSpeaking(v)`
- `toggle()` when starting mic — sets `isSpeakingRef.current = false` alongside `setIsSpeaking(false)`
- `scheduleSpeakOff()` timer — sets `isSpeakingRef.current = false` alongside `setIsSpeaking(false)`

`onAudioChunk` now gates on `isSpeakingRef.current`:
```typescript
if (!isSpeakingRef.current) { log 'audio_chunk_discarded reason=not_speaking'; return }
```
This discards in-flight audio chunks that arrive after interrupt. WebSocket messages are TCP-ordered, so `ai_text` (which sets isSpeakingRef=true) always precedes the first chunk of a new turn. Stale chunks from the old turn arrive before new `ai_text`, so they're always discarded correctly.

**ClassroomLayout.tsx**:

`paidToggle` previously returned early when `isSpeaking=true`. Now it allows interrupt:
```typescript
if (isSpeaking && !isListening) {
  send({ type: 'interrupt' })  // stop backend TTS
}
await toggle()  // toggle() stops frontend audio + opens mic
```

`lesson_resumed` handler now calls `stopRecording()` to ensure PCM capture is stopped while the resume greeting TTS plays. Previously this was only done by `ai_text` (which no longer comes separately on resume).

## 6. Database Changes

No database changes.

## 7. Runtime Behavior Changes

Before:
- Student clicks mic during teacher speech → nothing happens (blocked)
- Teacher TTS audio could trigger Deepgram → duplicate AI turn (echo loop)
- After interrupt, leftover TTS audio chunks continued playing for 1-2 seconds
- On lesson resume, same message appeared twice in chat
- Rapid Begin Lesson clicks could create duplicate lessons on same connection

After:
- Student clicks mic during teacher speech → teacher stops immediately, mic opens
- Backend discards all STT transcripts while ttsActive=true (echo impossible)
- After interrupt, leftover audio chunks are discarded client-side (isSpeakingRef gate)
- On lesson resume, message appears exactly once in chat
- Duplicate focus_lesson_start calls are rejected silently on backend
- STT buffer is cleared on interrupt (no stale utterance fires as new AI turn)

## 8. WebSocket/Event Changes

No new events added.
No events removed.
No payload changes.

Behavior change (not a type change):
- `lesson_resumed` is now the sole event carrying the resume greeting text.
  Backend no longer sends a redundant `ai_text` alongside `lesson_resumed`.
  Frontend `lesson_resumed` handler now also calls `stopRecording()`.

## 9. AI/Prompt Changes

No AI/prompt changes. Orchestrator, prompt builder, and all AI behavior unchanged.

## 10. Cost Impact

Cost impact:
- STT cost reduced: backend discards transcripts during TTS (no spurious AI calls from echo)
- TTS cost slightly reduced: no duplicate TTS calls from echo-triggered AI turns
- AI call frequency: unchanged or slightly lower (echo-driven spurious calls eliminated)
- No new API providers or model changes

## 11. Tests Performed

Tested (code inspection / static analysis):
- Backend TypeScript typecheck: `npm run build` → passes, no errors
- Frontend TypeScript typecheck: `tsc --noEmit` → passes, no errors
- Code path analysis for interrupt flow, chunk gating, ttsActive propagation

Manual runtime tests:
- Manual product testing is scheduled only after all phases complete (per project instructions).
- Code-level verification performed for all changed code paths.

## 12. Known Remaining Issues

Remaining issues:
- STT is still always-on at the protocol level (Deepgram connection stays open). The ttsActive backend gate prevents echo in practice, but if backend state and frontend state somehow desync, the gate may be missed. Full STT pause/resume (Phase 1 stretch goal from roadmap) not implemented.
- No auto-reconnect: on WS drop, user must refresh. isSpeaking state resets on page refresh.
- text_message during TTS: typing and submitting text while teacher speaks is not blocked on frontend. Backend aiProcessing gate handles most cases but TTS and new AI call can overlap briefly. Acceptable for Phase 1.
- No frontend indicator when mic is blocked before lesson start (silently returns).
- teacher_turn_end missing after interrupt: if student interrupts and teacher never fully responds, there's no teacher_turn_end sent. This is by design (interrupt aborts TTS, frontend handles via stopAudioPlayback).
- Resume still restores only rough state (exercise number, phase). Exact cursor (item_index) not tracked. Phase 6 will address.

## 13. What Was Intentionally NOT Changed

Intentionally NOT changed:
- billing architecture (LiqPay, subscription service, finalizeUsage)
- demo lesson runtime (useDemoSession, demo-routes, lesson-engine)
- auth system (JWT, AuthContext)
- lesson orchestrator and AI prompts
- Redis TTL patterns (all lesson keys still use LESSON_TTL)
- exercise validation and exercise-store
- lesson state machine (still 7-phase: DIAGNOSTIC → END)
- message-types.ts (no new WS event types needed)
- classroomSocket.ts (no changes to WS client)
- voiceApi.ts (AudioContext pipeline unchanged)
- STT always-on architecture (only gated, not restructured)
- 50-minute hard cap logic (maxDurationRef unchanged)
- Resume detection logic (lesson_sessions + Redis check unchanged)

## 14. Risks Introduced

New risks:
- `ttsActive` flag could theoretically get stuck as `true` if `ttsStream` throws an unhandled error before reaching `finally`. The `finally` block guards against this, but if process crashes mid-TTS, `ttsActive` never resets. On reconnect, `meta` is a new object so `ttsActive` starts false — no persistent risk.
- `isSpeakingRef` gate discards chunks when `isSpeakingRef.current = false`. If for any reason the frontend's `ai_text` is missed (e.g., malformed message), chunks would be silently discarded. The 8s `scheduleSpeakOff` fallback timer would also not trigger isSpeakingRef=true (only sets isSpeaking state). Mitigation: `ai_text` is always sent before chunks (ordered TCP), so this race cannot happen in normal operation.
- Removing `ai_text` from `resumeLesson` means the resume greeting is ONLY delivered via `lesson_resumed`. If any future code path starts lesson_resumed without `setSpeaking(true)`, audio chunks would be discarded. Current `lesson_resumed` handler correctly calls `setSpeaking(true)`.

## 15. Deployment Notes

No new environment variables required.
No database migrations required.
Requires Railway redeploy of backend (lesson-ws.ts, stt.ts changed).
Requires frontend build + deploy (useVoiceSession.ts, ClassroomLayout.tsx changed).

## 16. Recommended Next Phase

Recommended next phase:
Phase 2 — Lesson State Machine & Runtime Container

Reason: With voice runtime stabilized, the next priority is making the lesson feel structured.
Phase 2 adds explicit lesson states, agenda tracking, 50-minute runtime container awareness in the AI teacher prompts, and side-question recovery. Without Phase 2, the teacher still drifts between topics and loses exercise context after interruptions.

## 17. Next Claude Session Instructions

Next Claude session should:
- Read docs/PAID_LESSON_RUNTIME_ROADMAP.md first
- Read docs/phase/PHASE_1_HANDOFF.md (this document)
- Read docs/RUNTIME_GUARDRAILS.md
- Read docs/WEBSOCKET_EVENT_CONTRACT.md
- Read docs/LESSON_RUNTIME_STATE_MAP.md
- Inspect backend/src/ws/lesson-ws.ts to understand current ttsActive + aiProcessing guards
- Inspect backend/src/lesson/orchestrator.ts and transitions.ts before touching phase logic
- Continue from Phase 2 ONLY

DO NOT:
- Remove or bypass the ttsActive gate in the STT callbacks (echo protection)
- Remove the isSpeakingRef chunk gate in useVoiceSession.ts
- Remove clearBuffer() call on interrupt in lesson-ws.ts
- Send ai_text from resumeLesson (duplicate message bug would return)
- Modify billing, auth, demo runtime, or subscription system
- Implement textbook renderer (Phase 3), tips (Phase 5), or reflection (Phase 6) yet
- Rewrite the websocket architecture or replace STT/TTS providers
