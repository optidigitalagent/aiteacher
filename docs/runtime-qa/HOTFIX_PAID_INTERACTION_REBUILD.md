# HOTFIX: Paid Lesson Interaction Rebuild
> Date: 2026-05-13 | Status: Shipped

## Problems Fixed (9 total)

### P1 — Live STT transcript not shown while speaking
**Root cause:** `DeepgramSTT` only fired the callback on `UtteranceEnd`, so nothing appeared in the input while the student spoke.
**Fix:** Added `onInterim` parameter to `DeepgramSTT` constructor. Transcript handler now fires `onInterim` on every interim AND final segment with accumulating text preview.
**File:** `backend/src/voice/stt.ts`

### P2 — Transcript auto-sent after silence (should be click-to-send)
**Root cause:** `UtteranceEnd` directly called `processInput`, sending the message without any student confirmation.
**Fix:** Click-to-send architecture:
- Student presses mic → speaks → presses mic again (sends `mic_stop` WS message)
- `UtteranceEnd` accumulates text into `meta.pendingTranscript` instead of processing it
- `mic_stop` handler drains `pendingTranscript` and calls `processInput`
- Race handled by `meta.pendingMicStop` flag when `mic_stop` arrives before `UtteranceEnd`
**Files:** `backend/src/ws/lesson-ws.ts`, `backend/src/ws/message-types.ts`, `frontend/src/features/classroom/components/ClassroomLayout.tsx`

### P3 — TTS audio choppy / crackling
**Root cause (a):** `toggle()` called `warmAudioContext()` then `stopAudioPlayback()` — the stop immediately closed the context that was just warmed, leaving future TTS chunks with no context to play into.
**Root cause (b):** OpenAI TTS buffers the complete MP3 server-side then HTTP-streams it. Network chunks are arbitrary byte boundaries (not MP3 frames), causing decode errors on client.
**Fix (a):** Reordered to `stopAudioPlayback()` then `warmAudioContext()` in the same user-gesture frame.
**Fix (b):** `speakOpenAI()` now buffers all HTTP chunks and sends ONE complete `audio_chunk` message instead of partial frames.
**Files:** `frontend/src/features/classroom/hooks/useVoiceSession.ts`, `backend/src/voice/tts.ts`

### P4 — Translate button missing in paid UI
**Status:** Already implemented. `ChatPanel` renders a 🌐 button on each AI message when `onTranslate` is provided. `ClassroomLayout` wires `onTranslate` for paid sessions calling `POST /lesson/translate`. No code change needed.

### P5 — "I don't understand" button missing in paid UI
**Root cause:** `showExplain` prop was hardcoded to `isDemoMode`.
**Fix:** Changed to `showExplain={lessonStarted || isDemoMode}` — shows in paid mode once lesson has started.
**File:** `frontend/src/features/classroom/components/ClassroomLayout.tsx`

### P6 — Questions/tasks not shown clearly on main screen
**Fix:** Center panel now shows a "Yes, I'm ready →" button during DIAGNOSTIC phase, replacing the static hint text. Students click it instead of having to know they should speak.
**File:** `frontend/src/features/classroom/components/ClassroomLayout.tsx`

### P7 — Teacher says "open your book" (no physical book available)
**Root cause:** `buildFocusGreeting()` had hardcoded `"Open your book to this section."` text.
**Fix:** Replaced with `"We'll work through the exercises together on screen — no physical book needed."` and directions to click "I'm ready."
**File:** `backend/src/ws/lesson-ws.ts`

### P8 — AI loops with "I'm ready" / starts exercises too slowly
Addressed by P6 (clear "I'm ready" button) and P7 (greeting no longer requests physical book). The AI no longer waits for student to figure out the input flow.

### P9 — `ai_turn_skipped reason=concurrent_call` (student answers silently dropped)
**Root cause:** `processInput` had an early-return guard when `meta.aiProcessing` was true, silently discarding concurrent student input.
**Fix:** Changed to queue pattern — latest input stored in `meta.queuedInput`. After current AI turn finishes, queued input is processed automatically.
**File:** `backend/src/ws/lesson-ws.ts`

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/voice/stt.ts` | Added `onInterim` callback for live transcript display |
| `backend/src/voice/tts.ts` | Buffer OpenAI TTS to one complete MP3 before sending |
| `backend/src/ws/message-types.ts` | Added `mic_stop` to InboundMessageSchema |
| `backend/src/ws/lesson-ws.ts` | Click-to-send, queued AI input, greeting fix, ClientMeta fields |
| `frontend/src/features/classroom/hooks/useVoiceSession.ts` | Fix AudioContext order (stop → warm) |
| `frontend/src/features/classroom/components/ClassroomLayout.tsx` | paidToggle sends mic_stop, handleReady, showExplain, DIAGNOSTIC button |

## Test Instructions

### P1 — Live transcript
1. Open paid lesson, press mic, speak slowly
2. Input field should show text updating in real time as you speak
3. Text should accumulate correctly (previous confirmed segments + current interim)

### P2 — Click-to-send
1. Press mic, speak, pause for 1-2 seconds (Deepgram silence detection)
2. Transcript should accumulate but NOT auto-send
3. Press mic again — message should send and AI should respond

### P3 — TTS quality
1. Teacher speaks → audio should be smooth, no crackling
2. Press mic → teacher audio should stop cleanly
3. Speak → send → teacher responds → audio should resume correctly (no autoplay block)

### P5 — "I don't understand"
1. Start paid lesson (lessonStarted = true)
2. Bottom bar should show "I don't understand" button
3. Clicking it opens the help input above the bar

### P6 — DIAGNOSTIC phase button
1. At lesson start, center panel should show teacher's greeting + "Yes, I'm ready →" button
2. Clicking it sends "I'm ready." as a student message
3. Once phase advances past DIAGNOSTIC, button should be replaced by mic hint

### P9 — No silent drops
1. Speak multiple answers quickly
2. Backend logs should show `ai_turn_queued` instead of `ai_turn_skipped`
3. All answers should eventually be processed
