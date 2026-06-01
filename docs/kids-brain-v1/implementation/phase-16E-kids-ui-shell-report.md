# Phase 16E — Kids UI Shell Report

**Date:** 2026-06-01  
**Scope:** Frontend only. Backend not modified. Curriculum not modified. WS protocol not changed.

---

## Files Modified / Created

| Action | File |
|---|---|
| **Created** | `frontend/src/pages/KidsClassroomPage.tsx` |
| **Modified** | `frontend/src/App.tsx` |
| **Modified** | `frontend/src/pages/KidsPrototypePage.tsx` |

---

## Route

| Route | Component |
|---|---|
| `/kids` | `KidsPrototypePage` — unchanged landing card |
| `/kids/classroom/:sessionId` | `KidsClassroomPage` — **new dedicated kids classroom** |

`KidsPrototypePage.navigate()` target changed from `/classroom/${sessionId}` (adult UI) to `/kids/classroom/${sessionId}`.

---

## KidsClassroomPage — Components

All sub-components are co-located in `KidsClassroomPage.tsx` (no external sub-files):

| Component | Purpose |
|---|---|
| `KidsTeacherBubble` | Large speech bubble (≥18px/clamp 26px). Animated typing dots in `sending` state. |
| `KidsAudioIndicator` | "Teacher is speaking…" / "Your turn! ✍" / "Sending…" status pill |
| `KidsProgressDots` | 10 hardcoded dots; filled/current animated with gradient + pulse. Advances on each `teacher_turn_end`. |
| `KidsLessonComplete` | "Fantastic job!" screen; shows duration + vocabulary count from `lesson_end.summary`. Done → `/kids`. |
| `KidsExitGuard` | Overlay modal: "Do you want to stop the lesson?" / "Keep going!" / "Stop lesson" |

---

## State Machine

```
connecting → ready → teaching ⇄ listening ⇄ sending → complete
                 ↘ error (WS close / runtime_error)
```

| State | Trigger | UI shown |
|---|---|---|
| `connecting` | WS opened | Spinner "Getting your lesson ready…" |
| `ready` | `lesson_ready` received | "Your teacher is here! → Let's Go!" button |
| `teaching` | `ai_text` received (after gesture) | Teacher bubble + audio plays |
| `listening` | `teacher_turn_end` | "Your turn! ✍" — text input enabled |
| `sending` | Child submits text | Typing dots in bubble, input disabled |
| `complete` | `lesson_end` | Celebration screen + Done → `/kids` |
| `error` | WS error / `runtime_error` | "Oops!" + retry → `/kids` |

---

## WS Messages Consumed

| Message | Handling |
|---|---|
| `lesson_ready` | Transition `connecting → ready` |
| `ai_text` | Buffer before gesture; display + `teaching` after gesture |
| `audio_chunk` | Buffer before gesture; `playAudioChunk()` after gesture |
| `teacher_turn_end` | Advance progress dot; `listening` state (buffered if before gesture) |
| `lesson_end` | `stopAudioPlayback()` + summary + `complete` state |
| `error` / `runtime_error` | `error` state with message |

---

## Audio / iOS Safety

- `primeHtmlAudio()` called synchronously inside "Let's Go!" gesture handler
- `warmAudioContext()` called synchronously inside "Let's Go!" gesture handler
- `primeAudioContext()` awaited before flushing buffered audio chunks
- Audio chunks and `ai_text` are buffered before the first user gesture — no autoplay policy violation

---

## Audit Checklist (Phase 16D requirements)

| Requirement | Status |
|---|---|
| Dedicated `/kids/classroom/:sessionId` route | ✅ |
| `KidsClassroomLayout` — does NOT extend `ClassroomLayout` | ✅ |
| Large teacher text bubble (≥22px) | ✅ clamp(18px, 4vw, 26px) |
| Text input with send button (≥44px tap target) | ✅ min-height 52px |
| Audio status indicator | ✅ KidsAudioIndicator |
| Progress dots (10-step placeholder) | ✅ KidsProgressDots |
| Child-safe reconnect screen | ✅ `ready` state shows "Your teacher is here!" |
| No billing timer | ✅ excluded |
| No section/grammar labels | ✅ excluded |
| No adult chat transcript | ✅ excluded |
| Lesson complete screen | ✅ KidsLessonComplete |
| Safe exit message ("Do you want to stop the lesson?") | ✅ KidsExitGuard |
| `KidsPrototypePage` navigates to `/kids/classroom/:sessionId` | ✅ |
| `lesson_end` navigates to `/kids` (not `/learning`) | ✅ |
| Badge copy updated to Kids Box Unit 1 | ✅ |
| Mobile-first, full-screen layout | ✅ |

---

## Build Results

```
cd frontend
npx tsc --noEmit    → 0 errors
npx vite build      → ✓ built in 3.10s (0 errors, 1 chunk-size warning — pre-existing)
```

---

## Next Required Phase

**Phase 16F — Kids Voice Input**

- Wire child-appropriate mic recording into `KidsClassroomPage`
- Reuse existing `requestMicPermission` / `startPCMCapture` / `stopPCMCapture` from `voiceApi.ts`
- Replace text-input-only path with primary mic button + text fallback
- Verify backend Kids path accepts `audio_chunk` WS frames (same as adult path)
- Add push-to-talk hold behavior for 6–9 year old UX
- Report: `docs/kids-brain-v1/implementation/phase-16F-kids-voice-input-report.md`
