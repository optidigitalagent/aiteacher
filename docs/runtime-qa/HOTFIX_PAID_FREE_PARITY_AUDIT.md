# Paid / Free Lesson Runtime Parity Audit
> Conducted: 2026-05-13 | Status: IN PROGRESS

---

## 1. Files Inspected — Free (Demo) Lesson

| File | Role |
|------|------|
| `frontend/src/features/classroom/hooks/useDemoSession.ts` | Session state, HTTP TTS, answer submission, translate |
| `frontend/src/features/classroom/components/DemoStepCenter.tsx` | Center panel — current step prompt always visible |
| `frontend/src/features/classroom/components/ClassroomLayout.tsx` (demo paths) | `toggleDemoMic` (Web Speech API), `handleExplain` → help input, demo overlays |
| `frontend/src/features/classroom/services/voiceApi.ts` | TTS playback (strict=true for full MP3), PCM capture |
| `frontend/src/features/classroom/components/ChatPanel.tsx` | Translate button + voice replay on every AI message |
| `frontend/src/features/classroom/components/BottomControls.tsx` | "I don't understand" button, mic, text input |
| `frontend/src/features/classroom/components/TeacherPanel.tsx` | "Explain this" card (both modes) |

---

## 2. Files Inspected — Paid Lesson

| File | Role |
|------|------|
| `frontend/src/features/classroom/hooks/useVoiceSession.ts` | Deepgram PCM streaming via WS, TTS audio chunk gating |
| `frontend/src/features/classroom/hooks/useLessonSession.ts` | Exercise management, phase tracking |
| `frontend/src/features/classroom/hooks/useClassroomChat.ts` | Chat message list |
| `frontend/src/features/classroom/components/ClassroomLayout.tsx` (paid paths) | `paidToggle`, WS message handler, exercise/teaching card display |
| `frontend/src/features/classroom/components/PaidExerciseCard.tsx` | Exercise display (cursor-based) |
| `frontend/src/features/classroom/components/ExercisePanel.tsx` | Exercise with fill-in blank + check button |
| `frontend/src/features/classroom/services/classroomSocket.ts` | WS connection factory, BackendMessage types |
| `backend/src/api/lesson-routes.ts` | Paid lesson REST endpoints (no translate) |
| `backend/src/ws/lesson-ws.ts` | WS lesson orchestration |

---

## 3. Side-by-Side Parity Table

| Feature | Free (Demo) Behavior | Paid Behavior | Divergence | Root Cause File:Line |
|---------|---------------------|---------------|------------|----------------------|
| **TTS playback** | HTTP REST → full MP3 → `playAudioChunk(base64, strict=true)` — awaits completion | WS streaming → partial MP3 frames → `playAudioChunk(base64, strict=false)` — not awaited, gated by `isSpeakingRef` | Demo is sequential and audibly complete; paid can feel choppy if audio context is recreated | `useVoiceSession.ts:85-92`, `voiceApi.ts:77` |
| **Audio context lifecycle** | Context stays alive; `interruptAudio()` closes it only on explicit interrupt | `toggle()` calls `stopAudioPlayback()` → destroys AudioContext on every mic press. New context created in async WS callback — may start SUSPENDED (no user gesture) | Silent audio on paid TTS after mic toggle because `ctx.resume()` fails silently in non-strict mode | `voiceApi.ts:137-143`, `useVoiceSession.ts:62-66` |
| **STT engine** | Web Speech API (browser-native, low latency, no backend) | Deepgram Nova-2 via WebSocket (PCM streaming, ~300ms extra latency) | Different engine; interim transcripts require backend round-trip | `ClassroomLayout.tsx:110-153` vs `useVoiceSession.ts` |
| **Transcript → input** | `rec.onresult` → `setAnswer(collected)` directly, always | `useEffect(() => { if (transcript && isListening) setAnswer(transcript) })` — guard on `isListening` **blocks final transcript** after mic stop | Final Deepgram transcript arrives AFTER `isListening=false` → never shown in input | `ClassroomLayout.tsx:369` — `isListening` guard wrong |
| **Mic auto-submit** | `rec.onend` auto-submits after 250ms pause | No frontend auto-submit — backend sends `student_message` event after Deepgram processes audio | Student stops mic, sees transcript, has to wait for `student_message`; UX feels stuck | `ClassroomLayout.tsx:129-138` vs WS `student_message` handler |
| **Center panel (main question)** | `DemoStepCenter` always renders current step prompt in center | Shows `PaidExerciseCard`/`ExercisePanel` only during exercise phases; EMPTY during dialogue phases | Teacher questions, prompts, conversational turns not visible in main screen area | `ClassroomLayout.tsx:563-679` — no `LastTeacherMessage` component for paid |
| **Translate button** | ChatPanel shows `🌐` button on every AI message → `handleTranslateMessage` → POST `/demo/translate` | `onTranslate={undefined}` passed to ChatPanel — no translate at all | No translate in paid mode | `ClassroomLayout.tsx:689` — `isDemoMode` guard kills paid translate |
| **"Explain this" button** | TeacherPanel card → opens help input overlay | TeacherPanel card → sends `student_confused` WS message | Button exists in paid; user reports it should be removed | `TeacherPanel.tsx:108-128` — no mode guard |
| **"I don't understand" button** | BottomControls → opens help input overlay | BottomControls → calls `handleExplain` → sends `student_confused` | Present in paid; user reports it should be removed | `BottomControls.tsx:112-127` — no mode guard |
| **Interrupt** | `demoInterruptRef.current()` — increments generation counter, stops client audio instantly | `send({ type: 'interrupt' })` + `interruptSentRef` guard, then `toggle()` calls `stopAudioPlayback()` | Paid interrupt is correct but requires backend round-trip; free is instant | `ClassroomLayout.tsx:442-454` |
| **Voice mute toggle** | ChatPanel has mute button (demo only) | No mute — `voiceMuted` not exposed in paid | Mute button visible only in demo — acceptable difference |`ClassroomLayout.tsx:693-695` |

---

## 4. Why Phase 9 Did Not Achieve Parity

Phase 9 unified `ClassroomLayout` into a single component handling both modes, but it **did not fix the interaction mechanics**:

1. **Transcript effect guard left broken.** The `isListening` guard on line 369 was kept from the original code. It correctly prevents stale *partial* transcripts overwriting typed text — but it also blocks the *final* Deepgram transcript that arrives after `isListening` becomes `false`. Users see nothing in the input after speaking.

2. **AudioContext destroyed on every mic toggle.** `toggle()` calls `stopAudioPlayback()` which closes the AudioContext. The next TTS audio creates a new context in an async WS callback — outside a user gesture scope — and the browser suspends it. `playAudioChunk(strict=false)` silently fails. This is the root cause of "choppy/no audio."

3. **No `LastTeacherMessage` center panel.** Phase 9 added `PaidExerciseCard` and `ExercisePanel` for exercise phases but added nothing for dialogue/non-exercise phases. The center is blank when teacher is asking questions between exercises.

4. **Translate wired only for demo.** The `onTranslate` prop is passed as `undefined` in paid mode. No `/lesson/translate` backend endpoint was created. Phase 9 ignored this.

5. **"Explain this" button not mode-gated.** `TeacherPanel` renders the help card for all modes. No `isDemo` prop was added. Phase 9 left the card visible in paid.

6. **"I don't understand" button not mode-gated.** Same issue in `BottomControls`.

---

## 5. Paid vs Free Component Usage

| Component | Free | Paid | Verdict |
|-----------|------|------|---------|
| `useDemoSession` | ✅ owns voice+session+translate | — | Demo-only (REST) — keep |
| `useVoiceSession` | — | ✅ owns mic+transcript+TTS gate | Paid-only (WS) — keep |
| `useLessonSession` | — | ✅ owns exercises+phases | Paid-only — keep |
| `useClassroomChat` | — | ✅ owns chat messages | Paid-only — keep |
| `DemoStepCenter` | ✅ center panel | — | **Demo-only** — paid needs equivalent |
| `PaidExerciseCard` | — | ✅ exercise display | Paid-only — keep |
| `ExercisePanel` | — | ✅ fill-in-blank | Paid-only — keep |
| `TeacherPanel` | ✅ | ✅ | **Shared — needs mode prop** |
| `BottomControls` | ✅ | ✅ | **Shared — needs showExplain prop** |
| `ChatPanel` | ✅ (translate+voice) | ✅ (no translate) | **Shared — paid needs onTranslate wired** |

Paid should **NOT** reuse `useDemoSession` or `DemoStepCenter` — architectures are fundamentally different (REST vs WS). Instead, add a `TeacherMessagePanel` for the paid center display, and fix shared components to accept mode-aware props.

---

## 6. Minimal Safe Fix Plan

### FIX 1 — Remove "Explain this" from paid TeacherPanel
- `TeacherPanel.tsx`: add `isDemo?: boolean` prop; wrap help card in `{isDemo && ...}`
- `ClassroomLayout.tsx`: pass `isDemo={isDemoMode}` to TeacherPanel

### FIX 2 — Remove "I don't understand" from paid BottomControls  
- `BottomControls.tsx`: add `showExplain?: boolean` prop (default `true`); wrap button in `{showExplain && ...}`
- `ClassroomLayout.tsx`: pass `showExplain={isDemoMode}` to BottomControls

### FIX 3 — Fix transcript → input mirroring (paid)
- `ClassroomLayout.tsx`: remove `useEffect` at line 369 (the `isListening` guard)
- Instead, handle directly in WS `'transcript'` case: `setAnswer(prev => (!prev || prev === transcript) ? msg.text : prev)`
- Clear correctly in `'student_message'` case (already done)
- This matches demo behavior: transcript always appears in input while voice is active

### FIX 4 — Fix AudioContext lifecycle (paid TTS choppiness)
- `voiceApi.ts`: add `warmAudioContext()` export — creates/resumes context without destroying it
- `ClassroomLayout.tsx`: call `warmAudioContext()` synchronously in `paidToggle` and `handleBeginLesson` (user gesture scope), BEFORE any async work
- `useVoiceSession.ts`: in `toggle()` start path, call `warmAudioContext()` before `stopAudioPlayback()`, so the new context is pre-warmed

### FIX 5 — Teacher message visible in center during paid dialogue phases
- `ClassroomLayout.tsx`: in the paid center panel fallback (when `lessonStarted` but no exercise active), render the last AI message text in a styled card
- Uses existing `messages` array from `useClassroomChat`

### FIX 6 — Add Translate to paid lesson
- `backend/src/api/lesson-routes.ts`: add `POST /lesson/translate` endpoint
  - Auth: `requireAuth`, validates user owns an active lesson session
  - Rate limit: 10 translations per session (Redis key `lesson:translate:{sessionId}`)
  - Cache: same hash-based cache as demo translate
  - Calls OpenAI translate (same model/prompt as demo)
- `ClassroomLayout.tsx`: pass `onTranslate` to ChatPanel for paid mode
  - Calls `POST /lesson/translate` with `{ sessionId: paidSessionId, text, targetLanguage: 'ru' }`

---

## 7. What Is Preserved

The following paid-lesson backend systems are **not touched** by this hotfix:

- WebSocket lesson orchestrator (`lesson-ws.ts`, `orchestrator.ts`)
- Deepgram STT pipeline (`stt.ts`)
- ElevenLabs TTS streaming (`tts.ts`)
- Claude AI teacher (`claude-handler.ts`, `prompt-builder.ts`)
- Exercise generator (`generator.ts`)
- Phase FSM (`transitions.ts`)
- Billing and minute accounting (`billing-routes.ts`, `subscription-service.ts`)
- PostgreSQL lesson persistence
- Redis lesson state
- `lesson_ready` / `lesson_resumed` flow
- Tips system

---

## 8. Build Verification Plan

After all fixes:
```
cd frontend && npx tsc --noEmit
cd frontend && npx vite build
cd backend && npx tsc --noEmit  (if backend touched)
```
