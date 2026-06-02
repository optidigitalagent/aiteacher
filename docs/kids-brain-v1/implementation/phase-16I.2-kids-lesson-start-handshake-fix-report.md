# Phase 16I.2 — Kids Lesson Start Handshake Fix Report

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/pages/KidsClassroomPage.tsx` | Added `focus_lesson_start` send in `handleStartLesson()` |

## Exact Fix

**Location:** `KidsClassroomPage.tsx` — `handleStartLesson()`, after `audioStartedRef.current = true`

```diff
  await primeAudioContext()
  audioStartedRef.current = true

+ // Signal backend to begin the lesson (triggers handleKidsBrainV1LessonStart)
+ sendMessage(wsRef.current, { type: 'focus_lesson_start', payload: { unit: 1 } })

  // Flush buffered text
```

The single-line insertion sends the required `focus_lesson_start` frame to the backend immediately after the AudioContext is primed and `audioStartedRef.current` is set to `true`, ensuring any incoming `ai_text` / `audio_chunk` responses are processed rather than buffered.

## Startup Sequence — Before Fix

```
connect
→ lesson_ready
→ user taps "Let's Go"
    → primeHtmlAudio()
    → warmAudioContext()
    → requestMicPreflight()
    → await primeAudioContext()
    → audioStartedRef.current = true
    ← [MISSING: focus_lesson_start never sent]
→ backend stays idle — handleKidsBrainV1LessonStart() never called
→ no ai_text, no audio_chunk, no teacher_turn_end
→ child sees blank lesson screen forever
```

## Startup Sequence — After Fix

```
connect
→ lesson_ready
→ user taps "Let's Go"
    → primeHtmlAudio()
    → warmAudioContext()
    → requestMicPreflight()
    → await primeAudioContext()
    → audioStartedRef.current = true
    → sendMessage({ type: 'focus_lesson_start', payload: { unit: 1 } })
→ backend: handleKidsBrainV1LessonStart()
→ backend: startKidsBrainSession()
→ backend: ai_text greeting streamed
→ backend: audio_chunk(s) streamed
→ backend: teacher_turn_end
→ frontend: teaching state → listening state
→ child hears teacher greeting and can respond
```

## Build Results

```
tsc --noEmit  ✓  (no TypeScript errors)
vite build    ✓  built in 2.45s
dist/assets/index-B6tB9M3g.js   514.96 kB │ gzip: 143.14 kB
```

Build warning: chunk > 500 kB (pre-existing, not introduced by this change).

## Next Required Phase

**Phase 16I.3 — End-to-End Kids Lesson Smoke Test**

Verify the full handshake sequence in a live environment:
1. Connect WebSocket, confirm `lesson_ready` received
2. Tap "Let's Go", confirm `focus_lesson_start` frame is sent (browser DevTools → WS frames)
3. Confirm backend emits `ai_text` greeting within ~3 s
4. Confirm teacher audio plays
5. Confirm `teacher_turn_end` transitions UI to `listening` state
6. Confirm child mic button activates and a spoken answer is accepted
