# Phase 16F — Kids Voice Input — Implementation Report

## Files Modified / Created

### Created
- `frontend/src/features/classroom/hooks/useKidsMic.ts` — new Kids mic hook

### Modified
- `frontend/src/pages/KidsClassroomPage.tsx`
  - Added `requestMicPreflight` import from `voiceApi`
  - Added `useKidsMic` hook import and usage
  - Added `KidsMicButton` sub-component (all mic states)
  - Added mic CSS (mic button, pulse ring, blocked notice, divider)
  - Added `micPreflightDone` state + preflight call inside `handleStartLesson`
  - Added mic button above text input in active lesson UI

---

## Existing Mic Pipeline Found

**`frontend/src/features/classroom/services/voiceApi.ts`** already contains a complete PCM pipeline:

| Component | Detail |
|---|---|
| `requestMicPermission()` | `getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } })` |
| `requestMicPreflight()` | Silent permission preflight within user gesture — stops tracks immediately |
| `startPCMCapture(stream, onChunk)` | `AudioContext(16kHz)` → `ScriptProcessorNode(4096)` → PCM Int16 → base64 |
| `stopPCMCapture(stream, reason)` | Flags `captureActive=false` before disconnecting nodes (blocks stale callbacks) |
| `warmAudioContext()` / `primeAudioContext()` | iOS AudioContext unlock within user gesture |
| `primeHtmlAudio()` | iOS HTMLAudio unlock |

**Frame format**: `{ type: 'audio_chunk', data: '<base64 PCM Int16 16kHz>' }`  
**Sample rate**: 16 000 Hz, mono, Int16 little-endian  
**WS signals**: `mic_start` → `audio_chunk` stream → `mic_stop`

---

## Reused vs New Implementation

**Reused**: `requestMicPermission`, `requestMicPreflight`, `startPCMCapture`, `stopPCMCapture` from existing `voiceApi.ts` — unchanged.

**New**: `useKidsMic` hook wraps the existing pipeline with Kids-specific safety rules:
- Never auto-starts (requires explicit tap)
- Stops immediately when `enabled` becomes false (teacher speaking)
- Cleans up on unmount (route leave)
- State machine: `idle | requesting | recording | blocked | unavailable`

---

## Backend Compatibility — GAP FOUND

**Status: Audio frames ARE accepted by the WS protocol but NOT processed for Kids sessions.**

### Protocol-level compatibility (YES)
`backend/src/ws/message-types.ts` `InboundMessageSchema` includes all three frames:
```
audio_chunk   { type, data: string }  ← base64 PCM
mic_start     { type }
mic_stop      { type }
```

### Runtime-level compatibility (NO — backend gap)

`handleKidsBrainV1LessonStart` (lesson-ws.ts ~L1176) **does not call `createSTT(ws, meta)`**.

Consequence chain:
1. `meta.stt = null` for all Kids Brain sessions
2. `audio_chunk` handler at L3733:
   ```typescript
   case 'audio_chunk':
     if (!meta.stt) {
       console.log('[paid-lesson] ignored_audio_chunk reason=before_begin')
       return   // ← ALL audio frames silently dropped
     }
   ```
3. `mic_stop` handler: `meta.stt?.flushBuffer() ?? ''` returns `''` → no transcript
4. No-transcript fallback calls adult `ttsStream` (wrong path for kids)
5. Even if mic_stop reaches `processInput(ws, meta, '')`, kids brain receives null STT result

**Same gap exists in `handleKidsLessonStart` (old Kids prototype, L1475).**

### Required backend work — Phase 16G

| File | Change needed |
|---|---|
| `backend/src/ws/lesson-ws.ts` | Add `meta.stt = createSTT(ws, meta)` inside `handleKidsBrainV1LessonStart` after session is activated |
| `backend/src/ws/lesson-ws.ts` | Route no-transcript fallback through `kidsTtsStream` instead of `ttsStream` when `meta.isKidsMode` |
| `backend/src/ws/lesson-ws.ts` | Optionally: filter STT noise and fillers before routing to kids brain turn processor |

---

## Mic UX States

| State | Trigger | UI |
|---|---|---|
| `idle` | Session started, child's turn | Large purple mic button "Tap to speak" |
| `requesting` | Awaiting browser permission dialog | Greyed button "Getting mic…" (disabled) |
| `recording` | Mic open, PCM streaming | Red animated button "Listening…" with pulse ring |
| `blocked` | Permission denied | Friendly inline notice (no raw browser error) |
| `unavailable` | API absent (old browser/WebView) | Mic button hidden entirely |
| disabled | Teacher speaking (`kidsState !== 'listening'`) | Purple button greyed, "Teacher is speaking…" |

Text input is always visible as fallback regardless of mic state.

---

## Safety Rules Implemented

| Rule | Implementation |
|---|---|
| No auto-record on page load | `micPreflightDone = false` on mount; `enabled = kidsState === 'listening' && micPreflightDone` |
| Require child/parent gesture | Hook only starts on explicit `startRecording()` tap |
| Stop when teacher is speaking | `useEffect` in hook: `if (!enabled && isActiveRef.current) stopRecording()` |
| Stop on disconnect | WS `onClose` → `kidsState = 'error'` → `enabled = false` → hook stops recording |
| Stop on route leave | Hook cleanup `useEffect` return: `stopRecording('unmount')` |
| No unauthenticated upload | WS connection requires JWT token from `getStoredToken()` |
| No raw browser errors | All permission errors mapped to friendly `KidsMicButton` states |

---

## Build Results

```
frontend: tsc --noEmit && vite build — PASS (2.63s, 85 modules)
backend:  tsc --noEmit                — PASS (no errors)
```

Backend was not modified; the check confirms nothing was broken.

---

## Remaining Risks

1. **Audio silently dropped** — Backend drops every `audio_chunk` frame until Phase 16G adds STT for kids sessions. The mic button will animate and send frames but no voice answer will be processed. Text input fallback remains fully functional.

2. **mic_stop wrong TTS path** — If `mic_stop` fires with no transcript, backend calls adult `ttsStream` (not `kidsTtsStream`). This uses wrong TTS voice for kids. Needs Phase 16G fix.

3. **iOS AudioContext / SpeechRecognition conflict** — Not a concern here since we use Web Audio PCM capture (not SpeechRecognition). The existing `primeAudioContext` / `primeHtmlAudio` calls already handle iOS AudioContext unlock.

4. **Android Chrome mic permission on page focus** — Mic permission may be revoked between sessions. `requestMicPreflight` is called once on "Let's Go" tap; if revoked, hook will re-request on `startRecording()` and show `blocked` state gracefully.

---

## Next Required Phase

**Phase 16G — Kids Brain STT Integration (Backend)**

Goal: Wire Deepgram STT into Kids Brain WS sessions so audio frames are transcribed.

Required changes:
1. `handleKidsBrainV1LessonStart`: add `meta.stt = createSTT(ws, meta)` (same pattern as adult sessions)
2. `mic_stop` no-transcript fallback: check `meta.isKidsMode` and call `kidsTtsStream` instead of `ttsStream`
3. Consider Deepgram model tuning for children's speech (higher WER tolerance, shorter UtteranceEnd threshold)
4. Add STT noise filter for common child fillers before routing to `processKidsBrainV1Turn`
5. Backend test: `npx vitest run src/ws` and `npx vitest run src/kids-brain`
