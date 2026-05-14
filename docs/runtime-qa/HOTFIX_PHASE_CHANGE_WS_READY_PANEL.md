# Hotfix: Phase-Change WS 1006 / Ready Button / Center Panel
> Applied: 2026-05-14
> Branch: main
> Builds: backend `tsc --noEmit` ✓ · frontend `tsc --noEmit` ✓ · `vite build` ✓

---

## Files Changed

| File | Bug | What changed |
|------|-----|-------------|
| `backend/src/ws/lesson-ws.ts` | A | `send()` helper wraps `ws.send()` in try/catch |
| `backend/src/ws/lesson-ws.ts` | A | Heartbeat interval wraps `ws.ping()` in try/catch |
| `backend/src/ws/lesson-ws.ts` | A | `startTimerBroadcast` interval body wrapped in try/catch |
| `backend/src/ws/lesson-ws.ts` | A | `ttsStream` catch sends `teacher_turn_end` on non-abort TTS errors |
| `backend/src/voice/tts.ts` | A | `AbortSignal.any` replaced with `combineSignals()` polyfill (Node <20.3.0 safety) |
| `frontend/src/features/classroom/hooks/useVoiceSession.ts` | B | `lastSpeakingOnRef` timestamp; 3s grace window in `onAudioChunk` |
| `frontend/src/features/classroom/components/ClassroomLayout.tsx` | C | `readyClicked` state; `handleReady` sets it; button hidden when true |
| `frontend/src/features/classroom/components/ClassroomLayout.tsx` | D | Removed hardcoded `CONTEXT_INPUT` branch; unified with last-AI-message display |

---

## Bug A — WS 1006 disconnect after phase_change

**Root cause**: `ws.send()` and `ws.ping()` throw synchronously when the socket closes between
the `readyState` check and the actual call (TOCTOU race). These throws escaped from
`setInterval` callbacks directly to the Node.js event loop. Without an
`uncaughtException` handler, Node.js exits the process — disconnecting the client with
code 1006 (abnormal close, no close frame).

**Secondary root cause**: `AbortSignal.any` (used in both `speakElevenLabs` and `speakOpenAI`)
was added in Node.js 20.3.0. A Railway build running an older minor could throw a
`TypeError` here, which was caught by `ttsStream`'s catch block but meant TTS never
completed — so `teacher_turn_end` was never sent and the mic lifecycle stalled permanently.

**Fix**: Wrapped all three `setInterval` bodies and the `send()` helper in try/catch.
Added `combineSignals()` polyfill with runtime detection (`typeof AbortSignal.any`).
Added `teacher_turn_end` emission in the `ttsStream` non-abort error path.

---

## Bug B — First audio_chunk discarded as `not_speaking`

**Root cause**: The WS `onmessage` handler in ClassroomLayout receives `ai_text` and
immediately calls `setSpeaking(true)`, which sets `isSpeakingRef.current = true`
synchronously. However, in certain timing windows (React Strict Mode double-invocation
in dev, or the backend streaming `audio_chunk` before `ai_text` is fully processed),
the first `audio_chunk` handler runs before the ref is updated. The result is the
"not_speaking" discard log visible in the console.

**Fix**: Added `lastSpeakingOnRef = useRef(0)` tracking the timestamp of the last
`setSpeaking(true)` call. In `onAudioChunk`, if `isSpeakingRef.current` is false but
the last turn start was within 3 seconds, the chunk is accepted and the ref recovered
to `true`. Chunks arriving more than 3s after the last turn start are still discarded
as before (genuine post-interrupt orphans).

---

## Bug C — Ready button stale after click

**Root cause**: `handleReady` had no idempotency guard. React's render cycle could
re-render the DIAGNOSTIC phase card (e.g. on a new AI message arriving) and the button
would reappear because the phase hadn't changed yet.

**Fix**: Added `readyClicked` React state (not a ref — needs to trigger re-render).
`handleReady` sets it on first call and guards against re-entry. Button render
condition changed from `currentPhase === 'DIAGNOSTIC'` to
`currentPhase === 'DIAGNOSTIC' && !readyClicked`.

---

## Bug D — Center panel shows "Review the material" during CONTEXT_INPUT

**Root cause**: A dedicated `currentPhase === 'CONTEXT_INPUT'` branch in the center
panel rendered a static hardcoded card ("📖 Reading / Review the material") instead
of the actual teacher question. Students couldn't see what they were supposed to do
without opening the chat panel.

**Fix**: Removed the `CONTEXT_INPUT` branch entirely. All non-exercise dialogue phases
(DIAGNOSTIC, CONTEXT_INPUT, RULE_DISCOVERY, etc.) now fall through to the unified
last-AI-message card, which shows the actual teacher message with the correct CTA.

---

## Retest Checklist

### WS stability (Bug A)
- [ ] Start a paid lesson and let it run for 2+ minutes through at least one phase change (DIAGNOSTIC → CONTEXT_INPUT → RULE_DISCOVERY)
- [ ] Verify no WS 1006 banner appears mid-lesson
- [ ] In Railway logs: no `[ws] send error`, `[ws] ping error`, or uncaught exception lines
- [ ] Trigger TTS: verify `teacher_turn_end` is received in browser console even if ElevenLabs fails

### First audio chunk (Bug B)
- [ ] Begin lesson; observe first teacher greeting
- [ ] Console must NOT show `audio_chunk_discarded reason=not_speaking` for the opening message
- [ ] Audio plays without silence at the start of the first teacher turn
- [ ] Subsequent teacher turns also play without discard

### Ready button (Bug C)
- [ ] During DIAGNOSTIC phase, "Yes, I'm ready →" button is visible
- [ ] Click it once — button disappears immediately (same render cycle)
- [ ] New AI messages arriving after click do NOT re-show the button
- [ ] Phase change to CONTEXT_INPUT does NOT re-show the button

### Center panel (Bug D)
- [ ] During CONTEXT_INPUT phase, center panel shows the actual last teacher message (not "Review the material")
- [ ] During RULE_DISCOVERY phase, center panel shows teacher question
- [ ] During EXERCISES phase, exercise card still renders as expected (unchanged path)
- [ ] During DIAGNOSTIC phase before ready click, "Yes, I'm ready →" CTA appears below teacher message
- [ ] Chat panel independence: student can understand what to do from center panel alone

### Regressions
- [ ] Click-to-send mic behavior preserved (toggle sends audio_chunk, no interrupt on normal stop)
- [ ] OpenAI TTS buffering preserved (full MP3 buffered before sending single audio_chunk)
- [ ] Deepgram STT guards preserved (mic_stop does not trigger interrupt)
- [ ] Billing timer continues after phase change
- [ ] Lesson snapshot on disconnect still saves correctly
