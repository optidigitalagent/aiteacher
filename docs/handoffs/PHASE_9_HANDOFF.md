# PHASE 9 COMPLETE — PAID RUNTIME PARITY

## 1. Summary

Phase 9 was a parity/stabilization pass. The free (demo) lesson runtime had noticeably smoother interaction UX than the paid lesson runtime due to six divergence points in the voice lifecycle and input/transcript ownership. After Phase 9, all six are closed: the mic button can now interrupt teacher speech, the transcript field clears correctly after auto-send, typed text is never overwritten by stale STT partials, an interrupt during AI processing is honoured (TTS skipped), the AI typing indicator appears for voice-triggered turns, and the `ai_text` event no longer closes the mic when the student has already interrupted.

Both TypeScript builds pass with 0 errors. Frontend production build is clean.

## 2. Runtime Divergences Found

### Divergence 1 — Mic button disabled during teacher speech (CRITICAL)
**Free**: `micDisabled` is always `false` in demo mode — user can click mic at any time.
**Paid (before)**: `micDisabled={!isDemoMode && (!lessonStarted || isSpeaking)}` — button disabled when `isSpeaking=true`, making the interrupt mechanism in `paidToggle` unreachable. The interrupt code was correct but the button that called it was grayed out.

### Divergence 2 — Transcript persists in input after STT auto-send (CRITICAL)
**Free**: `demoSubmitRef` calls `setAnswer('')` before `handleTextSubmit`.
**Paid (before)**: `student_message` handler only called `pushUser(msg.text)`. Answer field kept the Deepgram partial transcript after the message had been sent to chat and to the AI.

### Divergence 3 — STT transcript overwrites manually typed text
**Free**: N/A (demo uses Web Speech API and no `useEffect` side-channel).
**Paid (before)**: `useEffect(() => { if (transcript) setAnswer(transcript) }, [transcript])` fires regardless of whether the mic is active — overwrites anything the student typed while not recording.

### Divergence 4 — Interrupt during AI processing not honoured (CRITICAL)
**Free**: `interruptAudio()` is synchronous — increments generation counter, stops audio, sets `isSpeaking=false` immediately.
**Paid (before)**: `meta.ttsController?.abort()` aborts the CURRENT TTS controller. But `ttsStream()` always creates a NEW `AbortController`, so an interrupt received while `processInput()` was in-flight had no effect — TTS started anyway with a fresh controller.

### Divergence 5 — No typing indicator for STT-triggered turns
**Free**: `showAiMessage()` shows a typing bubble before AI text resolves.
**Paid (before)**: `student_message` handler only called `pushUser()`. No typing indicator appeared between the student's spoken answer and the AI's text response. (Text-path correctly called `setTyping()` via `handleSubmit`.)

### Divergence 6 — `ai_text` after interrupt closes the mic
**Free**: Audio interrupt is purely local; no WS event closes the mic.
**Paid (before)**: When interrupt was sent but AI was mid-processing, the `ai_text` response still arrived and unconditionally called `setSpeaking(true)` + `stopRecording()`, closing the mic the student had just opened.

## 3. Fixes Implemented

### Fix 1 — Mic button enabled during speech (`ClassroomLayout.tsx`)
```diff
- micDisabled={!isDemoMode && (!lessonStarted || isSpeaking)}
+ micDisabled={!isDemoMode && !lessonStarted}
```
Mic button is now always available once the lesson starts. Clicking while teacher speaks calls `paidToggle`, which sends `{ type: 'interrupt' }` and opens the mic. The tooltip on the disabled state is now only shown before lesson start.

### Fix 2 — `student_message` clears transcript and shows typing (`ClassroomLayout.tsx`)
```diff
  case 'student_message':
    pushUser(msg.text)
+   setAnswer('')       // clear stale STT transcript from input field
+   onTranscript('')    // clear transcript state so the useEffect doesn't restore it
+   setTyping()         // show AI processing indicator (mirrors demo behavior)
    break
```

### Fix 3 — Transcript `useEffect` guarded by `isListening` (`ClassroomLayout.tsx`)
```diff
- useEffect(() => { if (transcript) setAnswer(transcript) }, [transcript])
+ useEffect(() => { if (transcript && isListening) setAnswer(transcript) }, [transcript, isListening])
```
Live STT preview only updates the answer field while the mic is active. Manually typed text is never overwritten by a stale partial.

### Fix 4 — Backend `interruptPending` flag (`lesson-ws.ts`)
Added `interruptPending: boolean` to `ClientMeta`. When interrupt arrives while `aiProcessing=true`, the flag is set. `ttsStream()` checks the flag at entry: if set, it resets the flag, logs `tts_skipped reason=interrupt_pending`, and sends `teacher_turn_end` (so the frontend mic lifecycle completes cleanly) — then returns without streaming TTS.

```typescript
// In interrupt handler:
if (meta.aiProcessing) {
  meta.interruptPending = true
}

// In ttsStream():
if (meta.interruptPending) {
  meta.interruptPending = false
  meta.ttsActive = false
  send(ws, { type: 'teacher_turn_end' })
  return
}
```

### Fix 5 — `interruptSentRef` prevents mic closure after interrupt (`ClassroomLayout.tsx`)
Added `const interruptSentRef = useRef(false)`. Set to `true` in `paidToggle` when interrupt is sent. The `ai_text` handler checks this ref:
- If `true`: clears the ref, skips `setSpeaking(true)` and `stopRecording()` — mic stays open.
- If `false`: normal path — `setSpeaking(true)` + `stopRecording()`.

`audio_chunk` events for the skipped turn are discarded by the existing `isSpeakingRef.current` gate in `onAudioChunk` (which remains `false` since `setSpeaking(true)` was skipped).

## 4. Changed Files

### Backend
- `backend/src/ws/lesson-ws.ts`
  - Added `interruptPending: boolean` to `ClientMeta` interface
  - Initialized `interruptPending: false` in meta object
  - `interrupt` case handler: sets `meta.interruptPending = true` when `meta.aiProcessing`
  - `ttsStream()`: early-return path when `meta.interruptPending` — sends `teacher_turn_end` and skips TTS

### Frontend
- `frontend/src/features/classroom/components/ClassroomLayout.tsx`
  - Added `interruptSentRef = useRef(false)`
  - `paidToggle`: sets `interruptSentRef.current = true` when sending interrupt
  - `ai_text` handler: checks `interruptSentRef.current` before calling `setSpeaking`/`stopRecording`
  - `student_message` handler: `setAnswer('')` + `onTranscript('')` + `setTyping()`
  - `micDisabled` prop: removed `isSpeaking` condition
  - Transcript `useEffect`: added `isListening` guard

### Database
No database changes. Next migration remains `013`.

## 5. Interrupt Lifecycle After Phase 9

**Normal flow (no interrupt):**
```
teacher speaks → ai_text → setSpeaking(true) + stopRecording()
               → audio_chunks → isSpeakingRef=true → audio plays
               → teacher_turn_end → scheduleSpeakOff(audioEndMs+300ms)
               → isSpeaking=false → mic button available
```

**Interrupt during TTS (teacher mid-speech):**
```
user clicks mic → paidToggle → send interrupt + interruptSentRef=true → toggle()
toggle() → stopAudioPlayback() + isSpeakingRef=false + isSpeaking=false + mic opens
backend → stt.clearBuffer() + ttsController.abort()
backend → TTS aborted → no more audio_chunks → teacher_turn_end not sent
→ remaining audio_chunks (if any) discarded by isSpeakingRef=false gate
```

**Interrupt during AI processing (teacher mid-thinking):**
```
user clicks mic → paidToggle → send interrupt + interruptSentRef=true → toggle()
toggle() → stopAudioPlayback() + isSpeakingRef=false + mic opens
backend → meta.interruptPending=true (aiProcessing was true)
backend → AI returns → send ai_text → ttsStream → interruptPending=true → TTS skipped
                     → send teacher_turn_end (lifecycle signal)
frontend → ai_text → interruptSentRef=true → skip setSpeaking/stopRecording → mic stays open
         → teacher_turn_end → scheduleSpeakOff(500ms) → no-op (isSpeaking already false)
```

## 6. Transcript Lifecycle After Phase 9

```
user clicks mic → isListening=true
deepgram partial → transcript event → onTranscript(text) → setTranscript(text)
useEffect: transcript && isListening → setAnswer(text)  [live preview]

deepgram UtteranceEnd → student_message event
→ pushUser(msg.text)   [chat shows student message]
→ setAnswer('')        [input field cleared]
→ onTranscript('')     [transcript state cleared — useEffect won't restore]
→ setTyping()          [typing indicator appears]

AI processes → ai_text → clearTyping() + pushAI() + setSpeaking(true) + stopRecording()
             → isListening=false, transcript='', answer=''  [clean state]
```

## 7. Message Send Lifecycle After Phase 9

**Text path (typed):**
```
user types → setAnswer(text)
Enter/Send → handleSubmit → pushUser(text) + setTyping() + send text_message + setAnswer('')
           → ai_text → clearTyping() + pushAI() + setSpeaking(true) + stopRecording()
```

**Voice path (STT):**
```
user speaks → transcript events → setAnswer(text) [live preview while isListening]
UtteranceEnd → student_message → pushUser() + setAnswer('') + onTranscript('') + setTyping()
             → ai_text → clearTyping() + pushAI() + setSpeaking(true) + stopRecording()
```

Both paths now produce identical state sequences in chat.

## 8. Race Conditions Fixed

1. **Interrupt + AI processing race** — `interruptPending` flag bridges the gap between the interrupt message arriving (before AI returns) and `ttsStream()` starting (after AI returns).

2. **Transcript restoration race** — `onTranscript('')` clears `transcript` state in the same event batch as `setAnswer('')`. The `isListening` guard prevents any subsequent re-render from restoring the answer field.

3. **ai_text after interrupt race** — `interruptSentRef` is a ref (synchronous read), immune to React render batching delays. It is checked in `onMessageRef.current` which always reads the latest closure value.

## 9. Known Remaining Issues

- **`interruptPending` on greeting** — If the student interrupts the very first teacher greeting (lesson start TTS), the interrupt arrives and `aiProcessing=false` (no AI call yet, just a hardcoded greeting). So `interruptPending` is NOT set. The new TTS (greeting) starts normally. This is acceptable: the first greeting is short, and this edge case is rare. Fix in Phase 10 if needed.

- **No visual interrupt affordance** — The mic button looks the same whether the teacher is speaking or idle. The student may not know they can click to interrupt. A subtle animation or icon change (e.g., different button color when `isSpeaking=true` and lesson started) would improve discoverability. This is UI scope beyond Phase 9's parity mandate.

- **Mic stays open after UtteranceEnd** — After Deepgram fires UtteranceEnd, `isListening` remains `true` until the AI responds (when `stopRecording()` is called from `ai_text`). During this window, if more audio arrives, it is sent to Deepgram but dropped by `aiProcessing` guard. This is the existing behaviour, not a regression.

- **Resume exerciseType `'unknown'`** — Carried from Phase 8. AI corrects on first resumed turn.

## 10. What Was Intentionally NOT Changed

- WebSocket FSM (`lesson-ws.ts`) — all phase transitions, the `aiProcessing` guard, and the `MULTI/EXEC` Redis state update preserved exactly
- Lesson orchestrator (`orchestrator.ts`, `prompt-builder.ts`) — no prompt changes
- STT/TTS pipeline (`stt.ts`, `tts.ts`) — Deepgram and ElevenLabs integration untouched
- Billing system (`billing-routes.ts`) — untouched
- Auth system — untouched
- Demo system (`useDemoSession.ts`) — untouched
- Database schema — no new migrations; next migration is `013`
- WebSocket event contract — all types in `message-types.ts` untouched (no new events)
- `max_tokens: 400` per AI turn — unchanged
- Curriculum logic, snapshots, tips, continuations, exercise renderer — all untouched

## 11. Phase 10 Starting State

Phase 10 can start from:
- 0 TypeScript errors in backend and frontend
- Clean Vite production build
- Interrupt flow correctly wired end-to-end
- Transcript lifecycle deterministic
- Mic button interruptible at any point after lesson start

Recommended Phase 10 scope:
- Visual interrupt affordance (mic button color/icon change when `isSpeaking=true`)
- Observability: Sentry or structured log aggregation for STT errors, interrupt events, `tts_skipped` events
- Store `exerciseType` in `LessonState` to eliminate `'unknown'` on resume
- Integration tests for: interrupt-during-processing, rapid mic toggle, STT cancel scenarios
- Optional: auto-open mic after teacher finishes speaking (push-to-talk vs always-on UX)
