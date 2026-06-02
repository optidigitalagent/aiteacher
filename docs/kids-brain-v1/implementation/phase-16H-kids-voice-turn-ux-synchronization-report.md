# Phase 16H — Kids Voice Turn UX Synchronization — Report

## Files Modified

| File | Changes |
|------|---------|
| `frontend/src/pages/KidsClassroomPage.tsx` | All changes (see below) |

`useKidsMic.ts`, `voiceApi.ts`, `classroomSocket.ts` — **not modified** (no protocol or pipeline changes required).

---

## Mic Enabled Condition

```
micEnabled = (kidsState === 'listening') && micPreflightDone
```

This single expression encodes all required gate conditions:

| Condition | Covered by |
|-----------|-----------|
| Socket connected | `kidsState === 'listening'` (disconnect → `'error'`) |
| Lesson started | `kidsState === 'listening'` (only reachable after `audioStartedRef.current = true`) |
| Not teacher speaking | `kidsState !== 'teaching'` |
| `teacher_turn_end` received for current turn | `kidsState === 'listening'` |
| Not sending transcript | `kidsState !== 'sending'` |
| Not reconnecting / disconnected | `kidsState !== 'error'` |
| Not lesson complete | `kidsState !== 'complete'` |
| No mic permission error | `micState !== 'blocked'` (handled inside `useKidsMic`) |

---

## Turn States Implemented

| Event | State transition | Mic effect |
|-------|-----------------|------------|
| `lesson_ready` | `connecting → ready` | disabled |
| User taps "Let's Go" | `ready → teaching` | disabled |
| `ai_text` | `* → teaching` | disabled (micEnabled=false) |
| `audio_chunk` | no state change | already disabled |
| `teacher_turn_end` | `* → listening` | **enabled** |
| Child taps mic → recording | micState: `idle → recording` | active |
| Child taps mic again (stop) | `listening → sending` + micState: `recording → idle` | disabled |
| `lesson_end` | `* → complete` | disabled |
| WS close (not complete) | `* → error` | `stopRecording('disconnect')` called |
| Component unmount | cleanup | `stopRecording('unmount')` via `useKidsMic` |

---

## Safety Behaviour

- **Never auto-starts recording** — `startRecording` is only callable via explicit child tap when `enabled=true`.
- **Stop on teacher response** — `ai_text`/`teacher_turn_end` keep `kidsState !== 'listening'`, blocking the mic; if recording, `useKidsMic` effect fires `stopRecording`.
- **Stop on disconnect** — `ws.onclose` calls `stopRecording('disconnect')` then sets `kidsState='error'`.
- **Stop on lesson complete** — `lesson_end` sets `kidsState='complete'`; `micEnabled=false` triggers hook effect.
- **Stop on unmount / route leave** — `useKidsMic` cleanup effect calls `stopRecording('unmount')`.
- **No unauthenticated audio** — `sendMessage` checks `ws.readyState === WebSocket.OPEN`; unauthenticated WS is rejected before `lesson_ready`.
- **Stale closure fix** — `ws.onclose` now uses functional `setKidsState(prev => …)` so a WS close after `lesson_end` does not replace the success screen with an error screen.

---

## Child-Friendly Labels

| Lesson state | Mic button label | Audio indicator |
|-------------|-----------------|-----------------|
| `teaching` | Listen | Teacher is speaking… (dots) |
| `listening` (idle mic) | Tap to speak | Your turn! 🎤 |
| `listening` (mic recording) | Listening… (pulsing) | Your turn! 🎤 |
| `sending` | Sending… | Sending… |
| `error` | *(button hidden — error screen shown)* | — |
| `complete` | *(button hidden — complete screen shown)* | — |

No raw error strings exposed to the child. The "Reconnecting…" label is reserved for a future explicit reconnect phase (Phase 16I or similar); currently the disconnect path goes directly to the error screen with "Try again".

---

## Build / Test Results

```
tsc --noEmit   ✓ (zero type errors)
vite build     ✓ built in 3.17s
               dist/assets/index-Hjq1wKv7.js  514.90 kB (gzip: 143.10 kB)
```

No frontend test suite exists — noted as a future gap.

---

## Remaining Risks

1. **No auto-reconnect** — disconnect goes to a dead error screen; child must tap "Try again". Phase 16I should add a reconnect flow with a "Reconnecting…" state.
2. **`audio_chunk` without `teacher_turn_end`** — if the backend never sends `teacher_turn_end` after audio ends (network drop), the mic stays permanently disabled. Mitigation: Phase 16I reconnect + lesson_resync handling.
3. **Parallel mic + send** — a child could rapidly submit text (handleSubmit) and then tap mic before `kidsState` transitions. The guard `kidsState !== 'listening'` in `startRecording` prevents this.
4. **PCM chunks in flight after stopRecording** — `captureActive = false` flag in `voiceApi.ts` blocks in-flight `onaudioprocess` callbacks, but ~1 chunk may already be queued. Backend should tolerate orphan `audio_chunk` frames.

---

## Next Required Phase

**Phase 16I — Kids Voice Reconnect & Resync**

- Implement auto-reconnect with exponential backoff after WS close
- Add `'reconnecting'` state to `KidsState` FSM
- Show "Reconnecting…" label on mic button during reconnect
- On reconnect: send `lesson_resync` request and restore cursor / turn state
- Flush any in-flight audio and re-enable mic only after `teacher_turn_end` on resynced session
