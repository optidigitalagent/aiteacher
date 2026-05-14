# Hotfix: Runtime Stabilization 2
> Date: 2026-05-14
> Status: Deployed

---

## Root Cause Analysis

### 1. WS 1006 disconnect during paid recording

**Cause A — DeepgramSTT queue-flush crash (stt.ts)**

`DeepgramSTT` queues audio chunks while the Deepgram WebSocket is still connecting.
On the `Open` event it flushed that queue with a raw `for` loop calling
`conn.send(toArrayBuffer(buf))`. If Deepgram's SDK threw synchronously inside
that callback (connection in a transient bad state, or the `ws` library throwing
`"WebSocket is not open"` on a race-closed connection), the exception propagated
*outside* Node.js's event-emitter try/catch context → **unhandled exception →
process killed by Node 20's default behavior → Railway restart → all live
WebSocket connections closed with code 1006 (abnormal TCP drop)**.

**Cause B — duplicate STT instances on resume (lesson-ws.ts)**

`resumeLesson()` created a new `DeepgramSTT` without closing the previous one.
If the old Deepgram connection was still in CONNECTING state, two STT instances
existed for the same client, potentially racing on callbacks.

**How it was fixed:**
- `stt.ts` — wrapped every `conn.send()` call in `try/catch`, used `splice(0)` to
  drain the queue atomically before flushing, added `DeepgramSTT.MAX_QUEUE = 120`
  to cap memory growth.
- `lesson-ws.ts` — added `meta.stt?.close(); meta.stt = null` before all three
  `new DeepgramSTT(...)` creation sites in `resumeLesson`.
- Added `ws.readyState !== WebSocket.OPEN` guard in the `audio_chunk` message case
  with explicit logging for forensic diagnosis of future 1006 events.

---

### 2. Transcript visual reset UX

**Cause — backend STT interim not prefixed with accumulated text**

Deepgram fires `Transcript (is_final)` events per-utterance, and after
`UtteranceEnd` `transcriptBuffer` is cleared. The next interim event from a
*new* utterance carried only the new fragment — the backend's `onInterim`
callback forwarded just that fragment. The frontend's `setAnswer(msg.text)` then
replaced the full long transcript with the short new fragment → users saw the
input visually "clear and restart".

**How it was fixed:**

In all three STT init sites (new lesson, resume, focus lesson), the `onInterim`
callback now prefixes with `meta.pendingTranscript`:
```ts
const fullInterim = meta.pendingTranscript
  ? meta.pendingTranscript + ' ' + interim
  : interim
send(ws, { type: 'transcript', text: fullInterim })
```

After each `UtteranceEnd` the `onTranscript` callback also sends the full
accumulated `pendingTranscript` to keep the input in sync between utterances.

**Result:** The input field now continuously grows. Text never visually resets
between Deepgram utterances. `student_message` still clears the input on
finalization (correct — the text was sent).

---

### 3. TTS audio silently discarded after mic click (spurious interrupt bug)

**Cause — `paidToggle` sent interrupt when audio was draining, not playing**

`isSpeaking` stays `true` for up to 500ms after `teacher_turn_end` (the audio-
drain window computed by `onTeacherTurnEnd`). If the student clicked the mic
during those 500ms, `paidToggle` saw `isSpeaking=true` and sent `interrupt` +
set `interruptSentRef.current = true`.

In the `ai_text` handler, `interruptSentRef.current = true` caused `setSpeaking(true)`
to be **skipped entirely**. This meant `isSpeakingRef.current = false` when the
teacher's *next* response audio chunks arrived → all chunks discarded →
**student heard no audio for the teacher's response** (silent lesson).

**How it was fixed (ClassroomLayout.tsx):**

1. `paidToggle` — added `getScheduledAudioEndMs() > 500` guard:
   ```ts
   if (isSpeaking && !isListening && audioRemaining > 500) {
     send({ type: 'interrupt' })
     interruptSentRef.current = true
   }
   ```
   Clicks during the drain window are treated as normal mic-starts (no interrupt).

2. `ai_text` handler — `setSpeaking(true)` is now **always called**, regardless of
   `interruptSentRef`. When `interruptSentRef = true`, only `stopRecording()` is
   skipped (mic stays open for the in-progress recording):
   ```ts
   setSpeaking(true)   // always — TTS audio must never be silently discarded
   if (interruptSentRef.current) {
     interruptSentRef.current = false
     // mic stays open — student is mid-recording
   } else {
     stopRecording()   // prevent echo
   }
   ```

---

### 4. TTS cuts out mid-stream (ElevenLabs streaming)

**Cause — `scheduleSpeakOff(2000)` fired between streaming chunks**

ElevenLabs sends audio in many small HTTP stream chunks. The frontend called
`scheduleSpeakOff(2000)` on each chunk, resetting a 2-second timer. If the
network had a momentary stall between chunks (>2s), the timer fired →
`isSpeaking = false` → subsequent chunks discarded.

**How it was fixed (useVoiceSession.ts):**

Increased per-chunk window to **8 seconds**:
```ts
scheduleSpeakOff(8000)
```

`teacher_turn_end` arrives after all chunks are sent and overrides this with the
exact audio-drain time via `onTeacherTurnEnd`. The 8s window is purely a safety
net for network stalls — it never causes isSpeaking to linger beyond the actual
audio end.

---

### 5. Greeting creates "readiness loop" (AI pacing)

**Cause — greeting ended with "click the I'm ready button"**

`buildFocusGreeting` appended:
> "When you're ready to begin, click the 'I'm ready' button below."

This caused the lesson to pause for a button click, then the AI asked diagnostic
questions ("tell me what you know..."), then another wait, before exercises began.

**How it was fixed (lesson-ws.ts):**

Greeting now ends with the **first diagnostic question directly**:
> "To start: what do you already know about [grammarFocus]? Give me one example sentence."

- The "I'm ready" button remains as a fallback for students who prefer clicking.
- Students who type or speak their answer bypass the button entirely.
- One fewer round-trip before exercises begin.

Listening task reference changed from "your book" to "the audio material" (online
classroom — students don't have physical textbooks).

---

## Files Changed

| File | What changed |
|------|-------------|
| `backend/src/voice/stt.ts` | Queue flush try/catch; send() try/catch; MAX_QUEUE=120 |
| `backend/src/ws/lesson-ws.ts` | Close old STT before new; pendingTranscript prefix in onInterim/onTranscript; ws_state logging in audio_chunk; greeting ends with question; listening ref fixed |
| `frontend/src/features/classroom/hooks/useVoiceSession.ts` | scheduleSpeakOff 2000→8000 |
| `frontend/src/features/classroom/components/ClassroomLayout.tsx` | getScheduledAudioEndMs guard in paidToggle; setSpeaking(true) always on ai_text |

---

## What still differs from free/demo lesson

| Behaviour | Free/Demo | Paid |
|-----------|-----------|------|
| STT provider | Web Speech API (browser) | Deepgram Nova-2 |
| TTS provider | Static pre-recorded MP3 files | ElevenLabs / OpenAI TTS (live) |
| Mic lifecycle | click → record → stop on `rec.onend` | click → record → click to stop (`mic_stop`) |
| Transcript display | in-browser (no network) | via WS `transcript` event |
| Auto-send on silence | Yes (rec.onend fires) | **No** (explicit second click required) |
| Audio format | HTMLAudioElement | AudioContext scheduled buffer source |

These differences are **intentional** — demo uses browser APIs; paid uses server-
side STT/TTS for quality and language model integration.

---

## QA Checklist for Retesting

### A. WS stability
- [ ] New lesson: click Begin Lesson → lesson starts → teacher speaks → mic opens → speak → click mic to stop → teacher responds with audio ✓
- [ ] Resume: close tab mid-lesson → reopen → connect → lesson_resumed → TTS plays → mic opens → speak → response ✓
- [ ] No code 1006 in browser console after sending audio_chunk ✓
- [ ] Backend logs show `[paid-lesson] stt_accumulated` or `[paid-lesson] student_turn_finalized` (not errors) ✓

### B. Transcript UX
- [ ] Speak for 5+ seconds across multiple Deepgram utterances → input grows continuously ✓
- [ ] Input NEVER visually clears/resets mid-recording ✓
- [ ] After mic_stop → student_message received → input clears → correct ✓
- [ ] Full transcript visible in chat after student_message ✓

### C. TTS playback
- [ ] Teacher speaks greeting → full audio plays uninterrupted ✓
- [ ] Teacher speaks long exercise explanation (>10s) → no cut-off ✓
- [ ] Student clicks mic during teacher speech → audio stops → mic opens → speak ✓
- [ ] Teacher response to student's recording → audio plays correctly (was silently discarded before) ✓
- [ ] No duplicate audio nodes / overlapping speech ✓

### D. Interrupt lifecycle
- [ ] Student clicks mic 300ms before teacher finishes → no spurious interrupt sent (audioRemaining ≤ 500) ✓
- [ ] Student clicks mic while teacher actively speaking (3s+ remaining) → interrupt sent → mic opens ✓
- [ ] After interrupt + record + stop → teacher's response audio plays ✓

### E. Teacher pacing
- [ ] Greeting ends with direct question (not "click I'm ready") ✓
- [ ] Student can type/speak answer directly without clicking button ✓
- [ ] Teacher asks one readiness-style question maximum before exercises ✓
- [ ] No "open your book" references ✓

### F. Click-to-send lifecycle
- [ ] Click 1 → mic opens → transcript grows in input ✓
- [ ] Click 2 → mic_stop sent → student_message in chat → AI responds ✓
- [ ] Silence does NOT auto-send ✓
- [ ] No duplicate sends on fast double-click ✓
