# Phase 16G — Kids Brain STT Integration Report

## Files Modified

| File | Change |
|------|--------|
| `backend/src/ws/lesson-ws.ts` | 3 edits (STT init + 2× TTS fallback fix) |
| `backend/src/ws/__tests__/phase-16g-kids-stt-integration.test.ts` | New test file (7 tests) |

---

## Existing STT Pipeline Reused

`createSTT(ws, meta)` — defined at `lesson-ws.ts:3319`.

Wraps a single `DeepgramSTT` instance with:
- `onTranscript` callback: fires on Deepgram `UtteranceEnd`; accumulates `pendingTranscript` while `micActive=true`; submits via `processInput()` on mic_stop stabilization
- `onInterim` callback: forwards live transcript preview to client

**Zero duplication.** Kids Brain v1 now uses the exact same `createSTT` function, same Deepgram client class, same audio pipeline. No second STT implementation created.

---

## Exact Kids STT Initialization Point

`handleKidsBrainV1LessonStart` — `lesson-ws.ts:1192` (after session meta is set, before `maxDurationRef`):

```typescript
meta.stt?.close()
meta.stt               = null
meta.pendingTranscript = ''
meta.pendingMicStop    = false
meta.micActive         = false
meta.stt = createSTT(ws, meta)
```

This runs:
- after `meta.isKidsMode = true`, `meta.kidsBrainV1Active = true`, `meta.lessonId = sessionId`
- after authenticated session ownership is confirmed
- before `lesson_ready` is sent to the client
- on both cold-start and reconnect paths

---

## Transcript Routing Behavior

```
mic_start → meta.micActive = true
audio_chunk → meta.stt.send(base64) → Deepgram
Deepgram UtteranceEnd → onTranscript(text) → meta.pendingTranscript accumulated
mic_stop → 450ms stabilization → meta.stt.flushBuffer() + pendingTranscript
  → processInput(ws, meta, finalText)
    → if (meta.isKidsMode && meta.kidsBrainV1Active)
        → processKidsBrainV1Turn(ws, meta, finalText)
          → same session memory load, same runtime pipeline,
            same saveSession, same analytics guard, same kidsTtsStream
```

`processInput` already routes Kids v1 to `processKidsBrainV1Turn` at line 2353. No routing change was needed — the bug was only that `meta.stt` was never initialized, so audio was silently dropped before reaching `processInput`.

---

## No-Transcript Fallback Behavior

**Before fix:** `ttsStream()` called with adult prompt "I didn't catch that. Try once more."

**After fix** (both no-transcript and noise-reject paths):

```typescript
const noTranscriptMsg = meta.kidsBrainV1Active
  ? "I didn't hear you. Try again!"
  : "I didn't catch that. Try once more."
const speakNoTranscript = meta.kidsBrainV1Active ? kidsTtsStream : ttsStream
```

`kidsTtsStream` uses the `nova` voice (child-safe), tracks `ttsCharCount` against `KIDS_MAX_TTS_CHARS`, and respects `interruptPending`. Adult sessions are unaffected (same branch as before).

---

## Tests Added

**File:** `backend/src/ws/__tests__/phase-16g-kids-stt-integration.test.ts`

| Suite | Test | Assertion |
|-------|------|-----------|
| STT initialization | `audio_chunk reaches stt.send()` | `stt.send` mock called with audio data after session start |
| STT initialization | `no INVALID_MESSAGE errors` | mic_start/audio_chunk/mic_stop all accepted by WS schema |
| Transcript routing | `"I'm ready." voice transcript → "blue"` | STT callback + mic_stop → ai_text contains "blue" |
| Transcript routing | `"blue" voice transcript → ai_text` | processKidsBrainV1Turn produces non-empty response |
| No-transcript fallback | `speakToClient with kid-safe message` | "didn't hear you" / "Try again" — not "didn't catch that" |
| Adult regression | `DeepgramSTT constructor called ≥4×` | adult path unchanged |
| Protocol integrity | `WS frames accepted` | no INVALID_MESSAGE errors across all tests |

DeepgramSTT is fully mocked — no real Deepgram API required.

---

## Commands Run

```
cd backend
npx tsc --noEmit         → 0 errors
npx vitest run src/ws    → 19/19 passed (15B: 12, 16G: 7)
npx vitest run src/kids-brain → 870/870 passed (31 files)
```

---

## Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Kids mode queued input not replayed | Low | On Kids path, if `aiProcessing=true` when stabilization fires, `queuedInput` is set but never replayed (adult path replays). Only affects rapid double-turns. Pre-existing behavior, out of 16G scope. |
| STT created before reconnect guard | None | STT init is before reconnect guard; on reconnect the old STT is `.close()`-d before new one is created (line: `meta.stt?.close()`) |
| Deepgram connection count | None | One `DeepgramSTT` per WS connection, same as adult path |

---

## Next Required Phase

**Phase 16H** — Kids Brain frontend mic integration:
- `KidsClassroomPage.tsx` currently has `useKidsMic` hook but the UI mic button may not be wired to `lesson_ready`/`teacher_turn_end` gate
- Verify `enabled` prop correctly reflects backend listening state
- Add E2E smoke test covering full voice round-trip from browser mic tap to Kids Brain response
